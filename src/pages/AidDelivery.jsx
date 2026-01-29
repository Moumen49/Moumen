import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFamily, getFamilyAid, deleteFamilyAid } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { Package, Calendar, User, Trash2, ArrowRight } from 'lucide-react';

export default function AidDelivery() {
    const { user } = useAuth();
    const { familyId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [family, setFamily] = useState(null);
    const [aidHistory, setAidHistory] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadData();
    }, [familyId]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('Loading aid data for family:', familyId);
            const familyData = await getFamily(familyId);
            if (!familyData) {
                setError('العائلة غير موجودة');
                return;
            }
            setFamily(familyData);

            const aidData = await getFamilyAid(familyId);
            console.log('Loaded aid records:', aidData);

            // Sort by date desc
            if (Array.isArray(aidData)) {
                aidData.sort((a, b) => new Date(b.date) - new Date(a.date));
                setAidHistory(aidData);
            } else {
                setAidHistory([]);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            setError('حدث خطأ في تحميل البيانات. يرجى تحديث الصفحة.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('هل أنت متأكد من حذف هذا السجل؟')) return;
        try {
            await deleteFamilyAid(id);
            loadData();
        } catch (error) {
            console.error('Delete error', error);
            alert('خطأ في الحذف');
        }
    };

    if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;

    if (error) return (
        <div className="p-10 text-center">
            <div className="text-red-500 text-xl font-bold mb-4">{error}</div>
            <button onClick={() => navigate('/families')} className="text-indigo-600 hover:underline">
                العودة للقائمة
            </button>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 pb-24 md:pb-10 px-4 md:px-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2 md:mb-6">
                <div className="flex items-center gap-3 md:gap-4 w-full">
                    <button onClick={() => navigate('/families')} className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition shrink-0">
                        <ArrowRight className="h-5 w-5 md:h-6 md:w-6" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl md:text-3xl font-bold text-gray-800 truncate">سجل المساعدات</h1>
                        <p className="text-sm text-gray-500 mt-0.5 truncate bg-indigo-50/50 px-2 py-0.5 rounded-lg border border-indigo-100/50 inline-block">
                            عائلة رقم: <span className="font-bold text-indigo-600">{family.family_number}</span>
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto">
                {/* History List */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-bold text-gray-800">سجل الاستلامات السابق</h2>
                    </div>

                    {aidHistory.length === 0 ? (
                        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
                            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500 font-medium">لم يتم تسجيل أي مساعدات لهذه العائلة بعد</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {aidHistory.map((record) => (
                                <div key={record.delivery_id} className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-start md:items-center hover:shadow-md transition group">
                                    <div className="bg-indigo-50 p-2.5 md:p-3 rounded-xl shrink-0">
                                        <Package className="h-5 w-5 md:h-6 md:w-6 text-indigo-600" />
                                    </div>
                                    <div className="flex-1 min-w-0 w-full">
                                        <div className="flex flex-wrap items-center justify-between md:justify-start gap-2 mb-2">
                                            <span className="font-bold text-gray-800 text-base md:text-lg truncate">{record.items}</span>
                                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-[10px] md:text-xs font-medium flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {record.date}
                                            </span>
                                        </div>
                                        <div className="text-xs md:text-sm text-gray-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                                            <span className="flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                                المستلم: <span className="text-gray-700 font-medium">{record.recipient}</span>
                                            </span>
                                            {record.notes && (
                                                <span className="flex items-center gap-1.5 italic text-gray-400">
                                                    <span className="hidden md:inline">•</span>
                                                    {record.notes}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {user?.role === 'admin' && (
                                        <button
                                            onClick={() => handleDelete(record.delivery_id)}
                                            className="w-full md:w-auto mt-2 md:mt-0 text-red-400 hover:text-red-600 p-2.5 md:p-2 bg-red-50 md:bg-transparent rounded-xl md:rounded-lg transition flex items-center justify-center gap-2 md:opacity-0 md:group-hover:opacity-100"
                                            title="حذف السجل"
                                        >
                                            <Trash2 className="h-4 w-4 md:h-5 md:w-5" />
                                            <span className="md:hidden text-xs font-bold">حذف السجل</span>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
