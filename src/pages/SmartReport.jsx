import React, { useState, useEffect, useMemo } from 'react';
import { getAllFamilies, getAllIndividuals, getCamps, findHeadOfFamily } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useCamp } from '../context/CampContext';
import * as XLSX from 'xlsx';
import {
    Brain,
    Plus,
    Trash2,
    Download,
    Sparkles,
    Info,
    Table,
    FileSpreadsheet,
    HelpCircle,
    ChevronRight,
    Loader2,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- Smart Processing Engine (Fallback Logic) ---
// يعمل هذا النظام في حال فشل الاتصال بالذكاء الاصطناعي (مثل مشاكل CORS أو الحظر)
const processLocalSmartValue = (description, family, members) => {
    const desc = description.toLowerCase().trim();

    const ageRangeMatch = desc.match(/(عدد|كم).*(\d+).*(إلى|الى|و).*(\d+)/);
    if (ageRangeMatch) {
        const min = parseInt(ageRangeMatch[2]);
        const max = parseInt(ageRangeMatch[4]);
        return members.filter(m => {
            const age = calculateAge(m.dob);
            return age >= min && age <= max;
        }).length;
    }

    const ageBelowMatch = desc.match(/(عدد|كم).*اقل.*من.*(\d+)/);
    if (ageBelowMatch) {
        return members.filter(m => calculateAge(m.dob) < parseInt(ageBelowMatch[2])).length;
    }

    if (desc.includes('حامل') || desc.includes('حوامل')) return members.some(m => m.is_pregnant) ? 'نعم' : 'لا';
    if (desc.includes('اناث') || desc.includes('نساء') || desc.includes('أنثى')) return members.filter(m => m.gender === 'female' || m.gender === 'أنثى').length;
    if (desc.includes('ذكور') || desc.includes('رجال') || desc.includes('ذكر')) return members.filter(m => m.gender === 'male' || m.gender === 'ذكر').length;

    // معالجة طلب اسم الزوجة محلياً
    if (desc.includes('زوجة') || desc.includes('شريك')) {
        const wife = members.find(m => m.role && (m.role.includes('زوجة') || m.role.includes('ثانية')));
        return wife?.name || '-';
    }

    // معالجة طلب اسم الزوج محلياً
    if (desc.includes('اسم الزوج') || desc.includes('اسم الاب')) {
        const husband = members.find(m => m.role && (m.role.includes('زوج') || m.role.includes('أب')));
        return husband?.name || '-';
    }

    // معالجة تواريخ الميلاد
    if (desc.includes('تاريخ ميلاد') || desc.includes('تاريخ الميلاد')) {
        if (desc.includes('رب') || desc.includes('الاب') || desc.includes('الزوج')) {
            const head = findHeadOfFamily(members);
            return head?.dob || '-';
        }
        if (desc.includes('زوجة')) {
            const wife = members.find(m => m.role && m.role.includes('زوجة'));
            return wife?.dob || '-';
        }
    }

    const head = findHeadOfFamily(members);
    if (desc.includes('رب الاسرة') || desc.includes('الاسم الكامل') || desc.includes('الاسم الثلاثي')) return head?.name || '-';
    if (desc.includes('هوية') || desc.includes('رقم')) return head?.nid || '-';

    return "-";
};

const getAILogic = async (columns) => {
    const smartColumns = columns.filter(c => !c.system);
    if (smartColumns.length === 0) return {};

    const tryFetch = async (url) => {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ columns: smartColumns })
        });
        if (!response.ok) throw new Error(`Failed: ${response.status}`);
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) throw new Error("Not JSON");
        return await response.json();
    };

    try {
        // 1. جرب مسار Vercel أولاً
        try {
            const data = await tryFetch('/api/process-report');
            return data.logic || data;
        } catch (e) {
            // 2. إذا فشل، جرب مسار Netlify
            const data = await tryFetch('/.netlify/functions/process-report');
            return data.logic || data;
        }
    } catch (e) {
        console.error("AI Bridge Notice:", e.message);
        throw e;
    }
};

const calculateAge = (dob) => {
    if (!dob) return 0;
    try {
        const birthDate = new Date(dob);
        if (isNaN(birthDate.getTime())) return 0;
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        return age;
    } catch (e) { return 0; }
};

export default function SmartReport() {
    const { user } = useAuth();
    const { selectedCamp } = useCamp();

    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [families, setFamilies] = useState([]);
    const [individuals, setIndividuals] = useState([]);

    const [columns, setColumns] = useState([
        { id: '1', label: 'رقم العائلة', description: 'رقم العائلة المسجل', system: true },
        { id: '2', label: 'اسم رب العائلة', description: 'الاسم الكامل لمن يعيل الاسرة', system: true },
        { id: '3', label: 'عدد الافراد (11-17)', description: 'اريد عدد الافراد الدين اعامارهم من 11 الى 17', system: false }
    ]);

    const [reportData, setReportData] = useState([]);

    useEffect(() => {
        if (selectedCamp) {
            loadData();
        }
    }, [selectedCamp]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [f, i] = await Promise.all([
                getAllFamilies(selectedCamp.camp_id),
                getAllIndividuals(selectedCamp.camp_id)
            ]);
            setFamilies(f);
            setIndividuals(i);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const addColumn = () => {
        const newCol = {
            id: Math.random().toString(36).substr(2, 9),
            label: '',
            description: '',
            system: false
        };
        setColumns([...columns, newCol]);
    };

    const removeColumn = (id) => {
        setColumns(columns.filter(c => c.id !== id));
    };

    const updateColumn = (id, field, value) => {
        setColumns(columns.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const generateReport = async () => {
        setProcessing(true);
        setError(null);
        let mode = 'ai';
        let logicMap = {};

        try {
            // 1. Try to get logic from Gemini
            logicMap = await getAILogic(columns);
        } catch (e) {
            console.warn("Switching to Local Processing Mode:", e.message);
            mode = 'local';
            if (e.message === "API_KEY_MISSING") {
                setError("تنبيه: مفتاح AI غير موجود. تم استخدام المحرك المحلي البسيط.");
            } else {
                setError("تنبيه: تعذر الاتصال بالذكاء الاصطناعي (CORS/Halt). تم استخدام المحرك المحلي تلقائياً.");
            }
        }

        try {
            // 2. Execute Logic
            console.log("Smart Report Debug - Mode:", mode);
            if (mode === 'ai') console.log("Smart Report Debug - AI Logic:", logicMap);

            const processed = families.map(fam => {
                const members = individuals.filter(ind => ind.family_id === fam.family_id);
                // Log roles for the first family to debug
                if (fam.family_number === "1" || fam.family_number === 1) {
                    console.log(`Family #1 Roles:`, members.map(m => `"${m.role}"`).join(", "));
                }
                const rowData = {};

                columns.forEach(col => {
                    if (col.system) {
                        if (col.id === '1') rowData[col.label] = fam.family_number;
                        if (col.id === '2') {
                            const head = findHeadOfFamily(members);
                            rowData[col.label] = head?.name || '-';
                        }
                    } else {
                        if (mode === 'ai') {
                            const expression = logicMap[col.id];
                            if (expression) {
                                try {
                                    const execute = new Function('family', 'members', 'helpers', `return ${expression}`);
                                    const result = execute(fam, members, { calculateAge });
                                    rowData[col.label] = (result !== undefined && result !== null && result !== "") ? result : "-";
                                } catch (e) {
                                    console.error(`AI Execution Error [${col.label}]:`, e);
                                    rowData[col.label] = processLocalSmartValue(col.description, fam, members) || "-";
                                }
                            } else {
                                rowData[col.label] = processLocalSmartValue(col.description, fam, members) || "-";
                            }
                        } else {
                            rowData[col.label] = processLocalSmartValue(col.description, fam, members) || "-";
                        }
                    }
                });
                return rowData;
            });

            console.log("Smart Report Debug - Sample Data:", processed.slice(0, 2));
            setReportData(processed);
        } catch (e) {
            console.error(e);
            setError("حدث خطأ أثناء معالجة البيانات");
        } finally {
            setProcessing(false);
        }
    };

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(reportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "تقرير ذكي");
        XLSX.writeFile(wb, `Smart_Report_${selectedCamp?.name}.xlsx`);
    };

    return (
        <div className="min-h-full bg-slate-50/50" dir="rtl">
            {/* Header Section */}
            <div className="bg-white border-b border-indigo-100 p-6 mb-8 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
                            <Brain className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800">منشئ التقارير الذكي (AI)</h1>
                            <p className="text-slate-500 text-sm font-medium mt-1">قم بوصف ما تريد استخراجه وسيقوم البرنامج بفهم المطلوب</p>
                        </div>
                    </div>
                    {reportData.length > 0 && (
                        <button
                            onClick={exportToExcel}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-100 active:scale-95"
                        >
                            <FileSpreadsheet className="h-5 w-5" />
                            تصدير إلى Excel
                        </button>
                    )}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 pb-20">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Editor */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-indigo-500" />
                                    تنسيق ملف الإكسل
                                </h2>
                                <button
                                    onClick={addColumn}
                                    className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition-colors"
                                    title="إضافة عامود جديد"
                                >
                                    <Plus className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-4 max-h-[50vh] overflow-y-auto px-1 custom-scrollbar">
                                <AnimatePresence initial={false}>
                                    {error && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            className="bg-red-50 border border-red-100 p-4 rounded-2xl flex gap-3 text-red-600 text-sm font-bold items-start mb-4"
                                        >
                                            <AlertCircle className="h-5 w-5 shrink-0" />
                                            {error}
                                        </motion.div>
                                    )}
                                    {columns.map((col, index) => (
                                        <motion.div
                                            key={col.id}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className={`p-5 rounded-2xl border transition-all ${col.system ? 'bg-slate-50 border-slate-100' : 'bg-white border-indigo-100 shadow-sm'}`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">العامود #{index + 1}</span>
                                                {!col.system && (
                                                    <button onClick={() => removeColumn(col.id)} className="text-red-400 hover:text-red-600 p-1">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="space-y-3">
                                                <input
                                                    placeholder="عنوان العامود (مثلاً: عدد الأطفال)"
                                                    value={col.label}
                                                    onChange={e => updateColumn(col.id, 'label', e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-300"
                                                />
                                                <textarea
                                                    placeholder="صف ما تريد عرضه هنا باللغة العربية..."
                                                    value={col.description}
                                                    onChange={e => updateColumn(col.id, 'description', e.target.value)}
                                                    disabled={col.system}
                                                    rows={2}
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-300 resize-none disabled:bg-slate-50 disabled:text-slate-400"
                                                />
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>

                            <button
                                onClick={generateReport}
                                disabled={processing || loading || !selectedCamp}
                                className="w-full mt-8 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-indigo-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                {processing ? (
                                    <>
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                        جاري تحليل البيانات...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-6 w-6" />
                                        توليد الملف بالذكاء الاصطناعي
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Tip Box */}
                        <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100">
                            <div className="flex gap-4">
                                <Info className="h-5 w-5 text-amber-600 shrink-0 mt-1" />
                                <div>
                                    <h4 className="font-black text-amber-900 text-sm">كيف تصف البيانات؟</h4>
                                    <p className="text-xs text-amber-800/80 mt-1 leading-relaxed">
                                        يمكنك كتابة طلبات مثل:<br />
                                        - "عدد الأطفال أقل من 10 سنوات"<br />
                                        - "هل يوجد أرملة في العائلة"<br />
                                        - "اسم رب الأسرة ورقم هويته"
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Preview */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden h-full flex flex-col">
                            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                                <h3 className="font-black text-slate-800 flex items-center gap-3">
                                    <Table className="h-5 w-5 text-indigo-500" />
                                    معاينة البيانات (آخر 10 عائلات)
                                </h3>
                                {reportData.length > 0 && (
                                    <span className="bg-indigo-50 text-indigo-600 text-xs font-black px-4 py-1.5 rounded-full">
                                        إجمالي العائلات: {reportData.length}
                                    </span>
                                )}
                            </div>

                            <div className="flex-1 overflow-auto custom-scrollbar">
                                {reportData.length > 0 ? (
                                    <table className="w-full border-collapse">
                                        <thead className="bg-slate-50 sticky top-0">
                                            <tr>
                                                {columns.map(col => (
                                                    <th key={col.id} className="text-right p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                                        {col.label || 'بدون عنوان'}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {reportData.slice(0, 10).map((row, i) => (
                                                <tr key={i} className="hover:bg-indigo-50/20 transition-colors">
                                                    {columns.map(col => (
                                                        <td key={col.id} className="p-5 text-sm font-bold text-slate-600">
                                                            {row[col.label] ?? '-'}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center p-20 text-center">
                                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                            <FileSpreadsheet className="h-10 w-10 text-slate-200" />
                                        </div>
                                        <h4 className="text-lg font-black text-slate-400">لا يوجد بيانات لعرضها</h4>
                                        <p className="text-slate-300 text-sm mt-2">قم بضبط الأعمدة ثم اضغط على "توليد الملف" للبدء</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </div>
    );
}
