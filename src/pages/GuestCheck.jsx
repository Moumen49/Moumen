import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Search, Loader2, CheckCircle, XCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function GuestCheck() {
    const [nid, setNid] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null); // { status: 'found' | 'not_found' | 'error', data: ... }

    const handleCheck = async (e) => {
        e.preventDefault();
        if (!nid.trim()) return;

        setLoading(true);
        setResult(null);

        try {
            // استخدام دالة آمنة (RPC) يتم إنشاؤها في Supabase
            // هذه الدالة تضمن عدم كشف أي بيانات أخرى غير المطلوبة (المخيم والعدد)
            const { data, error } = await supabase
                .rpc('check_family_status', { search_nid: nid });

            if (error) throw error;

            if (!data || data.status === 'not_found') {
                setResult({ status: 'not_found' });
            } else {
                setResult({
                    status: 'found',
                    data: {
                        campName: data.campName,
                        memberCount: data.memberCount
                    }
                });
            }

        } catch (error) {
            console.error('Check error full:', error);
            // عرض تفاصيل الخطأ للمساعدة في التشخيص
            setResult({
                status: 'error',
                message: error.message + (error.details ? ` (${error.details})` : '') + (error.hint ? ` [Hint: ${error.hint}]` : '')
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4" dir="rtl">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="bg-indigo-600 p-6 text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        <ShieldCheck className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">نظام التحقق العائلي</h1>
                    <p className="text-indigo-100 text-sm">أدخل رقم هوية رب الأسرة للتحقق من التسجيل</p>
                </div>

                {/* Body */}
                <div className="p-8">
                    <form onSubmit={handleCheck} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهوية</label>
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={nid}
                                    onChange={(e) => setNid(e.target.value.replace(/\D/g, '').slice(0, 9))}
                                    className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-lg tracking-widest font-mono"
                                    placeholder="أدخل رقم الهوية (9 أرقام)"
                                    inputMode="numeric"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || nid.length < 9}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
                        >
                            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'تحقق الآن'}
                        </button>
                    </form>

                    {/* Results Area */}
                    <div className="mt-8">
                        {result?.status === 'found' && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center animate-in fade-in slide-in-from-bottom-4">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <CheckCircle className="h-6 w-6 text-green-600" />
                                </div>
                                <h3 className="text-lg font-bold text-green-800 mb-1">العائلة مسجلة</h3>
                                <div className="text-sm text-green-700 space-y-1">
                                    <p>المخيم: <strong>{result.data.campName}</strong></p>
                                    <p>عدد الأفراد: <strong>{result.data.memberCount}</strong></p>
                                </div>
                            </div>
                        )}

                        {result?.status === 'not_found' && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center animate-in fade-in slide-in-from-bottom-4">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <XCircle className="h-6 w-6 text-red-600" />
                                </div>
                                <h3 className="text-lg font-bold text-red-800 mb-1">العائلة غير موجودة</h3>
                                <p className="text-sm text-red-600">رقم الهوية المدخل غير مسجل في أي مخيم.</p>
                            </div>
                        )}

                        {result?.status === 'error' && (
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center animate-in fade-in slide-in-from-bottom-4" dir="ltr">
                                <p className="text-sm text-orange-800 font-bold mb-2">⚠️ Technical Error / خطأ تقني</p>
                                <p className="text-xs text-orange-700 font-mono break-all">{result.message}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 border-t p-4 text-center">
                    <Link to="/login" className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium group">
                        العودة لتسجيل الدخول
                        <ArrowRight className="mr-1 h-4 w-4 group-hover:-translate-x-1 transition" />
                    </Link>
                </div>
            </div>

            <footer className="mt-8 text-center text-gray-400 text-xs">
                &copy; {new Date().getFullYear()} جميع الحقوق محفوظة
            </footer>
        </div>
    );
}
