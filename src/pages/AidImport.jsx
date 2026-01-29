import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCamp } from '../context/CampContext';
import {
    getAllIndividuals,
    getAllFamilies,
    getParcels,
    createParcel,
    updateParcel,
    deleteParcel,
    addFamilyAid,
    getFullFamilyByHeadNid,
    getAllAidDeliveries,
    findHeadOfFamily
} from '../lib/db';
import * as XLSX from 'xlsx';
import { Package, Search, Filter, Plus, Save, Trash2, CheckCircle, Upload, FileSpreadsheet, Users, Calendar, XCircle, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AidImport() {
    const { user } = useAuth();
    const { selectedCamp } = useCamp();
    const [loading, setLoading] = useState(true);

    // View State
    const [activeTab, setActiveTab] = useState('parcels'); // 'parcels' | 'names'

    // Data State
    const [parcels, setParcels] = useState([]);
    const [beneficiaries, setBeneficiaries] = useState([]);
    const [aidHistory, setAidHistory] = useState([]); // To track who received what

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [delegateFilter, setDelegateFilter] = useState('all');
    const [familySizeFilter, setFamilySizeFilter] = useState({ min: '', max: '' });
    const [selectedParcelId, setSelectedParcelId] = useState('');
    const [selectedFamilies, setSelectedFamilies] = useState(new Set());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newParcelData, setNewParcelData] = useState({ name: '', date: new Date().toISOString().split('T')[0] });

    // Import State
    // const [isImporting, setIsImporting] = useState(false); // Can use loading or separate state if needed
    // const [importLog, setImportLog] = useState([]);

    const [filterParcelReceived, setFilterParcelReceived] = useState(null);
    const [showFilters, setShowFilters] = useState(false); // Mobile filter toggle
    const [isProcessing, setIsProcessing] = useState(false); // Prevent double-click

    useEffect(() => {
        if (selectedCamp) {
            loadData();
        }
    }, [selectedCamp]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Parcels
            const parcelsData = await getParcels(selectedCamp.camp_id);
            setParcels(parcelsData);

            // 2. Fetch ALL Families & Individuals (to ensure we list EVERY family)
            const familiesData = await getAllFamilies(selectedCamp.camp_id);
            const allInds = await getAllIndividuals(selectedCamp.camp_id);

            // 3. Fetch Aid History
            const allAid = await getAllAidDeliveries();

            // Logic to find heads - Strict Priority
            const husbandRoles = ['زوج', 'husband', 'father', 'أب', 'اب'];
            const femaleHeadRoles = ['أرملة', 'widow', 'مطلقة', 'divorced', 'مهجورة', 'abandoned', 'زوجة ثانية', 'second_wife', 'وصي', 'guardian'];

            // Filter out departed families - only show active families
            const activeFamilies = familiesData.filter(fam => !fam.is_departed);

            // Map each family to the view structure
            const mappedBeneficiaries = activeFamilies.map(fam => {
                const members = allInds.filter(i => i.family_id === fam.family_id);
                const head = findHeadOfFamily(members);

                // Find received parcels
                const familyAid = allAid.filter(a => a.family_id === fam.family_id);
                const receivedIds = familyAid.filter(a => a.parcel_id).map(a => a.parcel_id);

                return {
                    id: fam.family_id,
                    serial: fam.family_number,
                    headName: head ? head.name : 'بدون أفراد مسجلين',
                    headNid: head ? head.nid : '',
                    delegate: fam.delegate || 'غير محدد',
                    receivedParcels: receivedIds,
                    size: members.length,
                    aidHistory: familyAid
                };
            });

            // Sort by Serial
            mappedBeneficiaries.sort((a, b) => parseInt(a.serial || 0) - parseInt(b.serial || 0));

            setBeneficiaries(mappedBeneficiaries);
            setAidHistory(allAid);

        } catch (err) {
            console.error("Error loading data:", err);
            alert("حدث خطأ في تحميل البيانات");
        } finally {
            setLoading(false);
        }
    };

    // --- Actions ---

    const handleViewRecipients = (parcelId) => {
        setFilterParcelReceived(parcelId);
        setActiveTab('names');
    };

    const handleSaveParcel = async () => {
        if (!newParcelData.name) return;
        try {
            await createParcel({
                ...newParcelData,
                camp_id: selectedCamp.camp_id,
                // display_id is handled by DB SERIAL
                status: 'active'
            });
            setIsModalOpen(false);
            setNewParcelData({ name: '', date: new Date().toISOString().split('T')[0] });
            loadData(); // Reload to get IDs
        } catch (err) {
            console.error(err);
            alert("فشل الحفظ");
        }
    };

    const handleCompleteParcel = async (parcel) => {
        if (!window.confirm("هل أنت متأكد من إنهاء توزيع هذا الصنف؟")) return;
        try {
            await updateParcel(parcel.parcel_id, { status: 'completed' });
            loadData();
        } catch (err) {
            alert("حدث خطأ");
        }
    };

    const handleDeleteParcel = async (id) => {
        if (!window.confirm("حذف الصنف وسجلات التوزيع المرتبطة به؟")) return;
        try {
            await deleteParcel(id);
            loadData();
        } catch (err) {
            alert("حدث خطأ في الحذف");
        }
    };

    const handleSelectFamily = (id) => {
        const newSet = new Set(selectedFamilies);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedFamilies(newSet);
    };

    const handleBulkAssign = async () => {
        if (isProcessing) return; // Prevent double-click
        if (!selectedParcelId) return alert("الرجاء اختيار الصنف أولاً");
        if (selectedFamilies.size === 0) return alert("الرجاء اختيار عائلات");

        const parcel = parcels.find(p => p.parcel_id === selectedParcelId);
        if (!window.confirm(`تأكيد تسليم "${parcel.name}" لـ ${selectedFamilies.size} عائلة؟`)) return;

        setIsProcessing(true);
        try {
            const families = Array.from(selectedFamilies);
            let addedCount = 0;
            let skippedCount = 0;

            // Process sequentially to avoid race conditions
            for (const famId of families) {
                const ben = beneficiaries.find(b => b.id === famId);
                // Check if already received
                if (ben && !ben.receivedParcels.includes(selectedParcelId)) {
                    try {
                        await addFamilyAid({
                            family_id: famId,
                            parcel_id: selectedParcelId,
                            items: parcel.name,
                            date: new Date().toISOString().split('T')[0],
                            recipient: ben.headName,
                            notes: 'توزيع جماعي'
                        });
                        addedCount++;
                    } catch (err) {
                        // Handle unique constraint error gracefully
                        if (err.message?.includes('unique') || err.code === '23505') {
                            skippedCount++;
                        } else {
                            throw err;
                        }
                    }
                }
            }

            alert(`تم التوزيع بنجاح لـ ${addedCount} عائلة جديدة${skippedCount > 0 ? ` (تم تجاهل ${skippedCount} مكرر)` : ''}.`);
            setSelectedFamilies(new Set());
            loadData();

        } catch (err) {
            console.error(err);
            alert("حدث خطأ أثناء التوزيع");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExcelUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
                // Expecting NO Header or specific columns based on user desc:
                // User said: "Head NID" and "Parcel Number" instead of Family Number
                // Let's assume Row 1 is header, data starts Row 2.
                // Col 0: Head NID, Col 1: Parcel Display ID (or reversed? User said "upload file relies on linking family with parcel via Head ID and Parcel Number")
                // Let's assume: A: Head ID, B: Parcel Number.

                const rows = data.slice(1); // Skip header
                let count = 0;

                for (const row of rows) {
                    const nid = row[0]?.toString().trim();
                    const parcelDispId = row[1]; // number or string

                    if (!nid || !parcelDispId) continue;

                    // Find Beneficiary
                    const family = beneficiaries.find(b => b.headNid === nid);
                    // Find Parcel by Display ID (Assuming we store display_id or match logical index)
                    // We need to match the 'display_id' column or derived index.
                    // The DB schema has 'display_id'.
                    const parcel = parcels.find(p => p.display_id == parcelDispId);

                    if (family && parcel) {
                        // Check if exists
                        if (!family.receivedParcels.includes(parcel.parcel_id)) {
                            await addFamilyAid({
                                family_id: family.id,
                                parcel_id: parcel.parcel_id,
                                items: parcel.name,
                                date: new Date().toISOString().split('T')[0],
                                recipient: family.headName,
                                notes: 'استيراد Excel'
                            });
                            count++;
                        }
                    }
                }

                alert(`تم استيراد ${count} عملية تسليم.`);
                loadData();
            } catch (err) {
                console.error(err);
                alert("فشل قراءة الملف");
            }
        };
        reader.readAsBinaryString(file);
    };

    // --- Filtering ---
    const filteredBeneficiaries = useMemo(() => {
        return beneficiaries.filter(b => {
            const matchesSearch =
                (b.headName && b.headName.includes(searchTerm)) ||
                (b.headNid && b.headNid.includes(searchTerm)) ||
                (b.serial && b.serial.toString().includes(searchTerm));

            const matchesDelegate = delegateFilter === 'all' || b.delegate === delegateFilter;

            const matchesParcel = filterParcelReceived ? b.receivedParcels.includes(filterParcelReceived) : true;

            const size = b.size || 0;
            const min = familySizeFilter.min ? parseInt(familySizeFilter.min) : 0;
            const max = familySizeFilter.max ? parseInt(familySizeFilter.max) : 999;
            const matchesSize = size >= min && size <= max;

            return matchesSearch && matchesDelegate && matchesParcel && matchesSize;
        });
    }, [beneficiaries, searchTerm, delegateFilter, filterParcelReceived, familySizeFilter]);

    // Unique delegates for filter
    const delegates = useMemo(() => {
        const d = new Set(beneficiaries.map(b => b.delegate).filter(Boolean));
        return Array.from(d);
    }, [beneficiaries]);


    if (loading) return <div className="p-10 text-center text-gray-500">جاري تحميل البيانات...</div>;

    return (
        <div className="container mx-auto max-w-5xl p-4 md:p-6 min-h-screen bg-gray-50 font-sans pb-24 md:pb-10" dir="rtl">
            {/* Nav */}
            <div className="bg-white p-1.5 rounded-2xl shadow-sm mb-6 grid grid-cols-2 gap-2 w-full max-w-lg mx-auto border border-gray-100">
                <button
                    onClick={() => setActiveTab('parcels')}
                    className={`py-3 rounded-xl font-bold transition-all text-center flex items-center justify-center gap-2 ${activeTab === 'parcels' ? 'bg-indigo-600 text-white shadow-md transform scale-[1.02]' : 'text-gray-500 hover:bg-gray-50 hover:text-indigo-600'}`}
                >
                    <Package className={`h-5 w-5 ${activeTab === 'parcels' ? 'text-indigo-200' : 'text-gray-400'}`} />
                    إدارة الطرود
                </button>
                <button
                    onClick={() => setActiveTab('names')}
                    className={`py-3 rounded-xl font-bold transition-all text-center flex items-center justify-center gap-2 ${activeTab === 'names' ? 'bg-indigo-600 text-white shadow-md transform scale-[1.02]' : 'text-gray-500 hover:bg-gray-50 hover:text-indigo-600'}`}
                >
                    <Users className={`h-5 w-5 ${activeTab === 'names' ? 'text-indigo-200' : 'text-gray-400'}`} />
                    كشف العائلات
                </button>
            </div>

            {/* Content Actions */}
            <div className="space-y-6">

                {/* PARCELS TAB */}
                {activeTab === 'parcels' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Package className="h-6 w-6 text-indigo-600" />
                                الأصناف / الطرود
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-2xl shadow-lg hover:bg-indigo-700 transition"
                            >
                                <Plus className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="grid gap-4">
                            {parcels.length === 0 && <div className="text-center text-gray-400 py-10">لا توجد طرود مضافة بعد</div>}
                            {parcels.map(p => (
                                <div key={p.parcel_id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center group hover:border-indigo-100 transition">
                                    <div className="flex items-center gap-4">
                                        <span className="bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded-lg">#{p.display_id}</span>
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-lg">{p.name}</h3>
                                            <span className="text-sm text-gray-500 flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {p.date}
                                            </span>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-md font-bold ${p.status === 'active' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                            {p.status === 'active' ? 'قيد التوزيع' : 'مكتمل'}
                                        </span>
                                    </div>
                                    <div className="flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition">
                                        <button
                                            onClick={() => handleViewRecipients(p.parcel_id)}
                                            className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 text-sm font-bold border border-indigo-200"
                                        >
                                            <Users className="h-4 w-4 inline-block ml-1" />
                                            المستلمين
                                        </button>
                                        {p.status === 'active' && (
                                            <button
                                                onClick={() => handleCompleteParcel(p)}
                                                className="px-3 py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 text-sm font-bold border border-green-200"
                                            >
                                                إتمام
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteParcel(p.parcel_id)}
                                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* NAMES TAB */}
                {activeTab === 'names' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-gray-100 min-h-[500px] flex flex-col">

                        {/* Filters & Actions */}
                        <div className="flex flex-col gap-4 mb-6 sticky top-0 md:static bg-white z-10 p-2 md:p-0 -mx-4 px-4 md:mx-0">
                            {/* Top Action Bar */}
                            {(selectedParcelId && selectedFamilies.size > 0) || filterParcelReceived ? (
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-indigo-50 p-3 rounded-2xl border border-indigo-100 flex-wrap gap-3 animate-pulse-soft">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm shrink-0">
                                            {selectedFamilies.size}
                                        </div>
                                        <span className="text-indigo-800 font-bold text-sm">عائلة محددة للتوزيع</span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                        {/* Cancel Filter Button */}
                                        {filterParcelReceived && (
                                            <button
                                                onClick={() => setFilterParcelReceived(null)}
                                                className="bg-white text-gray-700 hover:text-red-600 px-3 py-2 rounded-xl text-sm font-bold border border-gray-200 transition flex items-center gap-1 flex-1 md:flex-none justify-center"
                                            >
                                                <XCircle className="h-4 w-4" />
                                                إلغاء التصفية
                                            </button>
                                        )}

                                        {/* Bulk Assign Button - MOVED HERE */}
                                        {selectedParcelId && selectedFamilies.size > 0 && (
                                            <button
                                                onClick={handleBulkAssign}
                                                disabled={isProcessing}
                                                className={`flex items-center justify-center gap-2 px-5 py-2.5 text-white text-sm font-bold rounded-xl shadow-md transition flex-1 md:flex-none ${isProcessing
                                                    ? 'bg-gray-400 cursor-not-allowed'
                                                    : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105 active:scale-95'
                                                    }`}
                                            >
                                                <Save className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
                                                {isProcessing ? 'جاري التوزيع...' : 'تأكيد التوزيع'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            <div className="flex flex-col gap-3">
                                {/* Search & Toggle Row */}
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="بحث سريع (الاسم، الهوية)..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pr-10 pl-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition shadow-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={() => setShowFilters(!showFilters)}
                                        className={`md:hidden px-3 py-2 rounded-xl transition border ${showFilters ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                                    >
                                        <Filter className="h-5 w-5" />
                                    </button>
                                </div>

                                {/* Advanced Filters - Hidden on Mobile unless toggled */}
                                <div className={`${showFilters ? 'grid' : 'hidden'} md:grid grid-cols-1 md:grid-cols-12 gap-3 items-end`}>
                                    <div className="col-span-1 md:col-span-4">
                                        {/* Spacer or additional desktop filters can go here if needed, currently empty as search moved up */}
                                    </div>
                                    <div className="col-span-1 md:col-span-3">
                                        <select
                                            value={delegateFilter}
                                            onChange={(e) => setDelegateFilter(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                        >
                                            <option value="all">كل المفوضين</option>
                                            {delegates.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                    {/* Family Size Filter */}
                                    <div className="col-span-1 md:col-span-2 flex items-center gap-2 bg-gray-50 rounded-xl px-2 border border-gray-200 h-[46px]">
                                        <span className="text-gray-400 text-xs font-bold whitespace-nowrap">أفراد:</span>
                                        <input
                                            type="number"
                                            placeholder="من"
                                            value={familySizeFilter.min}
                                            onChange={(e) => setFamilySizeFilter({ ...familySizeFilter, min: e.target.value })}
                                            className="w-full bg-transparent text-center text-sm font-bold outline-none"
                                        />
                                        <span className="text-gray-300">-</span>
                                        <input
                                            type="number"
                                            placeholder="إلى"
                                            value={familySizeFilter.max}
                                            onChange={(e) => setFamilySizeFilter({ ...familySizeFilter, max: e.target.value })}
                                            className="w-full bg-transparent text-center text-sm font-bold outline-none"
                                        />
                                    </div>
                                    <div className="col-span-1 md:col-span-3">
                                        <select
                                            value={selectedParcelId}
                                            onChange={(e) => setSelectedParcelId(e.target.value)}
                                            className={`w-full px-4 py-2.5 border rounded-xl font-bold outline-none shadow-sm transition cursor-pointer appearance-none ${selectedParcelId
                                                ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200'
                                                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                                }`}
                                        >
                                            <option value="" className="text-gray-500 bg-white">-- اختر الصنف للتوزيع --</option>
                                            {parcels.filter(p => p.status === 'active').map(p => (
                                                <option key={p.parcel_id} value={p.parcel_id} className="text-black bg-white">
                                                    📦 {p.name} (#{p.display_id})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* List View (Mobile Optimized) */}
                        <div className="flex-1 overflow-auto border rounded-xl border-gray-100 bg-white shadow-inner">
                            {/* Desktop Table View */}
                            <table className="w-full text-right text-sm hidden md:table">
                                <thead className="bg-gray-50 text-gray-600 font-bold sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-4 w-12 text-center">
                                            <input
                                                type="checkbox"
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedFamilies(new Set(filteredBeneficiaries.map(b => b.id)));
                                                    else setSelectedFamilies(new Set());
                                                }}
                                                checked={filteredBeneficiaries.length > 0 && selectedFamilies.size === filteredBeneficiaries.length}
                                                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 cursor-pointer"
                                            />
                                        </th>
                                        <th className="p-4">العائلة</th>
                                        <th className="p-4">الهوية (الرب)</th>
                                        <th className="p-4">المفوض</th>
                                        <th className="p-4">عدد الأفراد</th>
                                        <th className="p-4 w-[25%]">سجل الاستلام</th>
                                        <th className="p-4 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredBeneficiaries.map((b) => (
                                        <tr
                                            key={b.id}
                                            className={`hover:bg-indigo-50 transition cursor-pointer group ${selectedFamilies.has(b.id) ? 'bg-indigo-50' : ''}`}
                                            onClick={() => handleSelectFamily(b.id)}
                                        >
                                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFamilies.has(b.id)}
                                                    onChange={() => handleSelectFamily(b.id)}
                                                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg text-xs font-bold font-mono group-hover:bg-white transition">#{b.serial}</span>
                                                    <span className={`font-bold ${selectedFamilies.has(b.id) ? 'text-indigo-700' : 'text-gray-800'}`}>{b.headName}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-500 font-mono text-xs">{b.headNid}</td>
                                            <td className="p-4 text-gray-500 text-xs">{b.delegate}</td>
                                            <td className="p-4 text-center font-bold text-indigo-900 bg-indigo-50/50 rounded-lg">{b.size}</td>
                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {b.receivedParcels.map(pid => {
                                                        const p = parcels.find(item => item.parcel_id === pid);
                                                        return p ? (
                                                            <span key={pid} className="inline-flex items-center px-1.5 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold border border-green-200 rounded shadow-sm">
                                                                {p.name}
                                                            </span>
                                                        ) : null;
                                                    })}
                                                </div>
                                            </td>
                                            <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                                <Link
                                                    to={`/aid/${b.id}`}
                                                    target="_blank"
                                                    className="inline-flex items-center justify-center p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition border border-indigo-100 shadow-sm"
                                                    title="الانتقال إلى سجل المساعدات الكامل"
                                                >
                                                    <Package className="h-4 w-4" />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredBeneficiaries.length === 0 && (
                                        <tr><td colSpan="7" className="p-12 text-center text-gray-400 font-medium">لا توجد عائلات مطابقة للبحث</td></tr>
                                    )}
                                </tbody>
                            </table>

                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-2 p-2 bg-gray-50">
                                {/* Mobile Select All Header */}
                                {filteredBeneficiaries.length > 0 && (
                                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-200 shadow-sm mb-2">
                                        <label className="flex items-center gap-3 text-sm font-bold text-gray-700 cursor-pointer w-full">
                                            <input
                                                type="checkbox"
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedFamilies(new Set(filteredBeneficiaries.map(b => b.id)));
                                                    else setSelectedFamilies(new Set());
                                                }}
                                                checked={filteredBeneficiaries.length > 0 && selectedFamilies.size === filteredBeneficiaries.length}
                                                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                            />
                                            <span>تحديد الكل ({filteredBeneficiaries.length})</span>
                                        </label>
                                    </div>
                                )}

                                {filteredBeneficiaries.map((b) => (
                                    <div
                                        key={b.id}
                                        className={`bg-white p-4 rounded-xl shadow-sm border ${selectedFamilies.has(b.id) ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50' : 'border-gray-200'} transition active:scale-98`}
                                        onClick={() => handleSelectFamily(b.id)}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFamilies.has(b.id)}
                                                    onChange={() => handleSelectFamily(b.id)}
                                                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 pointer-events-none"
                                                />
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold font-mono">#{b.serial}</span>
                                                        <h3 className={`font-bold text-sm ${selectedFamilies.has(b.id) ? 'text-indigo-700' : 'text-gray-900'}`}>{b.headName}</h3>
                                                    </div>
                                                    <div className="text-gray-500 text-xs font-mono mt-0.5">{b.headNid}</div>
                                                </div>
                                            </div>
                                            <Link
                                                to={`/aid/${b.id}`}
                                                target="_blank"
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-2 bg-gray-100 text-gray-500 rounded-lg"
                                            >
                                                <Package className="h-4 w-4" />
                                            </Link>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg mb-2">
                                            <div>
                                                <span className="text-gray-400 block mb-0.5">المفوض:</span>
                                                {b.delegate}
                                            </div>
                                            <div>
                                                <span className="text-gray-400 block mb-0.5">عدد الأفراد:</span>
                                                <span className="font-bold text-indigo-700">{b.size}</span>
                                            </div>
                                        </div>

                                        {b.receivedParcels.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {b.receivedParcels.map(pid => {
                                                    const p = parcels.find(item => item.parcel_id === pid);
                                                    return p ? (
                                                        <span key={pid} className="inline-flex items-center px-1.5 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold border border-green-200 rounded shadow-sm">
                                                            {p.name}
                                                        </span>
                                                    ) : null;
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {filteredBeneficiaries.length === 0 && (
                                    <div className="p-10 text-center text-gray-400 font-medium">لا توجد عائلات مطابقة للبحث</div>
                                )}
                            </div>
                        </div>

                        {/* Footer (Actions removed, kept Excel only) */}
                        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col md:flex-row justify-end gap-2">
                            <label className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 text-sm font-bold rounded-xl cursor-pointer transition border border-gray-200 w-full md:w-auto">
                                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                                <span>استيراد توزيع من Excel</span>
                                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} />
                            </label>
                        </div>

                    </motion.div>
                )}
            </div>

            {/* Modal - New Parcel */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">إضافة صنف / طرد جديد</h3>
                        <input
                            type="text"
                            placeholder="اسم الصنف (مثال: سلة غذائية 1)"
                            value={newParcelData.name}
                            onChange={(e) => setNewParcelData({ ...newParcelData, name: e.target.value })}
                            className="w-full mb-3 p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                        />
                        <input
                            type="date"
                            value={newParcelData.date}
                            onChange={(e) => setNewParcelData({ ...newParcelData, date: e.target.value })}
                            className="w-full mb-6 p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="flex gap-2">
                            <button onClick={handleSaveParcel} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition">حفظ</button>
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal - History Record */}


        </div>
    );
}
