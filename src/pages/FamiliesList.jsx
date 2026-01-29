import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllFamilies, getAllIndividuals, deleteFamily, getFamilyOverview, findHeadOfFamily } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useCamp } from '../context/CampContext';
import * as XLSX from 'xlsx';
import { Users, Pencil, Phone, MapPin, Download, Search, Trash2, Filter, X, CheckSquare, Square, Package, Shield, UserX, AlertTriangle, AlertCircle } from 'lucide-react';

export default function FamiliesList() {
    const { user } = useAuth();
    const { selectedCamp } = useCamp();
    const [families, setFamilies] = useState([]);
    const [loading, setLoading] = useState(true);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchColumn, setSearchColumn] = useState('all'); // all, number, name, nid
    const [departedFilter, setDepartedFilter] = useState('active'); // 'active', 'departed', 'all'

    // Selection State
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Duplicate Check State
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [duplicateGroups, setDuplicateGroups] = useState([]);
    const [isChecking, setIsChecking] = useState(false);

    useEffect(() => {
        if (selectedCamp) {
            loadFamilies();
        } else {
            setFamilies([]);
            setLoading(false);
        }
    }, [selectedCamp]);

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleAll = () => {
        if (selectedIds.size === filteredFamilies.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredFamilies.map(f => f.family_id)));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;

        if (!window.confirm(`هل أنت متأكد من حذف ${selectedIds.size} عائلة/عائلات؟`)) return;

        try {
            for (const id of selectedIds) {
                await deleteFamily(id);
            }

            setSelectedIds(new Set());
            alert('تم الحذف بنجاح');
            loadFamilies();
        } catch (error) {
            console.error('Delete error:', error);
            alert('خطأ أثناء الحذف');
        }
    };


    const loadFamilies = async () => {
        if (!selectedCamp) return;
        setLoading(true);
        try {
            // Attempt to fetch from optimized VIEW first
            // This fixes the "Unregistered" issue by letting the DB handle the join logic.

            // تم تجاوز View المحسنة لضمان دقة تحديد رب الأسرة مع الأدوار الجديدة (وصي، أخرى، إلخ)
            // سنعتمد على المنطق المحلي الذي تم تحديثه واختباره

            // let data;
            // try {
            //     data = await getFamilyOverview(selectedCamp.camp_id);
            // } catch (err) { ... }

            const allFamilies = await getAllFamilies(selectedCamp.camp_id);
            const allIndividuals = await getAllIndividuals(selectedCamp.camp_id);

            const data = allFamilies.map(family => {
                const members = allIndividuals.filter(ind => ind.family_id === family.family_id);
                const headMember = findHeadOfFamily(members);
                const partnerMember = members.find(m => ['wife', 'wife_second', 'زوجة', 'زوجة ثانية'].includes(m.role?.toLowerCase().trim()));

                let headName = 'غير مسجل';
                let headNid = '-';
                let partnerName = '-';
                let partnerNid = '-';

                if (headMember) {
                    headName = headMember.name;
                    if (headMember.role === 'other' && headMember.role_description) {
                        headName += ` (${headMember.role_description})`;
                    } else if (headMember.role === 'guardian' || headMember.role === 'وصي') {
                        headName += ` (وصي)`;
                    }

                    headNid = headMember.nid || '-';

                    if (headMember.role === 'husband' || headMember.role === 'زوج') {
                        if (partnerMember) {
                            partnerName = partnerMember.name;
                            partnerNid = partnerMember.nid || '-';
                        }
                    }
                }

                return {
                    ...family,
                    headName, // Mapped to match view columns
                    headNid,
                    partnerName,
                    partnerNid,
                    memberCount: members.length
                };
            });

            data.sort((a, b) => (parseInt(a.family_number) || 0) - (parseInt(b.family_number) || 0));


            // Map view columns to component state structure (if different)
            const processedFamilies = data.map(f => ({
                ...f,
                headName: f.head_name || f.headName || 'غير مسجل',
                headNid: f.head_nid || f.headNid || '-',
                partnerName: f.partner_name || f.partnerName || '-',
                partnerNid: f.partner_nid || f.partnerNid || '-',
                memberCount: f.member_count || f.memberCount || 0
            }));

            setFamilies(processedFamilies);
        } catch (error) {
            console.error('Load error:', error);
            alert('حدث خطأ أثناء تحميل البيانات: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredFamilies = families.map(f => ({
        ...f,
        // Ensure properties exist for search safety and normalize for search
        searchStr_number: (f.family_number || '').toString().toLowerCase(),
        searchStr_headName: (f.headName || '').toString().toLowerCase(),
        searchStr_partnerName: (f.partnerName || '').toString().toLowerCase(),
        searchStr_headNid: (f.headNid || '').toString().toLowerCase(),
        searchStr_partnerNid: (f.partnerNid || '').toString().toLowerCase(),
    })).filter(f => {
        // Filter by departed status first
        if (departedFilter === 'active' && f.is_departed) return false;
        if (departedFilter === 'departed' && !f.is_departed) return false;
        // 'all' shows both

        if (!searchTerm) return true;
        const lowerSearch = searchTerm.toLowerCase();

        if (searchColumn === 'number') return f.searchStr_number.includes(lowerSearch);
        if (searchColumn === 'nid') return f.searchStr_headNid.includes(lowerSearch) || f.searchStr_partnerNid.includes(lowerSearch);
        if (searchColumn === 'name') return f.searchStr_headName.includes(lowerSearch) || f.searchStr_partnerName.includes(lowerSearch);

        // 'all'
        return (
            f.searchStr_number.includes(lowerSearch) ||
            f.searchStr_headName.includes(lowerSearch) ||
            f.searchStr_partnerName.includes(lowerSearch) ||
            f.searchStr_headNid.includes(lowerSearch) ||
            f.searchStr_partnerNid.includes(lowerSearch)
        );
    });

    const handleExport = () => {
        const familiesToExport = selectedIds.size > 0
            ? filteredFamilies.filter(f => selectedIds.has(f.family_id))
            : filteredFamilies;

        const ws = XLSX.utils.json_to_sheet(familiesToExport.map(f => ({
            'رقم العائلة': f.family_number,
            'رب العائلة': f.headName,
            'هوية رب العائلة': f.headNid,
            'الشريك/الزوجة': f.partnerName,
            'هوية الشريك': f.partnerNid,
            'عدد الأفراد': f.memberCount,
            'رقم التواصل': f.contact,
            'العنوان': f.address,
            'المفوض': f.delegate || '-'
        })));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "العائلات");
        XLSX.writeFile(wb, selectedIds.size > 0 ? "families_selected.xlsx" : "families_list.xlsx");
    };

    const checkDuplicates = async () => {
        if (!selectedCamp) return;
        setIsChecking(true);
        try {
            const individuals = await getAllIndividuals(selectedCamp.camp_id);
            const groups = {};

            individuals.forEach(ind => {
                if (ind.nid && ind.nid.trim() !== '') {
                    const nid = ind.nid.trim();
                    if (!groups[nid]) groups[nid] = [];
                    groups[nid].push(ind);
                }
            });

            const results = Object.entries(groups)
                .filter(([_, members]) => members.length > 1)
                .map(([nid, members]) => ({
                    nid,
                    members: members.map(m => ({
                        family_number: m.family_number,
                        name: m.name,
                        role: m.role,
                        family_id: m.family_id
                    }))
                }));

            setDuplicateGroups(results);
            setShowDuplicates(true);
        } catch (error) {
            console.error('Check duplicates error:', error);
            alert('خطأ أثناء فحص التكرار');
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <Users className="h-8 w-8 text-indigo-600" />
                    سجل العائلات الأساسي
                </h1>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-red-200 transition animate-in fade-in slide-in-from-top-2"
                        >
                            <Trash2 className="h-4 w-4" />
                            حذف ({selectedIds.size})
                        </button>
                    )}

                    <Link
                        to="/cards"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap"
                        target="_blank"
                    >
                        <Users className="h-4 w-4" />
                        طباعة البطاقات
                    </Link>

                    <button
                        onClick={handleExport}
                        disabled={filteredFamilies.length === 0}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        <Download className="h-4 w-4" />
                        {selectedIds.size > 0 ? `تصدير المحدد (${selectedIds.size})` : 'تصدير Excel'}
                    </button>

                    <button
                        onClick={checkDuplicates}
                        disabled={isChecking}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 border border-amber-200 transition-colors whitespace-nowrap"
                        title="فحص تكرار الهوية في هذا المخيم"
                    >
                        {isChecking ? (
                            <div className="h-4 w-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <AlertCircle className="h-4 w-4" />
                        )}
                        فحص التكرار
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="بحث عن عائلة..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>

                <div className="flex items-center gap-2 min-w-[200px]">
                    <Filter className="h-5 w-5 text-gray-500" />
                    <select
                        value={searchColumn}
                        onChange={(e) => setSearchColumn(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    >
                        <option value="all">كل الحقول</option>
                        <option value="number">رقم العائلة</option>
                        <option value="name">الاسم (رب العائلة/الشريك)</option>
                        <option value="nid">رقم الهوية</option>
                    </select>
                </div>

                <div className="flex items-center gap-2 min-w-[180px]">
                    <UserX className="h-5 w-5 text-gray-500" />
                    <select
                        value={departedFilter}
                        onChange={(e) => setDepartedFilter(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    >
                        <option value="active">العائلات النشطة</option>
                        <option value="departed">المغادرين فقط</option>
                        <option value="all">الكل</option>
                    </select>
                </div>

                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm('')}
                        className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* Mobile View - Compact Smooth Table */}
            <div className="md:hidden -mx-4 overflow-x-auto">
                <div className="inline-block min-w-full align-middle">
                    <div className="overflow-hidden border-t border-gray-100">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50/50">
                                <tr>
                                    <th scope="col" className="px-3 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">العائلة</th>
                                    <th scope="col" className="px-3 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">الأطراف</th>
                                    <th scope="col" className="px-3 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-wider">أفراد</th>
                                    <th scope="col" className="px-3 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-wider">إجراء</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan="4" className="px-3 py-10 text-center text-xs text-gray-400">جاري التحميل...</td>
                                    </tr>
                                ) : filteredFamilies.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-3 py-10 text-center text-xs text-gray-400">
                                            {families.length === 0 ? 'لا توجد عائلات مسجلة' : 'لا توجد نتائج'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredFamilies.map((family) => (
                                        <tr key={family.family_id} className={`hover:bg-indigo-50/30 transition-colors ${family.is_departed ? 'bg-orange-50/20' : ''}`}>
                                            <td className="px-3 py-3 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-indigo-600">#{family.family_number}</span>
                                                    {family.is_departed && <span className="text-[10px] text-orange-600 font-bold">مغادرة</span>}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex flex-col gap-0.5 max-w-[140px]">
                                                    <div className="text-xs font-bold text-gray-800 truncate" title={family.headName}>
                                                        {family.headName}
                                                        <span className="block text-[9px] text-gray-400 font-normal">هوية: {family.headNid}</span>
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 truncate italic mt-1 border-t border-gray-50 pt-0.5" title={family.partnerName}>
                                                        {family.partnerName || '-'}
                                                        {family.partnerName !== '-' && <span className="block text-[9px] text-gray-400 font-normal">هوية: {family.partnerNid}</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black border border-blue-100">
                                                    {family.memberCount}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-left">
                                                <div className="flex items-center gap-1.5 justify-end">
                                                    <Link
                                                        to={`/edit/${family.family_id}`}
                                                        className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Link>
                                                    <Link
                                                        to={`/aid/${family.family_id}`}
                                                        className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100"
                                                    >
                                                        <Package className="h-4 w-4" />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Desktop Table - Hidden on Mobile */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold border-b">
                            <tr>
                                {(user?.role === 'admin' || user?.role === 'manager') && (
                                    <th className="px-4 py-4 w-12 text-center pointer-events-auto">
                                        <button onClick={toggleAll} className="flex items-center justify-center text-gray-600 hover:text-indigo-600">
                                            {filteredFamilies.length > 0 && selectedIds.size === filteredFamilies.length ? (
                                                <CheckSquare className="h-5 w-5 text-indigo-600" />
                                            ) : (
                                                <Square className="h-5 w-5" />
                                            )}
                                        </button>
                                    </th>
                                )}
                                <th className="px-6 py-4">رقم العائلة</th>
                                <th className="px-6 py-4">رب العائلة (الاسم / الهوية)</th>
                                <th className="px-6 py-4">الشريك/الزوجة (الاسم / الهوية)</th>
                                <th className="px-6 py-4 text-center">عدد الأفراد</th>
                                <th className="px-6 py-4">رقم التواصل</th>
                                <th className="px-6 py-4">العنوان</th>
                                <th className="px-6 py-4">المفوض</th>
                                <th className="px-6 py-4 text-left">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="text-center p-8">جاري التحميل...</td>
                                </tr>
                            ) : filteredFamilies.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="text-center p-8 text-gray-500">
                                        {families.length === 0 ? 'لا توجد عائلات مسجلة' : 'لا توجد نتائج للبحث'}
                                    </td>
                                </tr>
                            ) : (
                                filteredFamilies.map((family) => {
                                    const isSelected = selectedIds.has(family.family_id);
                                    return (
                                        <tr key={family.family_id} className={`transition ${isSelected ? 'bg-indigo-50 hover:bg-indigo-100' : family.is_departed ? 'bg-orange-50/40 hover:bg-orange-50' : 'hover:bg-gray-50'}`}>
                                            {(user?.role === 'admin' || user?.role === 'manager') && (
                                                <td className="px-4 py-4 text-center">
                                                    <button
                                                        onClick={() => toggleSelection(family.family_id)}
                                                        className={`hover:text-indigo-600 ${isSelected ? 'text-indigo-600' : 'text-gray-400'}`}
                                                    >
                                                        {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                                                    </button>
                                                </td>
                                            )}
                                            <td className="px-6 py-4 font-bold text-indigo-700">
                                                <div className="flex items-center gap-2">
                                                    #{family.family_number}
                                                    {family.is_departed && (
                                                        <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                                            <UserX className="h-3 w-3" />
                                                            مغادرة
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{family.headName}</div>
                                                <div className="text-xs text-gray-500 mt-1">هوية: {family.headNid}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-gray-700">{family.partnerName}</div>
                                                <div className="text-xs text-gray-400 mt-1">هوية: {family.partnerNid}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold text-xs">
                                                    {family.memberCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 ltr" dir="ltr">
                                                <div className="flex items-center gap-2 justify-end">
                                                    {family.contact}
                                                    <Phone className="h-3 w-3" />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="h-3 w-3" />
                                                    {family.address}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                <div className="flex items-center gap-2">
                                                    <Shield className="h-3 w-3 text-indigo-400" />
                                                    {family.delegate || '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-left">
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        to={`/aid/${family.family_id}`}
                                                        className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 p-2 rounded-lg inline-flex items-center gap-1 transition-colors"
                                                        title="تسليم مساعدات"
                                                    >
                                                        <Package className="h-4 w-4" />
                                                    </Link>
                                                    <Link
                                                        to={`/edit/${family.family_id}`}
                                                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg inline-flex items-center gap-1 transition-colors"
                                                        title="تعديل وتفاصيل"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Duplicate Results Modal */}
            {showDuplicates && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-amber-50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                                    <AlertTriangle className="h-6 w-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">تكرار أرقام الهوية</h2>
                                    <p className="text-sm text-gray-500">تم العثور على {duplicateGroups.length} تكرار</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDuplicates(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full transition-colors"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {duplicateGroups.length === 0 ? (
                                <div className="text-center py-10">
                                    <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckSquare className="h-8 w-8" />
                                    </div>
                                    <p className="text-gray-600 font-medium">لا يوجد تكرار في أرقام الهوية للمخيم الحالي</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {duplicateGroups.map((group, idx) => (
                                        <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                                                <span className="font-bold text-gray-700">رقم الهوية: {group.nid}</span>
                                                <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full font-bold">
                                                    موجود في {group.members.length} عائلات
                                                </span>
                                            </div>
                                            <table className="w-full text-right text-sm">
                                                <thead className="bg-gray-50 text-gray-500 font-bold border-b">
                                                    <tr>
                                                        <th className="px-4 py-2">رقم العائلة</th>
                                                        <th className="px-4 py-2">اسم المشخص</th>
                                                        <th className="px-4 py-2">الصفة</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {group.members.map((m, midx) => (
                                                        <tr key={midx} className="hover:bg-gray-50">
                                                            <td className="px-4 py-2 font-bold text-indigo-600">
                                                                <Link to={`/edit/${m.family_id}`} className="hover:underline" target="_blank">
                                                                    #{m.family_number}
                                                                </Link>
                                                            </td>
                                                            <td className="px-4 py-2">{m.name}</td>
                                                            <td className="px-4 py-2 text-gray-500">{m.role || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setShowDuplicates(false)}
                                className="bg-gray-800 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-900 transition-colors"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
