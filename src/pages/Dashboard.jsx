import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, Search, Baby } from 'lucide-react';
import { getAllFamilies, getAllIndividuals } from '../lib/db';
import { useCamp } from '../context/CampContext';
import { motion } from 'framer-motion';

export default function Dashboard() {
    const { selectedCamp } = useCamp();
    const [stats, setStats] = useState({
        active: {
            families: 0,
            individuals: 0,
            males: 0,
            females: 0,
            pregnant: 0,
            nursing: 0,
            infants: 0
        },
        departed: {
            families: 0,
            individuals: 0,
            males: 0,
            females: 0,
            pregnant: 0,
            nursing: 0,
            infants: 0
        }
    });
    const [loading, setLoading] = useState(true);

    async function fetchStats() {
        if (!selectedCamp) return;
        try {
            setLoading(true);

            // Get all families and individuals
            const families = await getAllFamilies(selectedCamp.camp_id);
            const individuals = await getAllIndividuals(selectedCamp.camp_id);

            // Initialize counters
            const newStats = {
                active: { families: 0, individuals: 0, males: 0, females: 0, pregnant: 0, nursing: 0, infants: 0 },
                departed: { families: 0, individuals: 0, males: 0, females: 0, pregnant: 0, nursing: 0, infants: 0 }
            };

            const activeNursingFamilies = new Set();
            const departedNursingFamilies = new Set();

            // 1. Process Families
            const familyStatusMap = new Map(); // family_id -> is_departed
            families.forEach(fam => {
                familyStatusMap.set(fam.family_id, fam.is_departed);
                if (fam.is_departed) {
                    newStats.departed.families++;
                } else {
                    newStats.active.families++;
                }
            });

            // 2. Process Individuals
            const calculateAge = (dob) => {
                if (!dob) return 100; // Treat as adult if no DOB
                const diff = Date.now() - new Date(dob).getTime();
                const ageDate = new Date(diff);
                return Math.abs(ageDate.getUTCFullYear() - 1970);
            };

            individuals.forEach(ind => {
                const isDeparted = familyStatusMap.get(ind.family_id);
                const targetStats = isDeparted ? newStats.departed : newStats.active;
                const targetNursingSet = isDeparted ? departedNursingFamilies : activeNursingFamilies;

                targetStats.individuals++;

                // Gender
                if (ind.gender === 'male') {
                    targetStats.males++;
                } else if (ind.gender === 'female') {
                    targetStats.females++;
                }

                // Health stats
                if (ind.is_pregnant) targetStats.pregnant++;

                // Nursing & Infants
                const age = calculateAge(ind.dob);
                if (age < 2) {
                    targetStats.infants++;
                    targetNursingSet.add(ind.family_id);
                }
            });

            newStats.active.nursing = activeNursingFamilies.size;
            newStats.departed.nursing = departedNursingFamilies.size;

            setStats(newStats);

        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (selectedCamp) {
            fetchStats();
        } else {
            setLoading(false);
        }
    }, [selectedCamp]);

    const cards = [
        {
            title: 'سجل العائلات',
            desc: 'عرض قائمة العائلات الأساسية',
            icon: Users,
            link: '/families',
            color: 'bg-blue-600',
        },
        {
            title: 'إدخال بيانات',
            desc: 'إضافة عائلة جديدة وأفرادها',
            icon: UserPlus,
            link: '/entry',
            color: 'bg-indigo-500',
        },
        {
            title: 'بحث وتقارير',
            desc: 'الاستعلام عن البيانات وتصديرها',
            icon: Search,
            link: '/search',
            color: 'bg-emerald-500',
        },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">جاري تحميل الإحصائيات...</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-8">لوحة التحكم</h1>

            {/* Stats Section */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 mb-12">

                {/* Families Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 md:p-6 rounded-2xl shadow-lg border border-white/10"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                            <p className="text-blue-100 text-[10px] md:text-sm mb-1">العائلات (نشط)</p>
                            <h3 className="text-2xl md:text-4xl font-black">{stats.active.families}</h3>
                            {stats.departed.families > 0 && (
                                <p className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full inline-block mt-1 font-bold">
                                    + {stats.departed.families} مغادرات
                                </p>
                            )}
                        </div>
                        <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-md self-end md:self-center">
                            <Users className="h-5 w-5 md:h-8 md:w-8" />
                        </div>
                    </div>
                </motion.div>

                {/* Individuals Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 md:p-6 rounded-2xl shadow-lg border border-white/10"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                            <p className="text-purple-100 text-[10px] md:text-sm mb-1">الأفراد (نشط)</p>
                            <h3 className="text-2xl md:text-4xl font-black">{stats.active.individuals}</h3>
                            {stats.departed.individuals > 0 && (
                                <p className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full inline-block mt-1 font-bold">
                                    + {stats.departed.individuals} مغادرات
                                </p>
                            )}
                        </div>
                        <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-md self-end md:self-center">
                            <Users className="h-5 w-5 md:h-8 md:w-8" />
                        </div>
                    </div>
                </motion.div>

                {/* Gender Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-4 md:p-6 rounded-2xl shadow-lg border border-white/10"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                            <p className="text-emerald-100 text-[10px] md:text-sm mb-1">الذكور / الإناث</p>
                            <h3 className="text-xl md:text-4xl font-black">{stats.active.males} / {stats.active.females}</h3>
                            <p className="text-[9px] text-emerald-100 mt-1 font-bold opacity-80">نشط حالياً</p>
                        </div>
                        <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-md self-end md:self-center">
                            <div className="flex">
                                <Users className="h-5 w-5 md:h-8 md:w-8" />
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Pregnant Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gradient-to-br from-rose-500 to-rose-600 text-white p-4 md:p-6 rounded-2xl shadow-lg border border-white/10"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                            <p className="text-rose-100 text-[10px] md:text-sm mb-1">الحوامل (نشط)</p>
                            <h3 className="text-2xl md:text-4xl font-black">{stats.active.pregnant}</h3>
                        </div>
                        <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-md self-end md:self-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-8 md:w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 12h.01" />
                                <path d="M15 12h.01" />
                                <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
                                <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.7 9 9 0 0 1-1.8 3.9" />
                                <path d="M5 6.3a9 9 0 0 0-1.8 3.9 2 2 0 0 0 0 3.7 9 9 0 0 0 1.8 3.9" />
                            </svg>
                        </div>
                    </div>
                </motion.div>

                {/* Nursing Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-4 md:p-6 rounded-2xl shadow-lg border border-white/10"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                            <p className="text-amber-100 text-[10px] md:text-sm mb-1">المرضعات (نشط)</p>
                            <h3 className="text-2xl md:text-4xl font-black">{stats.active.nursing}</h3>
                        </div>
                        <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-md self-end md:self-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-8 md:w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8 2h8" />
                                <path d="M9 2v2.7a3 3 0 0 1-2.2 2.9C5.4 8.2 5 9.3 5 10.4V22h14v-9.6c0-1.2.6-2.3 1.7-2.9A3 3 0 0 1 15 4.7V2" />
                                <path d="M7 15h10" />
                            </svg>
                        </div>
                    </div>
                </motion.div>

                {/* Infants Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white p-4 md:p-6 rounded-2xl shadow-lg border border-white/10"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                            <p className="text-cyan-100 text-[10px] md:text-sm mb-1">أطفال (أقل من عامين)</p>
                            <h3 className="text-2xl md:text-4xl font-black">{stats.active.infants}</h3>
                        </div>
                        <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-md self-end md:self-center">
                            <Baby className="h-5 w-5 md:h-8 md:w-8" />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Quick Actions */}
            <h2 className="text-xl font-bold text-gray-800 mb-6">الإجراءات السريعة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {cards.map((card, idx) => (
                    <Link to={card.link} key={idx}>
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            className={`${card.color} text-white p-8 rounded-2xl shadow-lg relative overflow-hidden group cursor-pointer`}
                        >
                            <div className="relative z-10">
                                <card.icon className="h-10 w-10 mb-4 opacity-90" />
                                <h3 className="text-2xl font-bold mb-2">{card.title}</h3>
                                <p className="opacity-80">{card.desc}</p>
                            </div>
                            <div className="absolute -bottom-4 -right-4 bg-white opacity-10 rounded-full w-32 h-32 blur-2xl group-hover:scale-150 transition-transform duration-500" />
                        </motion.div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
