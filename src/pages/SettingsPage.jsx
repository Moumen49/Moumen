import React, { useState, useEffect } from 'react';
import { getDelegates, addDelegate, updateDelegate, deleteDelegate, getCamps, addCamp, updateCamp, deleteCamp, assignCampToOrphans, assignDelegatesToCamp, getUnassignedDelegatesCount, registerUser, getAllUsers, updateUserData, deleteUser, usernameToEmail, emailToUsername } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useCamp } from '../context/CampContext';
import { Trash2, Plus, UserCheck, Shield, Tent, AlertTriangle, Database, Pencil, X, Download, UserPlus, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

export default function SettingsPage() {
    const { user } = useAuth();
    const { camps, refreshCamps, selectedCamp } = useCamp();
    const [delegates, setDelegates] = useState([]);

    // Delegate State
    const [showDelegateModal, setShowDelegateModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [editingDelegate, setEditingDelegate] = useState(null);
    const [unassignedDelegatesCount, setUnassignedDelegatesCount] = useState(0);
    const [newDelegate, setNewDelegate] = useState({
        name: '',
        phone: '',
        nid: '',
        dob: '',
        notes: ''
    });

    // Camp State
    const [showCampModal, setShowCampModal] = useState(false);
    const [showCampExportModal, setShowCampExportModal] = useState(false);
    const [editingCamp, setEditingCamp] = useState(null);
    const [newCamp, setNewCamp] = useState({
        name: '',
        manager_name: '',
        manager_phone: '',
        manager_nid: ''
    });

    // User Management State (New)
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({
        email: '',
        password: '',
        username: '', // This will be the Login ID
        fullName: '', // This will be the Display Name
        role: 'user',
        camp_id: '',
        assigned_camps: []
    });


    const [loading, setLoading] = useState(true);

    useEffect(() => {
        refreshCamps(); // Load camps once on mount
    }, []);

    useEffect(() => {
        loadData();
    }, [selectedCamp]); // Reload when camp changes

    const loadData = async () => {
        setLoading(true);
        try {
            const orphansCount = await getUnassignedDelegatesCount();
            setUnassignedDelegatesCount(orphansCount);

            if (selectedCamp) {
                const dList = await getDelegates(selectedCamp.camp_id);
                setDelegates(dList);
            } else {
                setDelegates([]);
            }

            // Load users for system_admin
            if (user?.role === 'system_admin') {
                try {
                    const usersList = await getAllUsers();
                    setUsers(usersList);
                } catch (error) {
                    console.error('Failed to load users', error);
                    // Don't fail the whole load if users can't be fetched
                }
            }
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAssignDelegates = async () => {
        if (!selectedCamp) {
            alert('الرجاء اختيار مخيم أولاً');
            return;
        }

        if (!window.confirm(`هل أنت متأكد من نقل جميع المفوضين غير المرتبطين بأي مخيم (${unassignedDelegatesCount} مفوض) إلى مخيم "${selectedCamp.name}"؟`)) {
            return;
        }

        try {
            const count = await assignDelegatesToCamp(selectedCamp.camp_id);
            alert(`تم نقل ${count} مفوض بنجاح إلى ${selectedCamp.name}`);
            loadData();
        } catch (error) {
            alert(error.message);
        }
    };

    const handleExportCamps = () => {
        if (camps.length === 0) {
            alert('لا يوجد مخيمات لتصديرها');
            return;
        }

        const data = camps.map(c => ({
            'اسم المخيم / المنطقة': c.name,
            'اسم المسؤول': c.manager_name || '-',
            'رقم تواصل المسؤول': c.manager_phone || '-',
            'رقم هوية المسؤول': c.manager_nid || '-'
        }));

        const ws = XLSX.utils.json_to_sheet(data, { rtl: true });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "المخيمات");
        XLSX.writeFile(wb, "سجل_المخيمات.xlsx");
    };

    // Delegates Handlers
    const handleAddDelegate = async (e) => {
        e.preventDefault();
        if (!newDelegate.name?.trim()) return;

        if (!selectedCamp) {
            alert("يجب اختيار مخيم أولاً لإضافة مفوض إليه");
            return;
        }

        try {
            const delegateData = { ...newDelegate, camp_id: selectedCamp.camp_id };

            if (editingDelegate) {
                await updateDelegate(editingDelegate.delegate_id, delegateData);
            } else {
                await addDelegate(delegateData);
            }

            setShowDelegateModal(false);
            setEditingDelegate(null);
            setNewDelegate({ name: '', phone: '', nid: '', dob: '', notes: '' });
            loadData();
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    };

    const handleDeleteDelegate = async (id) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا المفوض؟')) return;
        try {
            await deleteDelegate(id);
            loadData();
        } catch (error) {
            console.error(error);
        }
    };

    // Camps Handlers
    const handleAddCamp = async (e) => {
        e.preventDefault();
        if (!newCamp.name?.trim()) return;

        try {
            if (editingCamp) {
                await updateCamp(editingCamp.camp_id, newCamp);
            } else {
                await addCamp(newCamp);
            }

            setShowCampModal(false);
            setEditingCamp(null);
            setNewCamp({ name: '', manager_name: '', manager_phone: '', manager_nid: '' });
            await refreshCamps(); // Update global context
        } catch (error) {
            alert(error.message);
        }
    };

    const handleDeleteCamp = async (id) => {
        if (!window.confirm('هل أنت متأكد؟ سيتم حذف المخيم ولكن قد تبقى العائلات مرتبطة به.')) return;
        try {
            await deleteCamp(id);
            await refreshCamps(); // Update global context
        } catch (error) {
            console.error(error);
        }
    };

    const handleMigrateData = async () => {
        if (!selectedCamp) {
            alert('الرجاء اختيار المخيم أولاً من القائمة الجانبية لنقل البيانات القديمة إليه.');
            return;
        }

        if (!window.confirm(`هل أنت متأكد من أنك تريد نقل جميع البيانات القديمة (الغير مرتبطة بمخيم) إلى مخيم "${selectedCamp.name}"؟`)) return;

        try {
            const count = await assignCampToOrphans(selectedCamp.camp_id);
            alert(`تم ربط ${count} عائلة بالمخيم "${selectedCamp.name}" بنجاح.`);
        } catch (error) {
            console.error(error);
            alert('حدث خطأ أثناء نقل البيانات');
        }
    };

    // User Management Handler
    const handleRegisterUser = async (e) => {
        e.preventDefault();

        if (newUser.role === 'manager' && !newUser.camp_id) {
            alert('يجب تحديد مخيم لمدير المخيم');
            return;
        }

        if (newUser.role === 'supervisor' && (!newUser.assigned_camps || newUser.assigned_camps.length === 0)) {
            alert('يجب تحديد مخيم واحد على الأقل للمشرف');
            return;
        }

        try {
            if (editingUser) {
                // Update existing user
                const updates = {
                    username: newUser.username,
                    fullName: newUser.fullName,
                    role: newUser.role,
                    camp_id: (newUser.role === 'admin' || newUser.role === 'system_admin' || newUser.role === 'supervisor') ? null : newUser.camp_id,
                    assigned_camps: newUser.role === 'supervisor' ? newUser.assigned_camps : null
                };

                if (newUser.email !== editingUser.email) {
                    updates.email = newUser.email;
                }

                // إضافة كلمة المرور فقط إذا كانت معبأة
                if (newUser.password && newUser.password.trim() !== '') {
                    updates.password = newUser.password;
                }

                await updateUserData(editingUser.user_id, updates);
                alert('تم تحديث بيانات المستخدم بنجاح!');
            } else {
                // Create new user
                const userData = {
                    email: usernameToEmail(newUser.username),
                    password: newUser.password,
                    username: newUser.username,
                    fullName: newUser.fullName,
                    role: newUser.role,
                    camp_id: (newUser.role === 'admin' || newUser.role === 'system_admin' || newUser.role === 'supervisor') ? null : newUser.camp_id,
                    assigned_camps: newUser.role === 'supervisor' ? newUser.assigned_camps : null
                };

                await registerUser(userData);
                alert('تم إنشاء المستخدم بنجاح!');
            }

            setShowUserModal(false);
            setEditingUser(null);
            setNewUser({ email: '', password: '', username: '', fullName: '', role: 'user', camp_id: '', assigned_camps: [] });
            loadData(); // Reload users list

        } catch (error) {
            alert('خطأ: ' + error.message);
        }
    };

    const handleDeleteUser = async (userId, username) => {
        if (!window.confirm(`هل أنت متأكد من حذف المستخدم "${username}"؟ لا يمكن التراجع عن هذا الإجراء.`)) {
            return;
        }

        try {
            await deleteUser(userId);
            alert('تم حذف المستخدم بنجاح');
            loadData(); // Reload users list
        } catch (error) {
            alert('خطأ في حذف المستخدم: ' + error.message);
        }
    };

    if (user?.role !== 'system_admin' && user?.role !== 'admin' && user?.role !== 'manager') {
        // Fallback for unknown roles
        return <div className="p-10 text-center">غير مصرح لك بدخول هذه الصفحة</div>;
    }

    const handleExportDelegates = () => {
        if (delegates.length === 0) {
            alert('لا يوجد مفوضين لتصديرهم');
            return;
        }

        const data = delegates.map(d => ({
            'الاسم': d.name,
            'رقم التواصل': d.phone || '-',
            'رقم الهوية': d.nid || '-',
            'تاريخ الميلاد': d.dob || '-',
            'ملاحظات': d.notes || '-'
        }));

        const ws = XLSX.utils.json_to_sheet(data, { rtl: true });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "المفوضين");
        XLSX.writeFile(wb, "سجل_المفوضين.xlsx");
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-20 md:pb-10 px-4 md:px-0">
            <div className="flex items-center gap-3 mb-4 md:mb-6">
                <div className="bg-gray-100 p-2 md:p-3 rounded-xl md:rounded-full">
                    <Shield className="h-5 w-5 md:h-6 md:w-6 text-gray-700" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">إعدادات النظام</h1>
            </div>

            {/* USERS Management Section (SYSTEM ADMIN ONLY) */}
            {user?.role === 'system_admin' && (
                <section className="bg-gradient-to-l from-indigo-50 to-white p-6 rounded-2xl shadow-sm border border-indigo-100">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                            <Lock className="h-5 w-5 text-indigo-600" />
                            إدارة المستخدمين والصلاحيات
                        </h2>
                        <button
                            onClick={() => {
                                setEditingUser(null);
                                setNewUser({ email: '', password: '', username: '', role: 'user', camp_id: '', assigned_camps: [] });
                                setShowUserModal(true);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm shadow-sm"
                        >
                            <UserPlus className="h-4 w-4" />
                            إضافة مستخدم جديد
                        </button>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">
                        يمكنك إنشاء حسابات لمدراء المخيمات وتحديد المخيم الذي يديرونه، بحيث لا يمكنهم رؤية بيانات المخيمات الأخرى.
                    </p>

                    {/* Users List */}
                    <div className="space-y-3 mt-6">
                        {loading ? (
                            <div className="text-center text-gray-500">جاري التحميل...</div>
                        ) : users.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-400">
                                لا يوجد مستخدمين بعد
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <AnimatePresence>
                                    {users.map((usr) => {
                                        const userCamp = camps.find(c => c.camp_id === usr.camp_id);
                                        return (
                                            <motion.div
                                                key={usr.user_id}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="bg-white rounded-xl border border-indigo-100 p-4 hover:border-indigo-200 transition relative group"
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <h3 className="font-bold text-gray-800 text-lg">{usr.user_metadata?.fullName || usr.username}</h3>
                                                            <span className={`text-xs px-2 py-1 rounded-full ${usr.role === 'system_admin' ? 'bg-purple-100 text-purple-700' :
                                                                usr.role === 'admin' ? 'bg-red-100 text-red-700' :
                                                                    usr.role === 'supervisor' ? 'bg-green-100 text-green-700' :
                                                                        'bg-blue-100 text-blue-700'
                                                                }`}>
                                                                {usr.role === 'system_admin' ? '💎 مسؤول نظام' : usr.role === 'admin' ? '👑 أدمن' : usr.role === 'supervisor' ? '🎯 مشرف' : '👤 مدير'}
                                                            </span>
                                                        </div>
                                                        <div className="space-y-1 text-sm text-gray-600">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-xs">🆔</div>
                                                                {emailToUsername(usr.email)}
                                                            </div>
                                                            {userCamp && (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-xs">⛺</div>
                                                                    {userCamp.name}
                                                                </div>
                                                            )}
                                                            {usr.role === 'supervisor' && usr.assigned_camps && usr.assigned_camps.length > 0 && (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center text-xs">⛺</div>
                                                                    <div className="text-xs">
                                                                        {usr.assigned_camps.length} {usr.assigned_camps.length === 1 ? 'مخيم' : 'مخيمات'}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {usr.last_sign_in_at && (
                                                                <div className="text-xs text-gray-400 mt-1">
                                                                    آخر تسجيل دخول: {new Date(usr.last_sign_in_at).toLocaleDateString('ar-EG')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingUser(usr);
                                                                setNewUser({
                                                                    email: usr.email,
                                                                    password: '', // Don't show password
                                                                    username: usr.username,
                                                                    fullName: usr.user_metadata?.fullName || '',
                                                                    role: usr.role,
                                                                    camp_id: usr.camp_id || '',
                                                                    assigned_camps: usr.assigned_camps || []
                                                                });
                                                                setShowUserModal(true);
                                                            }}
                                                            className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 shadow-sm border border-indigo-100 transition"
                                                            title="تعديل"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUser(usr.user_id, usr.username)}
                                                            className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 shadow-sm border border-red-100 transition"
                                                            title="حذف"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Camps Management Section (Admin & Manager) */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Tent className="h-5 w-5 text-indigo-600" />
                        إدارة المخيمات / المناطق
                    </h2>

                    {/* Actions - Only System Admin & Admin can Add/Export or if Manager wants to edit their own */}
                    <div className="flex gap-2">
                        {(user?.role === 'system_admin' || user?.role === 'admin') && (
                            <>
                                <button
                                    onClick={() => {
                                        if (camps.length === 0) {
                                            alert('لا يوجد مخيمات لتصديرها');
                                            return;
                                        }
                                        setShowCampExportModal(true);
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm shadow-sm"
                                    title="تصدير إلى Excel"
                                >
                                    <Download className="h-4 w-4" />
                                    تصدير Excel
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingCamp(null);
                                        setNewCamp({ name: '', manager_name: '', manager_phone: '', manager_nid: '' });
                                        setShowCampModal(true);
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm shadow-sm"
                                >
                                    <Plus className="h-4 w-4" />
                                    إضافة مخيم
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    {loading ? (
                        <div className="text-center text-gray-500">جاري التحميل...</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <AnimatePresence>
                                {/* Filter camps: Admin sees all, Manager sees only theirs */}
                                {camps
                                    .filter(camp => user?.role === 'system_admin' || user?.role === 'admin' || camp.camp_id === selectedCamp?.camp_id)
                                    .map((camp) => (
                                        <motion.div
                                            key={camp.camp_id}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="bg-gray-50 rounded-xl border border-gray-100 p-4 hover:border-indigo-100 transition relative group"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-gray-800 text-lg mb-1">{camp.name}</h3>
                                                    <div className="space-y-1 text-sm text-gray-600">
                                                        {camp.manager_name && <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-xs">👤</div> {camp.manager_name}</div>}
                                                        {camp.manager_phone && <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-xs">📞</div> {camp.manager_phone}</div>}
                                                        {camp.manager_nid && <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-xs">💳</div> {camp.manager_nid}</div>}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingCamp(camp);
                                                            setNewCamp({ ...camp });
                                                            setShowCampModal(true);
                                                        }}
                                                        className="p-2 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 shadow-sm border border-gray-100 transition"
                                                        title="تعديل"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>

                                                    {/* Delete only for System Admin & Admin */}
                                                    {(user?.role === 'system_admin' || user?.role === 'admin') && (
                                                        <button
                                                            onClick={() => handleDeleteCamp(camp.camp_id)}
                                                            className="p-2 bg-white text-red-500 rounded-lg hover:bg-red-50 shadow-sm border border-gray-100 transition"
                                                            title="حذف"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                {camps.length === 0 && (
                                    <div className="col-span-2 text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-400">
                                        لا يوجد مخيمات لعرضها
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>


            </section>

            {/* Delegates Management Section - Visible to ALL (Filtered by CampContext for Managers) */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-indigo-600" />
                        إدارة المفوضين / المربعات
                        {selectedCamp && <span className="text-sm font-normal text-gray-500 mr-2">({selectedCamp.name})</span>}
                    </h2>

                    {selectedCamp && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    if (delegates.length === 0) {
                                        alert('لا يوجد مفوضين لتصديرهم');
                                        return;
                                    }
                                    setShowExportModal(true);
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm shadow-sm"
                                title="تصدير إلى Excel"
                            >
                                <Download className="h-4 w-4" />
                                تصدير Excel
                            </button>
                            <button
                                onClick={() => {
                                    setEditingDelegate(null);
                                    setNewDelegate({ name: '', phone: '', nid: '', dob: '', notes: '' });
                                    setShowDelegateModal(true);
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm shadow-sm"
                            >
                                <Plus className="h-4 w-4" />
                                إضافة مفوض
                            </button>
                        </div>
                    )}
                </div>

                {/* Unassigned Delegates Warning/Action */}
                {(user?.role === 'system_admin' || user?.role === 'admin') && selectedCamp && unassignedDelegatesCount > 0 && (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-full">
                                <AlertTriangle className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="font-bold text-blue-800">مفوضين غير مسجلين في أي مخيم</h4>
                                <p className="text-sm text-blue-600">يوجد {unassignedDelegatesCount} مفوض من النظام القديم غير مرتبطين بأي مخيم.</p>
                            </div>
                        </div>
                        <button
                            onClick={handleAssignDelegates}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition shadow-sm"
                        >
                            نقلهم إلى {selectedCamp.name}
                        </button>
                    </div>
                )}

                {!selectedCamp ? (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-8 rounded-xl text-center">
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                        <p className="font-bold">يرجى اختيار مخيم من القائمة الجانبية لعرض وإدارة المفوضين الخاصين به.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {loading ? (
                            <div className="text-center text-gray-500">جاري التحميل...</div>
                        ) : delegates.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-400">
                                لا يوجد مفوضين مضافين لهذا المخيم بعد
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <AnimatePresence>
                                    {delegates.map((delegate) => (
                                        <motion.div
                                            key={delegate.delegate_id}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="bg-gray-50 rounded-xl border border-gray-100 p-4 hover:border-indigo-100 transition relative group"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-gray-800 text-lg mb-1">{delegate.name}</h3>
                                                    <div className="space-y-1 text-sm text-gray-600">
                                                        {delegate.phone && <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-xs">📞</div> {delegate.phone}</div>}
                                                        {delegate.nid && <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-xs">💳</div> {delegate.nid}</div>}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingDelegate(delegate);
                                                            setNewDelegate({ ...delegate });
                                                            setShowDelegateModal(true);
                                                        }}
                                                        className="p-2 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 shadow-sm border border-gray-100 transition"
                                                        title="تعديل"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteDelegate(delegate.delegate_id)}
                                                        className="p-2 bg-white text-red-500 rounded-lg hover:bg-red-50 shadow-sm border border-gray-100 transition"
                                                        title="حذف"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* Export Preview Modal */}
            <AnimatePresence>
                {showExportModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
                        >
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className="bg-green-100 p-2 rounded-lg">
                                        <Download className="h-6 w-6 text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-xl text-gray-800">تصدير سجل المفوضين</h3>
                                        <p className="text-sm text-gray-500">معاينة البيانات قبل التصدير</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowExportModal(false)}
                                    className="p-2 bg-white rounded-full hover:bg-gray-100 transition"
                                >
                                    <X className="h-5 w-5 text-gray-500" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-auto p-6">
                                <div className="border border-gray-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-right">
                                        <thead className="bg-gray-50 text-gray-600 font-bold text-sm">
                                            <tr>
                                                <th className="p-4 border-b border-gray-100">الاسم</th>
                                                <th className="p-4 border-b border-gray-100">رقم التواصل</th>
                                                <th className="p-4 border-b border-gray-100">رقم الهوية</th>
                                                <th className="p-4 border-b border-gray-100">تاريخ الميلاد</th>
                                                <th className="p-4 border-b border-gray-100">ملاحظات</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {delegates.map((d) => (
                                                <tr key={d.delegate_id} className="hover:bg-gray-50 transition">
                                                    <td className="p-4 font-bold text-gray-800">{d.name}</td>
                                                    <td className="p-4 text-gray-600">{d.phone || '-'}</td>
                                                    <td className="p-4 text-gray-600">{d.nid || '-'}</td>
                                                    <td className="p-4 text-gray-600">{d.dob || '-'}</td>
                                                    <td className="p-4 text-gray-600 max-w-xs truncate">{d.notes || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowExportModal(false)}
                                    className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={() => {
                                        handleExportDelegates();
                                        setShowExportModal(false);
                                    }}
                                    className="px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition flex items-center gap-2 shadow-lg shadow-green-200"
                                >
                                    <Download className="h-5 w-5" />
                                    تحميل ملف Excel
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Camp Export Preview Modal */}
            <AnimatePresence>
                {showCampExportModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
                        >
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className="bg-green-100 p-2 rounded-lg">
                                        <Download className="h-6 w-6 text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-xl text-gray-800">تصدير سجل المخيمات</h3>
                                        <p className="text-sm text-gray-500">معاينة البيانات قبل التصدير</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowCampExportModal(false)}
                                    className="p-2 bg-white rounded-full hover:bg-gray-100 transition"
                                >
                                    <X className="h-5 w-5 text-gray-500" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-auto p-6">
                                <div className="border border-gray-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-right">
                                        <thead className="bg-gray-50 text-gray-600 font-bold text-sm">
                                            <tr>
                                                <th className="p-4 border-b border-gray-100">اسم المخيم / المنطقة</th>
                                                <th className="p-4 border-b border-gray-100">اسم المسؤول</th>
                                                <th className="p-4 border-b border-gray-100">رقم التواصل</th>
                                                <th className="p-4 border-b border-gray-100">رقم الهوية</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {camps.map((c) => (
                                                <tr key={c.camp_id} className="hover:bg-gray-50 transition">
                                                    <td className="p-4 font-bold text-gray-800">{c.name}</td>
                                                    <td className="p-4 text-gray-600">{c.manager_name || '-'}</td>
                                                    <td className="p-4 text-gray-600">{c.manager_phone || '-'}</td>
                                                    <td className="p-4 text-gray-600">{c.manager_nid || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowCampExportModal(false)}
                                    className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={() => {
                                        handleExportCamps();
                                        setShowCampExportModal(false);
                                    }}
                                    className="px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition flex items-center gap-2 shadow-lg shadow-green-200"
                                >
                                    <Download className="h-5 w-5" />
                                    تحميل ملف Excel
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delegate Modal */}
            <AnimatePresence>
                {showDelegateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
                        >
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h3 className="font-bold text-xl text-gray-800">
                                    {editingDelegate ? 'تعديل بيانات المفوض' : 'إضافة مفوض جديد'}
                                </h3>
                                <button
                                    onClick={() => setShowDelegateModal(false)}
                                    className="p-2 bg-white rounded-full hover:bg-gray-100 transition"
                                >
                                    <X className="h-5 w-5 text-gray-500" />
                                </button>
                            </div>

                            <form onSubmit={handleAddDelegate} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">الاسم رباعي <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={newDelegate.name}
                                        onChange={(e) => setNewDelegate({ ...newDelegate, name: e.target.value })}
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="اسم المفوض..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">رقم التواصل</label>
                                        <input
                                            type="text"
                                            value={newDelegate.phone || ''}
                                            onChange={(e) => setNewDelegate({ ...newDelegate, phone: e.target.value })}
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="059..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">رقم الهوية</label>
                                        <input
                                            type="text"
                                            value={newDelegate.nid || ''}
                                            onChange={(e) => setNewDelegate({ ...newDelegate, nid: e.target.value })}
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="رقم الهوية..."
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">تاريخ الميلاد</label>
                                    <input
                                        type="date"
                                        value={newDelegate.dob || ''}
                                        onChange={(e) => setNewDelegate({ ...newDelegate, dob: e.target.value })}
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات</label>
                                    <textarea
                                        value={newDelegate.notes || ''}
                                        onChange={(e) => setNewDelegate({ ...newDelegate, notes: e.target.value })}
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                                        placeholder="ملاحظات إضافية..."
                                    />
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowDelegateModal(false)}
                                        className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition"
                                    >
                                        إلغاء
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition"
                                    >
                                        {editingDelegate ? 'حفظ التعديلات' : 'إضافة'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* User Signup Modal */}
            <AnimatePresence>
                {showUserModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
                        >
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h3 className="font-bold text-xl text-gray-800">
                                    {editingUser ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowUserModal(false);
                                        setEditingUser(null);
                                    }}
                                    className="p-2 bg-white rounded-full hover:bg-gray-100 transition"
                                >
                                    <X className="h-5 w-5 text-gray-500" />
                                </button>
                            </div>

                            <form onSubmit={handleRegisterUser} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">اسم الحساب (للعرض) <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={newUser.fullName}
                                        onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="مثال: أحمد محمد"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">اسم المستخدم / الرقم (للدخول) <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={newUser.username}
                                        onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="مثلاً: 1234 أو ahmad"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">هذا هو المعرف الذي سيستخدمه المستخدم عند تسجيل الدخول.</p>
                                </div>

                                {/* كلمة المرور - إلزامية عند الإنشاء، اختيارية عند التعديل */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">
                                        كلمة المرور
                                        {!editingUser && <span className="text-red-500">*</span>}
                                        {editingUser && <span className="text-gray-500 text-xs font-normal"> (اختياري - اتركه فارغاً للإبقاء على القديمة)</span>}
                                    </label>
                                    <input
                                        type="text"
                                        required={!editingUser}
                                        minLength={6}
                                        value={newUser.password}
                                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder={editingUser ? "اتركه فارغاً إذا لا تريد تغييره" : "******"}
                                    />
                                    {!editingUser && <p className="text-xs text-gray-500 mt-1">كلمة المرور يجب أن تكون 6 أحرف على الأقل</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">نوع الحساب</label>
                                    <select
                                        value={newUser.role}
                                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value, camp_id: '', assigned_camps: [] })}
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="user">مدير مخيم (مخيم واحد فقط)</option>
                                        <option value="supervisor">مشرف (عدة مخيمات)</option>
                                        <option value="admin">أدمن (مدير عام)</option>
                                        <option value="system_admin">مسؤول نظام (صلاحيات كاملة)</option>
                                    </select>
                                </div>

                                {newUser.role === 'user' && (
                                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                                        <label className="block text-sm font-bold text-gray-700 mb-1">تحديد المخيم <span className="text-red-500">*</span></label>
                                        <select
                                            value={newUser.camp_id}
                                            onChange={(e) => setNewUser({ ...newUser, camp_id: e.target.value })}
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                            required
                                        >
                                            <option value="">-- اختر المخيم --</option>
                                            {camps.map(camp => (
                                                <option key={camp.camp_id} value={camp.camp_id}>{camp.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-yellow-700 mt-2">
                                            سيمكن لهذا المستخدم رؤية وإدارة بيانات هذا المخيم فقط.
                                        </p>
                                    </div>
                                )}

                                {newUser.role === 'supervisor' && (
                                    <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">تحديد المخيمات المسموحة <span className="text-red-500">*</span></label>
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {camps.map(camp => (
                                                <label key={camp.camp_id} className="flex items-center gap-3 p-2 hover:bg-green-100 rounded-lg cursor-pointer transition">
                                                    <input
                                                        type="checkbox"
                                                        checked={newUser.assigned_camps.includes(camp.camp_id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setNewUser({ ...newUser, assigned_camps: [...newUser.assigned_camps, camp.camp_id] });
                                                            } else {
                                                                setNewUser({ ...newUser, assigned_camps: newUser.assigned_camps.filter(id => id !== camp.camp_id) });
                                                            }
                                                        }}
                                                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                                    />
                                                    <span className="text-sm text-gray-700">{camp.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                        <p className="text-xs text-green-700 mt-2">
                                            المشرف سيمكنه رؤية وإدارة المخيمات المحددة فقط، ويمكنه التبديل بينها.
                                        </p>
                                    </div>
                                )}

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowUserModal(false)}
                                        className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition"
                                    >
                                        إلغاء
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition"
                                    >
                                        {editingUser ? 'حفظ التعديلات' : 'إنشاء المستخدم'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Camp Modal */}
            <AnimatePresence>
                {showCampModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
                        >
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h3 className="font-bold text-xl text-gray-800">
                                    {editingCamp ? 'تعديل بيانات المخيم' : 'إضافة مخيم جديد'}
                                </h3>
                                <button
                                    onClick={() => setShowCampModal(false)}
                                    className="p-2 bg-white rounded-full hover:bg-gray-100 transition"
                                >
                                    <X className="h-5 w-5 text-gray-500" />
                                </button>
                            </div>

                            <form onSubmit={handleAddCamp} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">اسم المخيم / المنطقة <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={newCamp.name}
                                        onChange={(e) => setNewCamp({ ...newCamp, name: e.target.value })}
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="اسم المخيم..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">اسم المسؤول</label>
                                    <input
                                        type="text"
                                        value={newCamp.manager_name || ''}
                                        onChange={(e) => setNewCamp({ ...newCamp, manager_name: e.target.value })}
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="اسم مسؤول المخيم..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">رقم التواصل</label>
                                        <input
                                            type="text"
                                            value={newCamp.manager_phone || ''}
                                            onChange={(e) => setNewCamp({ ...newCamp, manager_phone: e.target.value })}
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="059..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">رقم الهوية</label>
                                        <input
                                            type="text"
                                            value={newCamp.manager_nid || ''}
                                            onChange={(e) => setNewCamp({ ...newCamp, manager_nid: e.target.value })}
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="رقم الهوية..."
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowCampModal(false)}
                                        className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition"
                                    >
                                        إلغاء
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition"
                                    >
                                        {editingCamp ? 'حفظ التعديلات' : 'إضافة'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
