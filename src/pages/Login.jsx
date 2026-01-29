import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Lock, ArrowRight, UserPlus, AlertCircle } from 'lucide-react';

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState('user');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                await login(email, password); // Note: email state now holds username
                navigate('/');
            } else {
                if (password !== confirmPassword) {
                    setError('كلمات المرور غير متطابقة');
                    setLoading(false);
                    return;
                }
                if (password.length < 6) {
                    setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
                    setLoading(false);
                    return;
                }
                await register(email, password, { role });
                alert('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.');
                setIsLogin(true);
                setPassword('');
                setConfirmPassword('');
            }
        } catch (err) {
            console.error('Login Error Full Object:', err);
            setError(err.message || err.error_description || 'حدث خطأ غير متوقع. راجع وحدة التحكم (Console).');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4 relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        x: [0, 150, 0],
                        y: [0, -100, 0],
                        scale: [1, 1.4, 1],
                        rotate: [0, 180, 0]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-10 -right-10 w-[400px] h-[400px] bg-white/20 rounded-full blur-[80px]"
                />
                <motion.div
                    animate={{
                        x: [0, -200, 0],
                        y: [0, 150, 0],
                        scale: [1, 1.8, 1],
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute -bottom-20 -left-20 w-[600px] h-[600px] bg-indigo-300/30 rounded-full blur-[100px]"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.4, 0.7, 0.4],
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-1/3 left-1/4 w-80 h-80 bg-purple-300/30 rounded-full blur-[70px]"
                />
                <motion.div
                    animate={{
                        y: [0, -150, 0],
                        x: [0, 100, 0],
                    }}
                    transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-pink-300/30 rounded-full blur-[90px]"
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/95 backdrop-blur-lg p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10"
            >
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                            <img src="/favicon.png" alt="Logo" className="h-16 w-16 object-contain" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">نظام البيانات العائلية</h1>
                    <p className="text-gray-500 text-sm">
                        {isLogin ? 'قم بتسجيل الدخول للوصول إلى البيانات' : 'إنشاء حساب جديد'}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                        <p className="text-red-800 text-sm">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم / الرقم</label>
                        <div className="relative">
                            <User className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                placeholder="اسم المستخدم أو الرقم..."
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
                        <div className="relative">
                            <Lock className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>
                    </div>



                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <span>جاري التحميل...</span>
                        ) : (
                            <>
                                <>
                                    تسجيل الدخول <ArrowRight className="h-5 w-5" />
                                </>
                            </>
                        )}
                    </button>
                    <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white/95 text-gray-500">أو</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate('/check')}
                        className="w-full bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        <AlertCircle className="h-5 w-5" />
                        فحص حالة العائلة (زائر)
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-500">
                    <p>إذا لم يكن لديك حساب، يرجى التواصل مع مسؤول النظام.</p>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200">
                    <p className="text-center text-sm text-gray-500 mb-4">للمساعدة والاستفسارات</p>

                    <div className="grid grid-cols-2 gap-3">
                        {/* زر التواصل مع المسؤول */}
                        <a
                            href="https://wa.me/972595090192" // استبدل الرقم هنا برقم المسؤول
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center justify-center p-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl transition-colors group"
                        >
                            <div className="bg-green-500 text-white p-2 rounded-full mb-2 group-hover:scale-110 transition-transform">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                            </div>
                            <span className="text-xs font-bold text-green-800">مدير النظام</span>
                        </a>

                        {/* زر مجموعة الواتساب */}
                        <a
                            href="https://chat.whatsapp.com/LJxPetZJsrBGpqHD6u7zCU" // استبدل الرابط هنا برابط المجموعة
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center justify-center p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors group"
                        >
                            <div className="bg-blue-500 text-white p-2 rounded-full mb-2 group-hover:scale-110 transition-transform">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            </div>
                            <span className="text-xs font-bold text-blue-800">مجموعة الأخبار</span>
                        </a>
                    </div>

                    <div className="mt-6 text-center text-xs text-gray-400">
                        <p>الإصدار 1.2.0 | نظام إدارة بيانات الأسر</p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
