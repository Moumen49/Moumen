import React, { useState } from 'react';
import { getAllFamilies, getAllIndividuals, findHeadOfFamily } from '../lib/db';
import { useCamp } from '../context/CampContext';
import FamilyCard from '../components/FamilyCard';
import { Search, Users, MapPin, Phone, Printer, ChevronDown, CheckSquare, Square, Eye } from 'lucide-react';

export default function FamilyProfile() {
    const { selectedCamp } = useCamp();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);

    // Single view state
    const [family, setFamily] = useState(null);
    const [members, setMembers] = useState([]);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [suggestions, setSuggestions] = useState([]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!selectedCamp) {
            alert('الرجاء اختيار المخيم أولاً');
            return;
        }
        if (!query.trim()) return;
        setLoading(true);
        setSuggestions([]);
        setFamily(null);

        try {
            const allFamilies = await getAllFamilies(selectedCamp.camp_id);
            const allIndividuals = await getAllIndividuals(selectedCamp.camp_id);

            const lowerQuery = query.toLowerCase();
            const exactFam = allFamilies.find(f => f.family_number?.toString() === lowerQuery);

            if (exactFam) {
                loadFamilyDetails(exactFam, allIndividuals);
            } else {
                const matches = [];
                for (const fam of allFamilies) {
                    const famMembers = allIndividuals.filter(i => i.family_id === fam.family_id);
                    const head = findHeadOfFamily(famMembers);
                    if (head && head.name.toLowerCase().includes(lowerQuery)) {
                        matches.push({ fam, headName: head.name });
                    }
                }

                if (matches.length === 1) {
                    loadFamilyDetails(matches[0].fam, allIndividuals);
                } else if (matches.length > 1) {
                    setSuggestions(matches);
                } else {
                    alert('لم يتم العثور على عائلة بهذا الرقم أو الاسم');
                }
            }
        } catch (error) {
            console.error('Search error:', error);
            alert('حدث خطأ في البحث');
        } finally {
            setLoading(false);
        }
    };

    const loadFamilyDetails = (fam, allInds) => {
        const famMembers = allInds.filter(i => i.family_id === fam.family_id);
        const sortedMembers = sortMembers(famMembers);
        setFamily(fam);
        setMembers(sortedMembers);
        setSuggestions([]);
    };

    const sortMembers = (mems) => {
        return mems.sort((a, b) => {
            const roleScore = (r) => {
                if (!r) return 5;
                const role = r.toLowerCase().trim();
                if (['husband', 'father', 'زوج', 'أب', 'اب'].includes(role)) return 1;
                if (['widow', 'أرملة', 'مطلقة', 'divorced', 'مهجورة', 'abandoned', 'وصي', 'guardian'].includes(role)) return 2;
                if (['wife', 'mother', 'زوجة', 'أم', 'ام', 'زوجة ثانية', 'second_wife'].includes(role)) return 3;
                if (['son', 'daughter', 'ابن', 'ابنة'].includes(role)) return 4;
                return 5;
            };
            return roleScore(a.role) - roleScore(b.role) || (new Date(a.dob || 0).getTime() - new Date(b.dob || 0).getTime());
        });
    };

    const openPrintTab = (mode) => {
        setIsMenuOpen(false);
        if (!selectedCamp) {
            alert('الرجاء اختيار المخيم أولاً');
            return;
        }

        // Define URL based on mode
        let url = `/print-cards?mode=${mode}`;
        if (mode === 'single') {
            if (!family) return;
            url = `/print-cards?mode=single&id=${family.family_id}`;
            // NOTE: 'single' id lookup needs to be handled in PrintFamilies or we pass filter logic
            // Actually PrintFamilies supports 'id' param now.
        }

        window.open(url, '_blank');
    };

    return (
        <div className="space-y-6 pb-20 md:pb-10 px-4 md:px-0">
            {/* Controls */}
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 md:mb-8">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-800">بطاقة العائلة</h1>
                    <div className="flex gap-2 relative w-full md:w-auto">
                        {selectedCamp && (
                            <div className="relative w-full md:w-auto">
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold transition shadow-sm text-sm"
                                    disabled={loading}
                                >
                                    <Printer className="h-4 w-4" />
                                    طباعة البطاقات
                                    <ChevronDown className="h-4 w-4" />
                                </button>

                                {isMenuOpen && (
                                    <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                                        {family && (
                                            <button
                                                onClick={() => openPrintTab('single')}
                                                className="w-full text-right px-4 py-3 hover:bg-gray-50 flex items-center justify-between text-sm"
                                            >
                                                <span>طباعة هذه العائلة</span>
                                                <Users className="h-3 w-3 text-gray-400" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => openPrintTab('active')}
                                            className="w-full text-right px-4 py-3 hover:bg-gray-50 flex items-center justify-between text-sm border-t"
                                        >
                                            <span>طباعة جميع العائلات النشطة</span>
                                            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 rounded-full">الكل</span>
                                        </button>
                                        <button
                                            onClick={() => openPrintTab('inactive')}
                                            className="w-full text-right px-4 py-3 hover:bg-gray-50 flex items-center justify-between text-sm border-t"
                                        >
                                            <span>طباعة العائلات المغادرة</span>
                                            <span className="bg-red-100 text-red-600 text-xs px-2 rounded-full">مغادرة</span>
                                        </button>
                                        <button
                                            onClick={() => openPrintTab('all')}
                                            className="w-full text-right px-4 py-3 hover:bg-gray-50 flex items-center justify-between text-sm border-t"
                                        >
                                            <span>طباعة الكل (نشط + مغادرة)</span>
                                            <span className="bg-gray-100 text-gray-600 text-xs px-2 rounded-full">جميع</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {isMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>}
                    </div>
                </div>

                <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
                    <input
                        type="text"
                        placeholder="ابحث برقم العائلة أو اسم رب الأسرة..."
                        className="w-full pl-12 pr-12 py-3 border-2 border-indigo-100 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />

                    {suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white mt-1 rounded-xl shadow-xl border border-gray-100 overflow-hidden text-right z-50 max-h-60 overflow-y-auto">
                            {suggestions.map((s, idx) => (
                                <button
                                    key={idx}
                                    onClick={async () => {
                                        const allInds = await getAllIndividuals(selectedCamp.camp_id);
                                        loadFamilyDetails(s.fam, allInds);
                                    }}
                                    className="w-full p-3 hover:bg-indigo-50 flex justify-between border-b last:border-0 text-sm transition-colors"
                                >
                                    <span className="font-bold">{s.headName}</span>
                                    <span className="text-gray-500">#{s.fam.family_number}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </form>
            </div>

            {/* Single Family Search Result View */}
            {family && (
                <div className="flex justify-center bg-gray-100 p-4 md:p-8 rounded-3xl overflow-auto">
                    <FamilyCard family={family} members={members} />
                </div>
            )}
        </div>
    );
}
