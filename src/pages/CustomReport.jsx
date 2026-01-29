import React, { useState, useEffect, useMemo } from 'react';
import { getAllFamilies, getAllIndividuals, getCamps, getDelegates, getAllAidDeliveries, findHeadOfFamily } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useCamp } from '../context/CampContext';
import * as XLSX from 'xlsx';
import {
    Settings,
    Download,
    Filter,
    CheckSquare,
    Square,
    ChevronDown,
    ChevronUp,
    Search,
    User,
    Users,
    Calendar,
    MapPin,
    Baby,
    Heart,
    Package,
    GripVertical,
    Check,
    Briefcase,
    Activity,
    Info
} from 'lucide-react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';

// Helper: Calculate Age accurately
const calculateAge = (dob) => {
    if (!dob) return 0;
    try {
        const birthDate = new Date(dob);
        if (isNaN(birthDate.getTime())) return 0;
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    } catch (e) {
        return 0;
    }
};

const translateRole = (role) => {
    const map = {
        husband: 'زوج',
        wife: 'زوجة',
        second_wife: 'زوجة ثانية',
        widow: 'أرملة',
        widower: 'أرمل',
        divorced: 'مطلقة',
        abandoned: 'مهجورة',
        guardian: 'وصي',
        son: 'ابن',
        daughter: 'ابنة',
        other: 'أخرى'
    };
    return map[role] || role;
};

const roleOptions = [
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

export default function CustomReport() {
    const { user } = useAuth();
    const { selectedCamp: contextCamp } = useCamp();

    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState([]);
    const [availableCamps, setAvailableCamps] = useState([]);
    const [allDelegatesRaw, setAllDelegatesRaw] = useState([]);
    const [aidOptions, setAidOptions] = useState([]);
    const [familyAidItemsMap, setFamilyAidItemsMap] = useState({});

    // Filter Logic States (Search Criteria)
    const [selectedCampIds, setSelectedCampIds] = useState([]);
    const [selectedRoles, setSelectedRoles] = useState([]);
    const [selectedDelegate, setSelectedDelegate] = useState('all');
    const [ageCategory, setAgeCategory] = useState('all');
    const [minAge, setMinAge] = useState('');
    const [maxAge, setMaxAge] = useState('');
    const [minMembers, setMinMembers] = useState('');
    const [maxMembers, setMaxMembers] = useState('');
    const [healthStatus, setHealthStatus] = useState('all');
    const [selectedAidItems, setSelectedAidItems] = useState([]);

    const delegatesList = useMemo(() => {
        if (selectedCampIds.length === 0) return [];
        const filtered = allDelegatesRaw.filter(d => selectedCampIds.includes(d.camp_id));
        return [...new Set(filtered.map(d => d.name))].filter(Boolean).sort();
    }, [allDelegatesRaw, selectedCampIds]);

    // Logic for "Show Entire Family"
    const [showAllFamilyMembers, setShowAllFamilyMembers] = useState(false);

    // Sub-filters for displayed members (when showAllFamilyMembers is true)
    const [displayFilterEnabled, setDisplayFilterEnabled] = useState(false);
    const [displayRoles, setDisplayRoles] = useState([]);
    const [displayMinAge, setDisplayMinAge] = useState('');
    const [displayMaxAge, setDisplayMaxAge] = useState('');

    // UI States
    const [showColumnSettings, setShowColumnSettings] = useState(false);
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    // Columns - Expanded as requested
    const [columns, setColumns] = useState([
        { key: 'display_family_number', label: 'رقم العائلة', visible: true },
        { key: 'name', label: 'الاسم', visible: true },
        { key: 'nid', label: 'الهوية', visible: true },
        { key: 'role_translated', label: 'الدور', visible: true },
        { key: 'age', label: 'العمر', visible: true },
        { key: 'member_count', label: 'أفراد العائلة', visible: true },
        { key: 'camp_name', label: 'المخيم', visible: false },
        { key: 'dob', label: 'تاريخ الميلاد', visible: false },
        { key: 'gender', label: 'الجنس', visible: false },
        { key: 'role_description', label: 'وصف أخرى', visible: false },
        { key: 'contact', label: 'رقم التواصل', visible: false },
        { key: 'alternative_mobile', label: 'رقم بديل', visible: false },
        { key: 'housing_status', label: 'حالة السكن', visible: false },
        { key: 'address', label: 'العنوان', visible: false },
        { key: 'delegate', label: 'المفوض', visible: false },
        { key: 'is_pregnant_label', label: 'حامل', visible: false },
        { key: 'is_nursing_label', label: 'مرضع', visible: false },
        { key: 'health_notes', label: 'ملاحظات صحية', visible: false },
        { key: 'shoe_size', label: 'قياس الحذاء', visible: false },
        { key: 'clothes_size', label: 'قياس الملابس', visible: false },
        { key: 'family_needs', label: 'الاحتياجات', visible: false },
        { key: 'head_name', label: 'رب الأسرة', visible: false },
        { key: 'head_nid', label: 'هوية رب الأسرة', visible: false },
        { key: 'spouse_name', label: 'اسم الشريك/الزوجة', visible: false },
        { key: 'spouse_nid', label: 'هوية الشريك', visible: false },
        { key: 'last_aid_info', label: 'آخر استلام للمساعدات', visible: false },
    ]);

    useEffect(() => {
        loadBaseData();
    }, []);

    const loadBaseData = async () => {
        setLoading(true);
        try {
            const [camps, delegates, deliveries] = await Promise.all([
                getCamps(),
                getDelegates(),
                getAllAidDeliveries()
            ]);
            setAvailableCamps(camps);
            setAllDelegatesRaw(delegates);

            const items = new Set();
            const fMap = {};
            deliveries.forEach(d => {
                if (d.items) {
                    const itList = d.items.split(/[،,]+/).map(s => s.trim()).filter(Boolean);
                    itList.forEach(it => items.add(it));
                    if (!fMap[d.family_id]) fMap[d.family_id] = { items: new Set(), lastDate: d.date, lastItems: d.items };
                    itList.forEach(it => fMap[d.family_id].items.add(it));
                    if (new Date(d.date) > new Date(fMap[d.family_id].lastDate)) {
                        fMap[d.family_id].lastDate = d.date;
                        fMap[d.family_id].lastItems = d.items;
                    }
                }
            });
            setAidOptions(Array.from(items).sort());
            setFamilyAidItemsMap(fMap);

            let initialCampIds = [];
            if (contextCamp) initialCampIds = [contextCamp.camp_id];
            else if (camps.length > 0) initialCampIds = [camps[0].camp_id];

            setSelectedCampIds(initialCampIds);
            await fetchData(initialCampIds, camps, fMap);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchData = async (campIds, campsRef = availableCamps, aidMap = familyAidItemsMap) => {
        setLoading(true);
        try {
            let families = [];
            let individuals = [];
            if (campIds.length === 0) { setRawData([]); return; }

            for (const cid of campIds) {
                const [f, i] = await Promise.all([getAllFamilies(cid), getAllIndividuals(cid)]);
                const camp = campsRef.find(c => c.camp_id === cid);
                f.forEach(fam => {
                    fam.camp_name = camp?.name || '-';
                    fam.display_family_number = campIds.length > 1 ? `${fam.camp_name} - ${fam.family_number}` : fam.family_number;
                });
                families.push(...f);
                individuals.push(...i);
            }

            const processed = individuals.map(ind => {
                const family = families.find(f => f.family_id === ind.family_id) || {};
                const members = individuals.filter(i => i.family_id === ind.family_id);
                const age = calculateAge(ind.dob);
                const aidRes = aidMap[ind.family_id];

                const headMember = findHeadOfFamily(members);
                const spouse = members.find(m => (m.role === 'wife' || m.role === 'husband' || m.role === 'second_wife') && m.individual_id !== headMember?.individual_id);

                return {
                    ...ind,
                    camp_name: family.camp_name,
                    family_number: family.family_number,
                    display_family_number: family.display_family_number,
                    member_count: members.length,
                    contact: family.contact,
                    alternative_mobile: family.alternative_mobile,
                    housing_status: family.housing_status,
                    address: family.address,
                    delegate: family.delegate,
                    family_needs: family.family_needs,
                    age,
                    is_female_head: ['أرملة', 'مطلقة', 'مهجورة', 'وصي', 'زوجة ثانية', 'أخرى'].includes(ind.role) || (ind.role === 'wife' && !members.some(m => m.role === 'husband')),
                    role_translated: translateRole(ind.role),
                    is_pregnant_label: ind.is_pregnant ? 'نعم' : 'لا',
                    is_nursing_label: members.some(m => calculateAge(m.dob) < 2) ? 'نعم' : 'لا',
                    head_name: headMember?.name || '-',
                    head_nid: headMember?.nid || '-',
                    spouse_name: spouse?.name || '-',
                    spouse_nid: spouse?.nid || '-',
                    last_aid_info: aidRes ? `${aidRes.lastItems} (${aidRes.lastDate})` : '-'
                };
            });
            setRawData(processed);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const filteredData = useMemo(() => {
        // 1. Identify "Matched" individuals first
        const matchedIndividuals = rawData.filter(item => {
            if (selectedRoles.length > 0 && !selectedRoles.includes(item.role)) return false;
            let ageVal = item.age;
            if (ageCategory === 'infant' && ageVal > 2) return false;
            if (ageCategory === 'child' && (ageVal < 2 || ageVal > 18)) return false;
            if (ageCategory === 'adult' && ageVal < 18) return false;
            if (minAge && ageVal < parseInt(minAge)) return false;
            if (maxAge && ageVal > parseInt(maxAge)) return false;
            if (healthStatus === 'pregnant' && !item.is_pregnant) return false;
            if (healthStatus === 'nursing' && !rawData.some(m => m.family_id === item.family_id && calculateAge(m.dob) < 2)) return false;
            if (healthStatus === 'female_head' && !item.is_female_head) return false;
            if (healthStatus === 'health_notes' && !item.health_notes) return false;
            if (selectedDelegate !== 'all' && item.delegate !== selectedDelegate) return false;
            if (minMembers && item.member_count < parseInt(minMembers)) return false;
            if (maxMembers && item.member_count > parseInt(maxMembers)) return false;
            if (selectedAidItems.length > 0) {
                const fItems = familyAidItemsMap[item.family_id];
                if (!fItems || !selectedAidItems.some(it => fItems.items.has(it))) return false;
            }
            return true;
        });

        const matchingFamilyIds = new Set(matchedIndividuals.map(i => i.family_id));

        // 2. Determine final list
        let result = [];
        if (showAllFamilyMembers) {
            // Get all members of matched families
            const candidates = rawData.filter(i => matchingFamilyIds.has(i.family_id));

            // Apply Display Filters (Sub-selection) if enabled
            if (displayFilterEnabled) {
                result = candidates.filter(item => {
                    if (displayRoles.length > 0 && !displayRoles.includes(item.role)) return false;
                    if (displayMinAge && item.age < parseInt(displayMinAge)) return false;
                    if (displayMaxAge && item.age > parseInt(displayMaxAge)) return false;
                    return true;
                });
            } else {
                result = candidates;
            }
        } else {
            result = matchedIndividuals;
        }

        // Sorting
        return result.sort((a, b) => {
            if (a.camp_name !== b.camp_name) return a.camp_name.localeCompare(b.camp_name, 'ar');
            return (parseInt(a.family_number) || 0) - (parseInt(b.family_number) || 0);
        });
    }, [rawData, selectedRoles, selectedDelegate, ageCategory, minAge, maxAge, minMembers, maxMembers, healthStatus, selectedAidItems, showAllFamilyMembers, displayFilterEnabled, displayRoles, displayMinAge, displayMaxAge, familyAidItemsMap]);

    const handleExport = () => {
        const visibleCols = columns.filter(c => c.visible);
        const data = filteredData.map(item => {
            const row = {};
            visibleCols.forEach(col => row[col.label] = item[col.key]);
            return row;
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "التقرير");
        XLSX.writeFile(wb, "custom_report.xlsx");
    };

    const toggleColumnVisibility = (key) => setColumns(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
    const toggleRole = (r, type = 'search') => {
        const setFn = type === 'search' ? setSelectedRoles : setDisplayRoles;
        setFn(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
    };

    const toggleCamp = (id) => {
        const next = selectedCampIds.includes(id)
            ? selectedCampIds.filter(x => x !== id)
            : [...selectedCampIds, id];
        setSelectedCampIds(next);
        fetchData(next);
    };

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-gray-50 text-right font-sans" dir="rtl">
            {/* Header */}
            <header className="bg-white border-b border-gray-100 p-3 md:p-4 flex flex-col md:flex-row justify-between items-center shadow-sm z-30 gap-4">
                <div className="flex items-center justify-between w-full md:w-auto">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="bg-indigo-50 p-2 rounded-xl">
                            <Settings className="h-4 w-4 md:h-5 md:w-5 text-indigo-600" />
                        </div>
                        <h1 className="text-lg md:text-xl font-black text-gray-800">منشئ التقارير المخصص</h1>
                    </div>
                    {/* Mobile Filter Toggle */}
                    <button
                        onClick={() => setShowMobileFilters(!showMobileFilters)}
                        className="md:hidden bg-indigo-50 text-indigo-600 p-2 rounded-lg"
                    >
                        <Filter className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex items-center justify-between w-full md:w-auto gap-4 md:gap-6">
                    <div className="flex flex-col items-end">
                        <span className="text-xs md:text-sm font-black text-indigo-600">النتائج المطابقة: {filteredData.length}</span>
                        <span className="text-[9px] md:text-[10px] text-gray-400 font-bold hidden md:block">إجمالي السجلات المحملة: {rawData.length}</span>
                    </div>
                    <button onClick={handleExport} className="bg-[#22c55e] hover:bg-green-600 text-white px-3 md:px-5 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 flex-1 md:flex-none justify-center">
                        <Download className="h-3 w-3 md:h-4 md:w-4" /> تصدير (Excel)
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Mobile Overlay */}
                {showMobileFilters && (
                    <div
                        className="fixed inset-0 bg-black/50 z-40 md:hidden"
                        onClick={() => setShowMobileFilters(false)}
                    ></div>
                )}

                {/* Right Sidebar Filters */}
                <aside className={`
                    fixed md:relative inset-y-0 right-0 z-50 md:z-auto
                    w-80 bg-white border-l border-gray-100 overflow-y-auto custom-scrollbar p-6 space-y-8
                    transform transition-transform duration-300 ease-in-out
                    ${showMobileFilters ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
                `}>
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="font-black text-gray-800 flex items-center gap-2 text-sm">
                            <Filter className="h-4 w-4 text-indigo-500" /> شروط جلب العائلات
                        </h2>
                        <button onClick={() => setShowMobileFilters(false)} className="md:hidden text-gray-400">
                            <ChevronUp className="h-5 w-5 rotate-90" />
                        </button>
                    </div>

                    {/* Camps Selection */}
                    <section>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">المخيمات المستهدفة</label>
                            <button onClick={() => { const all = availableCamps.map(c => c.camp_id); setSelectedCampIds(all); fetchData(all); }} className="text-[10px] text-indigo-600 underline font-bold">الكل</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-1 custom-scrollbar">
                            {availableCamps.map(camp => (
                                <label key={camp.camp_id} className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all cursor-pointer ${selectedCampIds.includes(camp.camp_id) ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-transparent hover:border-gray-200'}`}>
                                    <input type="checkbox" checked={selectedCampIds.includes(camp.camp_id)} onChange={() => toggleCamp(camp.camp_id)} className="h-3.5 w-3.5 text-indigo-600 rounded" />
                                    <span className="text-[10px] font-bold text-gray-600 truncate">{camp.name}</span>
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* Roles (Search) */}
                    <section>
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">الصفة المطلوبة في العائلات</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedRoles(['husband', 'second_wife', 'widow', 'widower', 'divorced', 'abandoned', 'guardian', 'other'])}
                                    className="text-[10px] text-indigo-600 underline font-bold"
                                >
                                    أرباب الأسر
                                </button>
                                <button
                                    onClick={() => setSelectedRoles([])}
                                    className="text-[10px] text-gray-400 underline font-bold"
                                >
                                    مسح
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-y-2">
                            {roleOptions.map(r => (
                                <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={selectedRoles.includes(r.value)} onChange={() => toggleRole(r.value, 'search')} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                                    <span className="text-xs font-bold text-gray-600">{r.label}</span>
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* Family Members Expansion & Selection Logic */}
                    <section className="space-y-4">
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-4 rounded-2xl border border-indigo-100 shadow-sm shadow-indigo-100/50">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${showAllFamilyMembers ? 'bg-indigo-600 text-white' : 'bg-white text-gray-300 border border-gray-100'}`}>
                                    <Users className="h-5 w-5" />
                                </div>
                                <div>
                                    <span className="text-xs font-black text-indigo-900 block">إظهار كافة أفراد العائلة</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <input type="checkbox" checked={showAllFamilyMembers} onChange={(e) => setShowAllFamilyMembers(e.target.checked)} className="h-4 w-4 rounded border-indigo-200 text-indigo-600" />
                                        <span className="text-[10px] text-indigo-500 font-bold">تفعيل العرض العائلي</span>
                                    </div>
                                </div>
                            </label>
                        </div>

                        {/* SUB-FILTERS (The requested fix) */}
                        <AnimatePresence>
                            {showAllFamilyMembers && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                    className="bg-white p-4 rounded-2xl border border-orange-100 shadow-sm border-dashed space-y-4"
                                >
                                    <div className="flex items-center gap-2 text-orange-600 mb-2">
                                        <Filter className="h-3 w-3" />
                                        <span className="text-[10px] font-black">فلترة الأفراد المعروضين من العائلة</span>
                                    </div>

                                    <label className="flex items-center gap-2 cursor-pointer py-1 border-b border-gray-50">
                                        <input type="checkbox" checked={displayFilterEnabled} onChange={(e) => setDisplayFilterEnabled(e.target.checked)} className="h-3.5 w-3.5 rounded text-orange-500" />
                                        <span className="text-[10px] font-bold text-gray-500">تخصيص الأفراد (عرض محدد فقط)</span>
                                    </label>

                                    {displayFilterEnabled && (
                                        <div className="space-y-4 pt-2">
                                            {/* Roles to display */}
                                            <div>
                                                <label className="text-[9px] font-black text-gray-400 block mb-2">عرض الأدوار التالية فقط:</label>
                                                <div className="grid grid-cols-2 gap-y-1.5">
                                                    {roleOptions.map(r => (
                                                        <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                                                            <input type="checkbox" checked={displayRoles.includes(r.value)} onChange={() => toggleRole(r.value, 'display')} className="h-3 w-3 rounded text-orange-500" />
                                                            <span className="text-[10px] font-bold text-gray-500">{r.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* Ages to display */}
                                            <div>
                                                <label className="text-[9px] font-black text-gray-400 block mb-2">بأعمار محددة فقط:</label>
                                                <div className="flex gap-2">
                                                    <input type="number" placeholder="من" value={displayMinAge} onChange={e => setDisplayMinAge(e.target.value)} className="w-full text-[10px] p-2 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:ring-1 focus:ring-orange-200" />
                                                    <input type="number" placeholder="إلى" value={displayMaxAge} onChange={e => setDisplayMaxAge(e.target.value)} className="w-full text-[10px] p-2 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:ring-1 focus:ring-orange-200" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </section>

                    {/* Age/Health & Others for Search */}
                    <section className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 block mb-1.5">العمر المستهدف</label>
                                <div className="flex gap-1">
                                    <input type="number" placeholder="من" value={minAge} onChange={e => setMinAge(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs" />
                                    <input type="number" placeholder="إلى" value={maxAge} onChange={e => setMaxAge(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 block mb-1.5">عدد الأفراد</label>
                                <div className="flex gap-1">
                                    <input type="number" placeholder="من" value={minMembers} onChange={e => setMinMembers(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs" />
                                    <input type="number" placeholder="إلى" value={maxMembers} onChange={e => setMaxMembers(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-gray-400 block mb-1.5">الحالة الصحية المستهدفة</label>
                            <select value={healthStatus} onChange={(e) => setHealthStatus(e.target.value)} className="w-full text-xs font-bold p-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none">
                                <option value="all">الكل</option>
                                <option value="pregnant">حوامل</option>
                                <option value="nursing">مرضعات (أطفال {'<'} 2)</option>
                                <option value="female_head">معيلات أسر</option>
                                <option value="health_notes">مرضى / ملاحظات صحية</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-gray-400 block mb-1.5">المفوض</label>
                            <select value={selectedDelegate} onChange={(e) => setSelectedDelegate(e.target.value)} className="w-full text-xs font-bold p-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none">
                                <option value="all">الجميع</option>
                                {delegatesList.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </section>

                    {/* Column Settings Section (Fixed as requested) */}
                    <section className="pt-4 border-t border-gray-100">
                        <button onClick={() => setShowColumnSettings(!showColumnSettings)} className="w-full flex items-center justify-between text-gray-700 hover:text-indigo-600 transition-colors p-3 rounded-2xl bg-gray-50 hover:bg-indigo-50 hover:bg-opacity-50">
                            <span className="font-black text-xs flex items-center gap-2">
                                <Settings className="h-4 w-4" /> ترتيب واختيار الأعمدة
                            </span>
                            {showColumnSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>

                        {showColumnSettings && (
                            <div className="bg-white rounded-2xl mt-3 border border-gray-100 p-2 shadow-inner">
                                <Reorder.Group axis="y" values={columns} onReorder={setColumns} className="space-y-1">
                                    {columns.map((col) => (
                                        <Reorder.Item key={col.key} value={col} className="flex items-center gap-3 p-2.5 bg-gray-50/50 hover:bg-white rounded-xl border border-transparent hover:border-indigo-100 cursor-move transition-all group">
                                            <GripVertical className="h-3 w-3 text-gray-300 group-hover:text-indigo-400" />
                                            <label className="flex items-center gap-3 flex-1 cursor-pointer">
                                                <input type="checkbox" checked={col.visible} onChange={() => toggleColumnVisibility(col.key)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                                                <span className="text-[11px] font-bold text-gray-600">{col.label}</span>
                                            </label>
                                        </Reorder.Item>
                                    ))}
                                </Reorder.Group>
                            </div>
                        )}
                    </section>
                </aside>

                {/* Main Results Area */}
                <main className="flex-1 overflow-auto p-3 md:p-6 bg-gray-50">
                    <div className="bg-white rounded-2xl md:rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden min-h-full">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-right text-sm min-w-[800px] md:min-w-0">
                                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                                    <tr>
                                        {columns.filter(c => c.visible).map(c => (
                                            <th key={c.key} className="p-3 md:p-5 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-l border-gray-50">
                                                {c.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loading ? (
                                        <tr><td colSpan="30" className="p-20 md:p-32 text-center text-gray-400 font-bold text-xs md:text-sm">جاري تجهيز التقرير...</td></tr>
                                    ) : filteredData.length === 0 ? (
                                        <tr><td colSpan="30" className="p-20 md:p-32 text-center text-gray-300">
                                            <Info className="h-8 w-8 md:h-10 md:w-10 mx-auto mb-4 opacity-20" />
                                            <p className="font-bold text-xs md:text-sm">لا يوجد بيانات مطابقة للمعايير المحددة</p>
                                        </td></tr>
                                    ) : (
                                        filteredData.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
                                                {columns.filter(c => c.visible).map(c => (
                                                    <td key={c.key} className="p-3 md:p-5 border-l border-gray-50 font-bold text-gray-600 text-[10px] md:text-[11px]">
                                                        {c.key === 'role_translated' ? (
                                                            <span className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg text-[8px] md:text-[9px] font-black ${item.role === 'husband' ? 'bg-blue-100 text-blue-700' : item.role === 'wife' ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                {item[c.key]}
                                                            </span>
                                                        ) : item[c.key] || '-'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
            `}</style>
        </div>
    );
}
