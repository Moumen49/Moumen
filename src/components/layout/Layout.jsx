import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCamp } from '../../context/CampContext';
import { getUnreadNotifications } from '../../lib/db';
import { Home, UserPlus, Search, LogOut, FileText, Users, Settings, ArrowUp, UserCheck, Package, Bell, Tent, ChevronDown, Database, Menu, X, WifiOff, Brain } from 'lucide-react';

export default function Layout({ children }) {
    const { user, logout } = useAuth();
    const { selectedCamp, camps, changeCamp, loading: campLoading } = useCamp();
    const navigate = useNavigate();
    const location = useLocation();
    const mainRef = useRef(null);
    const [showScroll, setShowScroll] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        const fetchNotifications = async () => {
            if (user?.role === 'admin' || user?.role === 'system_admin') {
                const unread = await getUnreadNotifications();
                setUnreadCount(unread.length);
            }
        };
        fetchNotifications();
    }, [user]);

    useEffect(() => {
        const handleScroll = () => {
            if (mainRef.current && mainRef.current.scrollTop > 300) {
                setShowScroll(true);
            } else {
                setShowScroll(false);
            }
        };

        const mainElement = mainRef.current;
        if (mainElement) {
            mainElement.addEventListener('scroll', handleScroll);
        }
        return () => mainElement?.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const navItems = [
        { name: 'الرئيسية', path: '/', icon: Home },
        { name: 'إدخال بيانات', path: '/entry', icon: UserPlus },
        { name: 'سجل العائلات', path: '/families', icon: Users },
        { name: 'إدخال بيانات الاستلام', path: '/aid-import', icon: Package },
        { name: 'بطاقة العائلة', path: '/family-profile', icon: UserCheck },
        { name: 'بحث وتقارير', path: '/search', icon: Search },
        { name: 'منشئ التقارير', path: '/custom-report', icon: Settings },
        { name: 'التقارير الذكية (AI)', path: '/smart-report', icon: Brain },
        { name: 'إدخال دون اتصال', path: '/offline', icon: WifiOff },
    ];

    if (user?.role === 'admin' || user?.role === 'system_admin') {
        navItems.push({ name: 'الإشعارات', path: '/notifications', icon: Bell, badge: unreadCount });
        navItems.push({ name: 'إعدادات النظام', path: '/settings', icon: Settings });
        navItems.push({ name: 'النسخ الاحتياطي', path: '/backup', icon: Database });
    } else if (user?.role === 'manager' || user?.role === 'user' || user?.role === 'supervisor') {
        // Show Settings for managers and supervisors to manage delegates
        navItems.push({ name: 'إدارة المفوضين', path: '/settings', icon: UserCheck });
    }

    const isSettingsPage = location.pathname === '/settings';
    const showCampWarning = !campLoading && !selectedCamp && !isSettingsPage && camps.length > 0;
    const showNoCampsWarning = !campLoading && camps.length === 0 && !isSettingsPage;

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50">
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 w-full bg-white z-40 px-4 py-3 shadow-sm flex items-center justify-between h-16">
                <div className="flex items-center gap-2">
                    <div className="bg-white p-0.5 rounded-lg">
                        <img src="/favicon.png" alt="Logo" className="h-7 w-7 object-contain" />
                    </div>
                    <span className="font-bold text-gray-800">نظام العائلة</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                    <Menu className="h-6 w-6" />
                </button>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar Navigation */}
            <nav className={`
                fixed inset-y-0 right-0 z-50 w-[85vw] max-w-xs bg-white shadow-2xl transform transition-transform duration-300 ease-in-out
                md:relative md:w-64 md:translate-x-0 md:shadow-lg md:flex md:flex-col md:justify-between md:shrink-0
                ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
                pt-4 md:pt-6 pb-4 px-3 md:px-4 flex flex-col justify-between overflow-y-auto h-full
            `}>
                <div>
                    {/* Close Button Mobile */}
                    <div className="md:hidden flex justify-end mb-2">
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-full transition"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="hidden md:flex items-center gap-3 px-2 mb-6">
                        <div className="bg-white p-1 rounded-lg shadow-sm border border-gray-100">
                            <img src="/favicon.png" alt="Logo" className="h-8 w-8 object-contain" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg text-gray-800">نظام العائلة</h2>
                            <p className="text-xs text-gray-500">مرحباً، {user?.fullName || user?.username}</p>
                        </div>
                    </div>

                    {/* Mobile User Info */}
                    <div className="md:hidden mb-4 px-2">
                        <p className="text-xs font-bold text-gray-800">مرحباً، {user?.fullName || user?.username}</p>
                    </div>

                    {/* Camp Selector */}
                    <div className="mb-6 px-1">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">المخيم / المنطقة الحالية</label>
                        <div className="relative">
                            <select
                                value={selectedCamp?.camp_id || ''}
                                onChange={(e) => {
                                    const c = camps.find(c => c.camp_id === e.target.value);
                                    changeCamp(c || null);
                                    setIsMobileMenuOpen(false); // Close menu on selection
                                }}
                                className="w-full appearance-none bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs md:text-sm rounded-xl px-2.5 md:px-3 py-2 md:py-2.5 font-bold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                            >
                                <option value="" disabled>-- اختر المخيم --</option>
                                {camps.map(camp => (
                                    <option key={camp.camp_id} value={camp.camp_id}>{camp.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 h-3.5 md:h-4 w-3.5 md:w-4 text-indigo-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    `flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl transition-all text-sm md:text-base ${isActive
                                        ? 'bg-indigo-50 text-indigo-700 shadow-sm font-medium'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                    }`
                                }
                            >
                                <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                                    <item.icon className="h-5 w-5 shrink-0" />
                                    <span className="truncate">{item.name}</span>
                                </div>
                                {item.badge > 0 && (
                                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
                                        {item.badge}
                                    </span>
                                )}
                            </NavLink>
                        ))}
                    </div>
                </div>

                <div className="mt-auto space-y-2 pt-6">
                    {/* Add Camp Prompt if empty */}
                    {camps.length === 0 && (user?.role === 'admin' || user?.role === 'system_admin') && (
                        <div className="bg-yellow-50 p-2.5 md:p-3 rounded-xl border border-yellow-200 text-xs text-yellow-800 mb-2">
                            <p className="font-bold mb-1">⚠️ تنبيه</p>
                            لا يوجد مخيمات مضافة. الرجاء إضافة مخيم من الإعدادات للبدء.
                        </div>
                    )}

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base text-red-600 hover:bg-red-50 hover:text-red-700 transition-all"
                    >
                        <LogOut className="h-5 w-5" />
                        <span className="font-medium">تسجيل الخروج</span>
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main ref={mainRef} className="flex-1 overflow-y-auto p-4 md:p-8 relative scroll-smooth pt-20 md:pt-8 w-full">
                {/* Camp Header Banner */}
                {selectedCamp && (
                    <div className="mb-6 flex items-center gap-2 text-indigo-900 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 w-fit">
                        <Tent className="h-5 w-5 text-indigo-600" />
                        <span className="font-bold">أنت الآن تتصفح بيانات:</span>
                        <span className="bg-white px-3 py-0.5 rounded-lg shadow-sm border border-indigo-100 font-black text-indigo-700">
                            {selectedCamp.name}
                        </span>
                    </div>
                )}

                {/* Blocking Warning Overlay if No Camp Selected */}
                {showCampWarning && (
                    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
                            <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                                <Tent className="h-8 w-8 text-indigo-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">الرجاء اختيار المخيم</h2>
                                <p className="text-gray-500">لمتابعة العمل، يجب عليك اختيار المخيم أو المنطقة التي تود عرض وإدارة بياناتها.</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block text-right">المخيم / المنطقة</label>
                                <div className="relative">
                                    <select
                                        value={selectedCamp?.camp_id || ''}
                                        onChange={(e) => {
                                            const c = camps.find(c => c.camp_id === e.target.value);
                                            changeCamp(c || null);
                                        }}
                                        className="w-full appearance-none bg-white border border-gray-300 text-gray-900 text-lg rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                    >
                                        <option value="" disabled>-- اختر من هنا --</option>
                                        {camps.map(camp => (
                                            <option key={camp.camp_id} value={camp.camp_id}>{camp.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Blocking Warning if NO CAMPS exist */}
                {showNoCampsWarning && (
                    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
                            <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                                <Settings className="h-8 w-8 text-yellow-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">إعداد النظام مطلوب</h2>
                                <p className="text-gray-500">
                                    يبدو أنك لم تقم بإضافة أي مخيمات بعد.
                                    <br />
                                    يجب إضافة مخيم واحد على الأقل للبدء.
                                </p>
                            </div>
                            <button
                                onClick={() => navigate('/settings')}
                                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition"
                            >
                                الذهاب للإعدادات لإضافة مخيم
                            </button>
                        </div>
                    </div>
                )}

                <div className="max-w-7xl mx-auto pb-24 md:pb-10">
                    {children}
                </div>

                {/* Mobile Bottom Navigation */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-100 px-6 py-2 flex justify-between items-center z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    {[
                        { icon: Home, path: '/', label: 'الرئيسية' },
                        { icon: UserPlus, path: '/entry', label: 'إضافة' },
                        { icon: Users, path: '/families', label: 'العائلات' },
                        { icon: Settings, path: '/custom-report', label: 'التقارير' },
                    ].map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-indigo-600' : 'text-gray-400'}`
                            }
                        >
                            <item.icon className="h-6 w-6" />
                            <span className="text-[10px] font-bold">{item.label}</span>
                        </NavLink>
                    ))}
                </div>

                {/* Scroll To Top Button (Shifted up for bottom nav) */}
                {showScroll && (
                    <button
                        onClick={scrollToTop}
                        className="fixed bottom-20 left-6 bg-indigo-600/90 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg transition-all animate-bounce hover:animate-none z-50 md:bottom-8 md:left-8 backdrop-blur-sm"
                        title="العودة للأعلى"
                    >
                        <ArrowUp className="h-6 w-6" />
                    </button>
                )}
            </main>
        </div>
    );
}
