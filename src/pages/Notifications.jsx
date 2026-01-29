import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUnreadNotifications, markNotificationAsRead, scanExistingFamiliesForDuplicates, deleteAllNotifications } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { Bell, Check, Clock, User, Eye, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Notifications() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadNotifications();
    }, []);

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const data = await getUnreadNotifications();
            setNotifications(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkRead = async (id) => {
        try {
            await markNotificationAsRead(id);
            setNotifications(notifications.filter(n => n.notification_id !== id));
        } catch (error) {
            console.error(error);
        }
    };

    const handleMarkAllRead = async () => {
        if (!window.confirm('هل تريد تحديد الكل كمقروء؟')) return;
        for (const n of notifications) {
            await markNotificationAsRead(n.notification_id);
        }
        setNotifications([]);
    };

    const [scanning, setScanning] = useState(false);

    const handleScanOldDuplicates = async () => {
        if (!window.confirm('هل تريد فحص جميع العائلات الموجودة للبحث عن تطابقات سابقة؟\n\nقد تستغرق هذه العملية بعض الوقت.')) {
            return;
        }

        setScanning(true);
        try {
            const result = await scanExistingFamiliesForDuplicates(user);

            if (result.success) {
                alert(`✅ تم الفحص بنجاح!\n\n` +
                    `• تم فحص جميع العائلات\n` +
                    `• عدد التطابقات المكتشفة: ${result.totalDuplicates}\n` +
                    `• عدد الإشعارات المرسلة: ${result.notificationsSent}`);

                // إعادة تحميل الإشعارات لعرض الجديدة
                await loadNotifications();
            }
        } catch (error) {
            console.error('Error scanning duplicates:', error);
            alert('حدث خطأ أثناء الفحص. الرجاء المحاولة مرة أخرى.');
        } finally {
            setScanning(false);
        }
    };

    const handleDeleteAll = async () => {
        if (!window.confirm('⚠️ هل أنت متأكد من حذف جميع الإشعارات؟\n\nلا يمكن التراجع عن هذا الإجراء!')) {
            return;
        }

        try {
            await deleteAllNotifications();
            setNotifications([]);
            alert('✅ تم حذف جميع الإشعارات بنجاح!');
        } catch (error) {
            console.error('Error deleting notifications:', error);
            alert('حدث خطأ أثناء الحذف. الرجاء المحاولة مرة أخرى.');
        }
    };


    if (!user || user.role !== 'admin') {
        return (
            <div className="p-10 text-center text-gray-500">
                غير مصرح لك بدخول هذه الصفحة
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-24 md:pb-10 px-4 md:px-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2.5 md:p-3 rounded-xl border border-indigo-200">
                        <Bell className="h-5 w-5 md:h-6 md:w-6 text-indigo-700" />
                    </div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-800">إشعارات النظام</h1>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <button
                        onClick={handleScanOldDuplicates}
                        disabled={scanning}
                        className="flex-1 md:flex-none text-[11px] md:text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 px-3 md:px-4 py-2.5 rounded-xl transition shadow-md shadow-orange-100 disabled:opacity-50"
                    >
                        {scanning ? 'جاري الفحص...' : '🔍 فحص التطابقات القديمة'}
                    </button>
                    {notifications.length > 0 && (
                        <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                            <button
                                onClick={handleMarkAllRead}
                                className="flex-1 md:flex-none text-[11px] md:text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 md:px-4 py-2.5 rounded-xl transition border border-indigo-100"
                            >
                                تحديد الكل كمقروء
                            </button>
                            <button
                                onClick={handleDeleteAll}
                                className="flex-1 md:flex-none text-[11px] md:text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-3 md:px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-red-100"
                            >
                                <Trash2 className="h-4 w-4" />
                                حذف الكل
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500">جاري التحميل...</div>
            ) : notifications.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl shadow-sm text-center border border-gray-100">
                    <div className="bg-gray-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Bell className="h-8 w-8 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-700">لا توجد إشعارات جديدة</h3>
                    <p className="text-gray-400 mt-2">جميع الإشعارات تمت قراءتها</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <AnimatePresence>
                        {notifications.map((notification) => (
                            <motion.div
                                key={notification.notification_id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100 flex gap-3 md:gap-4 items-start hover:shadow-md transition group"
                            >
                                <div className={`p-2.5 rounded-xl shrink-0 ${notification.type === 'alert' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {notification.type === 'alert' ? <User className="h-5 w-5" /> : <User className="h-5 w-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-gray-800 font-semibold text-sm md:text-lg leading-relaxed mb-1.5 md:mb-2">
                                        {notification.message}
                                    </p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] md:text-xs text-gray-500 font-medium">
                                        <span className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg">
                                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                                            {new Date(notification.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                                        </span>
                                        <span className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg">
                                            <User className="h-3.5 w-3.5 text-gray-400" />
                                            {notification.user_name}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col md:flex-row gap-2">
                                    {notification.link && (
                                        <button
                                            onClick={() => navigate(notification.link)}
                                            className="p-2.5 md:p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 bg-indigo-50 md:bg-transparent rounded-xl md:rounded-lg transition flex items-center justify-center"
                                            title="عرض التفاصيل"
                                        >
                                            <Eye className="h-5 w-5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleMarkRead(notification.notification_id)}
                                        className="p-2.5 md:p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 bg-gray-50 md:bg-transparent rounded-xl md:rounded-lg transition flex items-center justify-center"
                                        title="تحديد كمقروء"
                                    >
                                        <Check className="h-5 w-5" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
