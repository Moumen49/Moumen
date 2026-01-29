import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFamily, getFamilyMembers, saveFamilyWithMembers, deleteFamily, getDelegates, checkNidExists } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Save, User, MapPin, ArrowRight, Pencil, UserX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EditFamily() {
    const { user } = useAuth();
    const { familyId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Family State
    const [familyNumber, setFamilyNumber] = useState('');
    const [familyAddress, setFamilyAddress] = useState('');
    const [familyPhone, setFamilyPhone] = useState('');
    const [alternativeMobile, setAlternativeMobile] = useState('');
    const [housingStatus, setHousingStatus] = useState('');
    const [familyNeeds, setFamilyNeeds] = useState('');
    const [familyDelegate, setFamilyDelegate] = useState('');

    const [delegates, setDelegates] = useState([]);

    // Individuals State
    const [members, setMembers] = useState([]);

    // Current Member Form State
    const [currentMember, setCurrentMember] = useState({
        name: '',
        nid: '',
        dob: '',
        role: 'son',
        healthNotes: '',
        isPregnant: false,
        isNursing: false,
        guardianGender: 'male',
        roleDescription: '', // For 'other'
        deceasedHusbandName: '', // For 'widow'
        husbandDeathDate: '',    // For 'widow'
        shoeSize: '',
        clothesSize: ''
    });

    const roles = [
        { value: 'husband', label: 'زوج' },
        { value: 'wife', label: 'زوجة' },
        { value: 'second_wife', label: 'زوجة ثانية' },
        { value: 'widow', label: 'أرملة' },
        { value: 'widower', label: 'أرمل' },
        { value: 'divorced', label: 'مطلقة' },
        { value: 'abandoned', label: 'مهجورة' },
        { value: 'guardian', label: 'وصي' },
        { value: 'son', label: 'ابن' },
        { value: 'daughter', label: 'ابنة' },
        { value: 'other', label: 'أخرى' }
    ];

    useEffect(() => {
        loadFamilyData();
    }, [familyId]);

    async function loadFamilyData() {
        try {
            const family = await getFamily(familyId);

            if (!family) {
                alert('العائلة غير موجودة');
                navigate('/families');
                return;
            }

            const delegatesList = await getDelegates();
            setDelegates(delegatesList);

            setFamilyNumber(family.family_number);
            setFamilyAddress(family.address || '');
            setFamilyPhone(family.contact || '');
            setAlternativeMobile(family.alternative_mobile || '');
            setHousingStatus(family.housing_status || '');
            setFamilyNeeds(family.family_needs || '');
            setFamilyDelegate(family.delegate || '');
            setIsDeparted(family.is_departed || false);

            const familyMembers = await getFamilyMembers(familyId);

            const membersData = familyMembers.map(ind => ({
                id: ind.individual_id,
                name: ind.name,
                nid: ind.nid || '',
                dob: ind.dob || '',
                role: ind.role,
                healthNotes: ind.notes || '',
                isPregnant: ind.is_pregnant || false,
                isNursing: ind.is_nursing || false,
                shoeSize: ind.shoe_size || '',
                clothesSize: ind.clothes_size || ''
            }));

            setMembers(membersData);
            setLoading(false);
        } catch (error) {
            console.error('Load error:', error);
            alert('خطأ في تحميل البيانات');
            navigate('/families');
        }
    }

    const [editingMemberId, setEditingMemberId] = useState(null);



    const handleAddMember = async () => {
        if (!currentMember.name || !currentMember.dob) {
            alert('يرجى إدخال الاسم وتاريخ الميلاد');
            return;
        }

        // NID Validation
        if (!currentMember.nid) {
            alert('رقم الهوية مطلوب');
            return;
        }

        if (currentMember.nid.length !== 9) {
            alert('رقم الهوية يجب أن يتكون من 9 أرقام');
            return;
        }

        // Check if used by ANOTHER member in current list
        const isLocalDup = members.some(m => m.nid === currentMember.nid && m.id !== editingMemberId);
        if (isLocalDup) {
            alert('رقم الهوية مستخدم بالفعل لفرد آخر في هذه العائلة');
            return;
        }

        // Check if used globally (in DB)
        // Skip check if we are editing an existing member and the NID hasn't changed
        const originalMember = editingMemberId ? members.find(m => m.id === editingMemberId) : null;
        const nidChanged = !originalMember || originalMember.nid !== currentMember.nid;

        if (nidChanged) {
            try {
                const exists = await checkNidExists(currentMember.nid);
                if (exists) {
                    alert('رقم الهوية هذا مسجل بالفعل لشخص آخر في النظام');
                    return;
                }
            } catch (error) {
                console.error("Error checking NID:", error);
                // Decide whether to block or warn. Blocking is safer.
                alert("تعذر التحقق من رقم الهوية، يرجى المحاولة مرة أخرى");
                return;
            }
        }

        if (editingMemberId) {
            // Update Existing
            setMembers(members.map(m => m.id === editingMemberId ? { ...currentMember, id: editingMemberId } : m));
            setEditingMemberId(null);
        } else {
            // Add New
            setMembers([...members, { ...currentMember, id: crypto.randomUUID(), isNew: true }]);
        }

        resetForm();
    };

    const handleEditMember = (member) => {
        setEditingMemberId(member.id);
        setCurrentMember({
            name: member.name,
            nid: member.nid || '',
            dob: member.dob,
            role: member.role,
            healthNotes: member.healthNotes || '',
            isPregnant: member.isPregnant || false,
            isNursing: member.isNursing || false,
            shoeSize: member.shoeSize || '',
            clothesSize: member.clothesSize || ''
        });
    };

    const cancelEdit = () => {
        setEditingMemberId(null);
        resetForm();
    };

    const resetForm = () => {
        setCurrentMember({
            name: '',
            nid: '',
            dob: '',
            role: 'son',
            healthNotes: '',
            isPregnant: false,
            isNursing: false,
            guardianGender: 'male',
            roleDescription: '',
            deceasedHusbandName: '',
            husbandDeathDate: '',
            shoeSize: '',
            clothesSize: ''
        });
    };

    const removeMember = (id) => {
        setMembers(members.filter(m => m.id !== id));
    };

    const handleSave = async () => {
        if (members.length === 0) {
            alert('الرجاء التأكد من وجود فرد واحد على الأقل');
            return;
        }

        setSaving(true);
        try {
            const familyData = {
                family_id: familyId,
                family_number: familyNumber,
                address: familyAddress,
                contact: familyPhone,
                alternative_mobile: alternativeMobile,
                housing_status: housingStatus,
                family_needs: familyNeeds,
                delegate: familyDelegate
            };

            const membersData = members.map(m => {
                // تحديد الجنس: إذا كان وصي، استخدم guardianGender، وإلا استخدم القائمة
                let gender;
                if (m.role === 'guardian') {
                    gender = m.guardianGender || 'male';
                } else {
                    gender = ['wife', 'second_wife', 'widow', 'daughter', 'divorced', 'abandoned'].includes(m.role) ? 'female' : 'male';
                }

                return {
                    individual_id: m.id,
                    name: m.name,
                    nid: m.nid || null,
                    dob: m.dob || null,
                    gender: gender,
                    role: m.role,
                    role_description: m.role === 'other' ? m.roleDescription : null,
                    deceased_husband_name: m.role === 'widow' ? m.deceasedHusbandName : null,
                    husband_death_date: m.role === 'widow' ? m.husbandDeathDate : null,
                    is_pregnant: m.isPregnant || false,
                    is_nursing: m.isNursing || false,
                    shoe_size: m.shoeSize || null,
                    clothes_size: m.clothesSize || null,
                    notes: m.healthNotes || null
                };
            });

            await saveFamilyWithMembers(familyData, membersData, user);

            alert('تم حفظ التعديلات بنجاح');
            navigate('/families');

        } catch (error) {
            console.error('Save error:', error);
            alert('حدث خطأ أثناء الحفظ: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showDepartedConfirm, setShowDepartedConfirm] = useState(false);
    const [isDeparted, setIsDeparted] = useState(false);

    const promptDelete = () => {
        setShowDeleteConfirm(true);
    };

    const promptMarkDeparted = () => {
        setShowDepartedConfirm(true);
    };

    const confirmMarkDeparted = async () => {
        if (!familyId) return;

        setShowDepartedConfirm(false);
        setSaving(true);

        try {
            const familyData = {
                family_id: familyId,
                family_number: familyNumber,
                address: familyAddress,
                contact: familyPhone,
                delegate: familyDelegate,
                is_departed: !isDeparted
            };

            const membersData = members.map(m => {
                const gender = ['wife', 'second_wife', 'widow', 'daughter', 'divorced', 'abandoned'].includes(m.role) ? 'female' : 'male';
                return {
                    individual_id: m.id,
                    name: m.name,
                    nid: m.nid || null,
                    dob: m.dob || null,
                    gender: gender,
                    role: m.role,
                    is_pregnant: m.isPregnant || false,
                    is_nursing: m.isNursing || false,
                    notes: m.healthNotes || null
                };
            });

            await saveFamilyWithMembers(familyData, membersData, user);

            setIsDeparted(!isDeparted);
            alert(isDeparted ? 'تم إلغاء وضع العائلة كمغادرة بنجاح' : 'تم وضع العائلة في قائمة المغادرين بنجاح');
        } catch (error) {
            console.error('Error marking departed:', error);
            alert('حدث خطأ أثناء التحديث: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const confirmDeleteFamily = async () => {
        if (!familyId) return;

        setShowDeleteConfirm(false);
        setLoading(true);

        try {
            await deleteFamily(familyId);

            alert('تم حذف العائلة بنجاح.');
            navigate('/families', { replace: true });
        } catch (error) {
            console.error("Delete Error:", error);
            alert('حدث خطأ أثناء الحذف: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-24 md:pb-10 px-4 md:px-0">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 md:gap-4 w-full">
                    <button onClick={() => navigate('/search')} className="bg-gray-100 p-2 md:p-3 rounded-full hover:bg-gray-200 transition">
                        <ArrowRight className="h-5 w-5 md:h-6 md:w-6" />
                    </button>
                    <h1 className="text-xl md:text-3xl font-bold text-gray-800 truncate">تعديل بيانات العائلة</h1>
                </div>
            </div>

            {/* Family Info Section */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-indigo-600" />
                    بيانات العائلة
                </h2>

                {/* We can display ID but preventing edit for simplicity to avoid collision checks here for now, or allow edit with complex logic */}
                <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm font-bold border border-blue-100">
                    تعديل العائلة رقم: {familyNumber}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">رقم العائلة</label>
                        <input
                            type="text"
                            value={familyNumber}
                            disabled
                            className="w-full p-2 border border-gray-200 bg-gray-50 text-gray-500 rounded-lg cursor-not-allowed"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                        <input
                            type="text"
                            value={familyAddress}
                            onChange={(e) => setFamilyAddress(e.target.value)}
                            disabled={!(user?.role === 'admin' || user?.role === 'manager')}
                            className={`w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${!(user?.role === 'admin' || user?.role === 'manager') ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">رقم التواصل</label>
                        <input
                            type="text"
                            value={familyPhone}
                            onChange={(e) => setFamilyPhone(e.target.value)}
                            disabled={!(user?.role === 'admin' || user?.role === 'manager')}
                            className={`w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${!(user?.role === 'admin' || user?.role === 'manager') ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">رقم جوال بديل</label>
                        <input
                            type="text"
                            value={alternativeMobile}
                            onChange={(e) => setAlternativeMobile(e.target.value)}
                            disabled={!(user?.role === 'admin' || user?.role === 'manager')}
                            className={`w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${!(user?.role === 'admin' || user?.role === 'manager') ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">حالة السكن</label>
                        <select
                            value={housingStatus} onChange={e => setHousingStatus(e.target.value)}
                            disabled={!(user?.role === 'admin' || user?.role === 'manager')}
                            className={`w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${!(user?.role === 'admin' || user?.role === 'manager') ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
                        >
                            <option value="">-- اختر --</option>
                            <option value="سيء">سيء</option>
                            <option value="جيد">جيد</option>
                            <option value="ممتاز">ممتاز</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">احتياجات الأسرة</label>
                        <input
                            type="text"
                            value={familyNeeds}
                            onChange={(e) => setFamilyNeeds(e.target.value)}
                            disabled={!(user?.role === 'admin' || user?.role === 'manager')}
                            className={`w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${!(user?.role === 'admin' || user?.role === 'manager') ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">المفوض / المربع</label>
                        <select
                            value={familyDelegate}
                            onChange={(e) => setFamilyDelegate(e.target.value)}
                            disabled={!(user?.role === 'admin' || user?.role === 'manager')}
                            className={`w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${!(user?.role === 'admin' || user?.role === 'manager') ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
                        >
                            <option value="">-- غير محدد --</option>
                            {delegates.map(d => (
                                <option key={d.delegate_id} value={d.name}>{d.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </section>

            {/* Member Entry Section - Admin Only */}
            {(user?.role === 'admin' || user?.role === 'manager') && (
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <User className="h-5 w-5 text-indigo-600" />
                        إضافة فرد جديد
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">الاسم</label>
                            <input
                                type="text"
                                value={currentMember.name}
                                onChange={(e) => setCurrentMember({ ...currentMember, name: e.target.value })}
                                className="w-full p-2 border border-gray-300 rounded-lg outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهوية</label>
                            <input
                                type="text"
                                value={currentMember.nid}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 9);
                                    setCurrentMember({ ...currentMember, nid: val });
                                }}
                                className="w-full p-2 border border-gray-300 rounded-lg outline-none font-mono tracking-widest"
                                placeholder="9 أرقام"
                                inputMode="numeric"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الميلاد</label>
                            <input
                                type="date"
                                value={currentMember.dob}
                                onChange={(e) => setCurrentMember({ ...currentMember, dob: e.target.value })}
                                className="w-full p-2 border border-gray-300 rounded-lg outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">الدور</label>
                            <select
                                value={currentMember.role}
                                onChange={(e) => setCurrentMember({ ...currentMember, role: e.target.value })}
                                className="w-full p-2 border border-gray-300 rounded-lg outline-none"
                            >
                                {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        {/* جنس الوصي */}
                        {currentMember.role === 'guardian' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">جنس الوصي *</label>
                                <select
                                    value={currentMember.guardianGender}
                                    onChange={(e) => setCurrentMember({ ...currentMember, guardianGender: e.target.value })}
                                    className="w-full p-2 border border-yellow-300 bg-yellow-50 rounded-lg outline-none"
                                >
                                    <option value="male">ذكر</option>
                                    <option value="female">أنثى</option>
                                </select>
                            </div>
                        )}
                        {/* وصف الأخرى */}
                        {currentMember.role === 'other' && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">وصف الصفة *</label>
                                <input
                                    type="text"
                                    value={currentMember.roleDescription}
                                    onChange={(e) => setCurrentMember({ ...currentMember, roleDescription: e.target.value })}
                                    className="w-full p-2 border border-yellow-300 bg-yellow-50 rounded-lg outline-none"
                                    placeholder="مثال: عم، عمة، خال، خالة..."
                                />
                            </div>
                        )}
                        {/* بيانات الأرملة */}
                        {currentMember.role === 'widow' && (
                            <div className="md:col-span-2 grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">اسم الزوج المتوفي</label>
                                    <input
                                        type="text"
                                        value={currentMember.deceasedHusbandName}
                                        onChange={(e) => setCurrentMember({ ...currentMember, deceasedHusbandName: e.target.value })}
                                        className="w-full p-2 border border-blue-200 bg-blue-50 rounded-lg outline-none"
                                        placeholder="الاسم الثلاثي"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الوفاة</label>
                                    <input
                                        type="date"
                                        value={currentMember.husbandDeathDate}
                                        onChange={(e) => setCurrentMember({ ...currentMember, husbandDeathDate: e.target.value })}
                                        className="w-full p-2 border border-blue-200 bg-blue-50 rounded-lg outline-none text-right"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">مقاس الحذاء</label>
                            <input
                                value={currentMember.shoeSize} onChange={e => setCurrentMember({ ...currentMember, shoeSize: e.target.value })}
                                placeholder="مثال: 42"
                                className="w-full p-2 border border-gray-300 rounded-lg outline-none"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">مقاس الملابس</label>
                            <input
                                value={currentMember.clothesSize} onChange={e => setCurrentMember({ ...currentMember, clothesSize: e.target.value })}
                                placeholder="مثال: XL"
                                className="w-full p-2 border border-gray-300 rounded-lg outline-none"
                            />
                        </div>

                        <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات صحية</label>
                            <input
                                type="text"
                                value={currentMember.healthNotes}
                                onChange={(e) => setCurrentMember({ ...currentMember, healthNotes: e.target.value })}
                                className="w-full p-2 border border-gray-300 rounded-lg outline-none"
                                placeholder="ملاحظات..."
                            />
                        </div>
                        {/* Conditional Fields for Women */}
                        {['wife', 'second_wife', 'daughter', 'widow', 'divorced', 'abandoned'].includes(currentMember.role) && (
                            <div className="md:col-span-3 flex gap-6 p-3 bg-pink-50 rounded-lg border border-pink-100">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={currentMember.isPregnant}
                                        onChange={(e) => setCurrentMember({ ...currentMember, isPregnant: e.target.checked })}
                                        className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">حامل؟</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={currentMember.isNursing}
                                        onChange={(e) => setCurrentMember({ ...currentMember, isNursing: e.target.checked })}
                                        className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">مرضع؟</span>
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleAddMember}
                            className={`w-full text-white px-6 py-2 rounded-lg transition flex items-center justify-center gap-2 ${editingMemberId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-900 hover:bg-gray-800'}`}
                        >
                            {editingMemberId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            {editingMemberId ? 'حفظ تعديلات الفرد' : 'إضافة الفرد'}
                        </button>
                        {editingMemberId && (
                            <button
                                onClick={cancelEdit}
                                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                            >
                                إلغاء
                            </button>
                        )}
                    </div>
                </section>
            )}

            {/* Members List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <h3 className="font-semibold text-gray-700 p-4 bg-gray-50 border-b">أفراد العائلة الحاليين</h3>
                <table className="w-full text-right">
                    <thead className="text-xs text-gray-500 bg-gray-50 uppercase border-b">
                        <tr>
                            <th className="px-6 py-3">الاسم</th>
                            <th className="px-6 py-3">الدور</th>
                            {(user?.role === 'admin' || user?.role === 'manager') && (
                                <>
                                    <th className="px-6 py-3">تعديل</th>
                                    <th className="px-6 py-3">حذف</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {members.map((m) => (
                            <tr key={m.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">{m.name}</td>
                                <td className="px-6 py-4">
                                    {roles.find(r => r.value === m.role)?.label || m.role}
                                </td>
                                {(user?.role === 'admin' || user?.role === 'manager') && (
                                    <>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleEditMember(m)}
                                                className="text-indigo-600 hover:text-indigo-800 p-1 hover:bg-indigo-50 rounded-full font-bold text-sm"
                                            >
                                                تعديل
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => removeMember(m.id)}
                                                className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-full"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Final Actions */}
            {/* Final Actions - Admin Only */}
            {(user?.role === 'admin' || user?.role === 'manager') && (
                <div className="flex flex-col md:flex-row justify-between pt-4 gap-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={promptDelete}
                            className="bg-red-50 text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-100 transition flex items-center justify-center gap-2"
                        >
                            <Trash2 className="h-5 w-5" />
                            حذف العائلة بالكامل
                        </button>

                        <button
                            type="button"
                            onClick={promptMarkDeparted}
                            className={`px-6 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 ${isDeparted
                                ? 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                                : 'bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200'
                                }`}
                        >
                            <UserX className="h-5 w-5" />
                            {isDeparted ? 'إلغاء المغادرة' : 'عائلة غادرت'}
                        </button>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving || members.length === 0}
                        className={`
                bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-700 transform transition md:hover:-translate-y-1 flex items-center justify-center gap-2
                ${(saving || members.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}
            `}
                    >
                        <Save className="h-5 w-5" />
                        {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                    </button>
                </div>
            )}

            {/* Custom Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                        onClick={() => setShowDeleteConfirm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3 text-red-600 mb-2">
                                <div className="bg-red-100 p-2 rounded-full">
                                    <Trash2 className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-bold">تأكيد الحذف النهائي</h3>
                            </div>

                            <p className="text-gray-600 leading-relaxed">
                                هل أنت متأكد تماماً من رغبتك في حذف العائلة رقم <span className="font-bold text-gray-900">{familyNumber}</span> وكافة أفرادها؟
                                <br />
                                <span className="text-red-500 font-bold text-sm mt-2 block">⚠️ لا يمكن التراجع عن هذا الإجراء.</span>
                            </p>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={confirmDeleteFamily}
                                    className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-bold hover:bg-red-700 transition shadow-lg shadow-red-200"
                                >
                                    نعم، احذف العائلة
                                </button>
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Departed Confirmation Modal */}
            <AnimatePresence>
                {showDepartedConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                        onClick={() => setShowDepartedConfirm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className={`flex items-center gap-3 mb-2 ${isDeparted ? 'text-green-600' : 'text-orange-600'}`}>
                                <div className={`p-2 rounded-full ${isDeparted ? 'bg-green-100' : 'bg-orange-100'}`}>
                                    <UserX className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-bold">
                                    {isDeparted ? 'تأكيد إلغاء المغادرة' : 'تأكيد المغادرة'}
                                </h3>
                            </div>

                            <p className="text-gray-600 leading-relaxed">
                                {isDeparted ? (
                                    <>
                                        هل أنت متأكد من رغبتك في إلغاء وضع العائلة رقم <span className="font-bold text-gray-900">{familyNumber}</span> كمغادرة؟
                                        <br />
                                        <span className="text-green-600 font-bold text-sm mt-2 block">✓ ستظهر هذه العائلة مرة أخرى في جميع القوائم والتقارير.</span>
                                    </>
                                ) : (
                                    <>
                                        هل أنت متأكد من رغبتك في وضع العائلة رقم <span className="font-bold text-gray-900">{familyNumber}</span> في قائمة المغادرين؟
                                        <br />
                                        <span className="text-orange-600 font-bold text-sm mt-2 block">⚠️ لن تظهر بيانات هذه العائلة في القوائم والتقارير إلا عند اختيار "المغادرين فقط".</span>
                                    </>
                                )}
                            </p>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={confirmMarkDeparted}
                                    className={`flex-1 text-white py-2.5 rounded-xl font-bold transition shadow-lg ${isDeparted
                                        ? 'bg-green-600 hover:bg-green-700 shadow-green-200'
                                        : 'bg-orange-600 hover:bg-orange-700 shadow-orange-200'
                                        }`}
                                >
                                    {isDeparted ? 'نعم، إلغاء المغادرة' : 'نعم، عائلة غادرت'}
                                </button>
                                <button
                                    onClick={() => setShowDepartedConfirm(false)}
                                    className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
