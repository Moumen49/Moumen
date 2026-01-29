import React, { useEffect, useState } from 'react';
import { useCamp } from '../context/CampContext';
import { getAllFamilies, getAllIndividuals, findHeadOfFamily } from '../lib/db';
import './CardsPage.css';

const ITEMS_PER_PAGE = 27;

const WaveTop = () => (
    <div className="wave-top">
        <svg viewBox="0 0 500 100" preserveAspectRatio="none">
            <path d="M0,50 C150,100 350,0 500,50 L500,0 L0,0 Z"></path>
        </svg>
    </div>
);

const WaveBottom = () => (
    <div className="wave-bottom">
        <svg viewBox="0 0 500 100" preserveAspectRatio="none">
            <path d="M0,50 C150,0 350,100 500,50 L500,150 L0,150 Z"></path>
        </svg>
    </div>
);

const TentIcon = () => (
    <svg className="tent-watermark" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 22H22L12 2ZM12 6.8L19.5 20H4.5L12 6.8Z" />
    </svg>
);

export default function CardsPage() {
    const { selectedCamp, loading: campLoading } = useCamp();
    const [families, setFamilies] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (campLoading) return;

        if (selectedCamp) {
            loadData();
        } else {
            setLoading(false);
        }
    }, [selectedCamp, campLoading]);

    const loadData = async () => {
        setLoading(true);
        try {
            const allFamilies = await getAllFamilies(selectedCamp.camp_id);
            const allIndividuals = await getAllIndividuals(selectedCamp.camp_id);

            const processedData = allFamilies.map(fam => {
                const members = allIndividuals.filter(i => i.family_id === fam.family_id);
                const head = findHeadOfFamily(members);

                return {
                    ...fam,
                    headName: head ? head.name : 'غير مسجل',
                    headNid: head ? (head.nid || '-') : '-',
                    memberCount: members.length,
                    under_two_count: members.filter(m => {
                        if (!m.dob) return false;
                        const age = (new Date().getTime() - new Date(m.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
                        return age <= 2;
                    }).length
                };
            });

            processedData.sort((a, b) => (parseInt(a.family_number) || 0) - (parseInt(b.family_number) || 0));
            setFamilies(processedData);
        } catch (error) {
            console.error("Error loading cards data:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;
    if (!selectedCamp) return <div className="p-10 text-center">الرجاء اختيار مخيم</div>;

    // chunk families into pages
    const pages = [];
    for (let i = 0; i < families.length; i += ITEMS_PER_PAGE) {
        pages.push(families.slice(i, i + ITEMS_PER_PAGE));
    }

    return (
        <div style={{ background: '#e2e8f0', minHeight: '100vh', padding: '20px' }}>
            <div className="no-print flex justify-center p-3 sticky top-0 z-50 mb-5">
                <button
                    onClick={() => window.print()}
                    className="bg-red-600 text-white px-10 py-2 rounded font-black hover:bg-red-700 shadow-lg"
                >
                    🖨️ طباعة البطاقات النهائية
                </button>
            </div>

            {pages.map((pageData, pageIndex) => (
                <div key={pageIndex} className="page">
                    {pageData.map((family) => {
                        // Fallbacks matching SQL view or manual Logic
                        const headName = family.headName || 'غير مسجل';
                        const headNid = family.headNid || '-';
                        const contact = family.contact || '-';
                        const campName = selectedCamp.name;
                        const delegate = family.delegate || '-';
                        const memberCount = family.memberCount || 0;
                        const underTwo = family.under_two_count || 0;
                        const manager = selectedCamp.manager_name || "إدارة المخيم";

                        return (
                            <div key={family.family_id} className="card">
                                <WaveTop />
                                <TentIcon />

                                <div className="content-container">
                                    <div className="text-[12px] font-[900] text-red-700 border-b border-gray-100 pb-0.5 text-center truncate">
                                        {/* Name might be long, check truncation */}
                                        {headName}
                                    </div>

                                    <div className="space-y-1 mt-1">
                                        <div className="flex justify-center items-center gap-2 text-[10px] font-black text-slate-800">
                                            <div className="flex items-center gap-1">
                                                <span className="text-[7.5px] text-gray-400 font-bold">هوية:</span>
                                                <span>{headNid}</span>
                                            </div>
                                            <div className="h-3 w-[1px] bg-gray-300"></div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[7.5px] text-gray-400 font-bold">جوال:</span>
                                                <span dir="ltr">{contact}</span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center bg-gray-50/50 p-0.5 rounded px-1">
                                            <div className="flex items-center gap-1 truncate w-[48%]">
                                                <span className="text-[7.5px] font-bold text-indigo-400">المسؤول:</span>
                                                <span className="text-[8.5px] font-black text-indigo-900 truncate">{manager}</span>
                                            </div>
                                            <div className="h-3 w-[1px] bg-indigo-100 mx-1"></div>
                                            <div className="flex items-center gap-1 truncate w-[48%]">
                                                <span className="text-[7.5px] font-bold text-slate-400">المفوض:</span>
                                                <span className="text-[8.5px] font-black text-slate-700 truncate">{delegate}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-end pt-0.5 border-t border-gray-100">
                                        <div className="text-[8.5px] text-blue-900 font-black truncate max-w-[130px]">
                                            📍 {campName}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {underTwo > 0 && (
                                                <div className="flex items-center gap-1 bg-amber-50 border border-amber-300 px-1 rounded shadow-sm">
                                                    <span className="text-[9px]">👶</span>
                                                    <span className="text-[11px] font-black text-amber-700">{underTwo}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1 bg-indigo-950 text-white px-2 py-0.5 rounded shadow-sm">
                                                <span className="text-[7.5px] font-bold opacity-70">أفراد</span>
                                                <span className="text-[15px] font-black leading-none">{memberCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <WaveBottom />
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
