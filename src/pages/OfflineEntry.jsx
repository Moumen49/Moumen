import React, { useState, useEffect } from 'react';
import { createFamily, createIndividual, getAllFamilies, getDelegates, checkNidExists } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useCamp } from '../context/CampContext';
import { Plus, Trash2, Save, Wifi, WifiOff, Upload, User, AlertCircle, FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OfflineEntry() {
    const { user } = useAuth();
    const { selectedCamp } = useCamp();
    const [loading, setLoading] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Drafts State
    const [drafts, setDrafts] = useState([]);
    const [showDraftsMobile, setShowDraftsMobile] = useState(false);

    // Form State
    const [familyNumber, setFamilyNumber] = useState('');
    const [familyAddress, setFamilyAddress] = useState('');
    const [familyPhone, setFamilyPhone] = useState('');
    const [alternativeMobile, setAlternativeMobile] = useState('');
    const [housingStatus, setHousingStatus] = useState('');
    const [familyNeeds, setFamilyNeeds] = useState('');
    const [selectedDelegate, setSelectedDelegate] = useState('');
    const [delegates, setDelegates] = useState([]);

    const [shelterType, setShelterType] = useState('');
    const [shelterOther, setShelterOther] = useState('');

    const [members, setMembers] = useState([]);
    const [currentMember, setCurrentMember] = useState({
        name: '', nid: '', role: 'son', healthNotes: '', isPregnant: false, isNursing: false, guardianGender: 'male', roleDescription: '', deceasedHusbandName: '', husbandDeathDate: '',
        shoeSize: '', clothesSize: ''
    });

    // DOB Fields
    const [dobDay, setDobDay] = useState('');
    const [dobMonth, setDobMonth] = useState('');
    const [dobYear, setDobYear] = useState('');

    // Death Date Fields (for Widow)
    const [deathDay, setDeathDay] = useState('');
    const [deathMonth, setDeathMonth] = useState('');
    const [deathYear, setDeathYear] = useState('');

    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const roles = [
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

    // Load Drafts from LocalStorage
    useEffect(() => {
        const savedDrafts = localStorage.getItem('offline_drafts');
        if (savedDrafts) {
            setDrafts(JSON.parse(savedDrafts));
        }

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Load Delegates
    useEffect(() => {
        if (selectedCamp) {
            loadDelegates();
        }
    }, [selectedCamp]);

    const loadDelegates = async () => {
        try {
            if (navigator.onLine) {
                const list = await getDelegates(selectedCamp.camp_id);
                setDelegates(list);
                localStorage.setItem(`delegates_${selectedCamp.camp_id}`, JSON.stringify(list));
            } else {
                const cached = localStorage.getItem(`delegates_${selectedCamp.camp_id}`);
                if (cached) setDelegates(JSON.parse(cached));
            }
        } catch (e) { console.error(e); }
    };

    // Auto-Suggest Next Family Number
    useEffect(() => {
        if (selectedCamp) {
            updateNextFamilyNumber();
        }
    }, [selectedCamp, isOnline, drafts]);

    const updateNextFamilyNumber = async () => {
        let maxDbNum = 0;

        if (isOnline && selectedCamp) {
            try {
                const families = await getAllFamilies(selectedCamp.camp_id);
                if (families.length > 0) {
                    maxDbNum = families.reduce((max, f) => {
                        const num = parseInt(f.family_number);
                        return !isNaN(num) && num > max ? num : max;
                    }, 0);
                }
            } catch (e) {
                console.error("Error fetching families for number suggestion:", e);
            }
        }

        let maxDraftNum = 0;
        const campDrafts = drafts.filter(d => d.campId === selectedCamp?.camp_id);
        if (campDrafts.length > 0) {
            maxDraftNum = campDrafts.reduce((max, d) => {
                const num = parseInt(d.familyNumber);
                return !isNaN(num) && num > max ? num : max;
            }, 0);
        }

        const savedNext = parseInt(localStorage.getItem(`next_fam_num_${selectedCamp?.camp_id}`)) || 0;
        const nextNum = Math.max(maxDbNum, maxDraftNum, savedNext - 1) + 1;

        if (familyNumber === '') {
            setFamilyNumber(String(nextNum));
        }
    };

    // --- Validation Logic ---
    const validatePhoneNumber = (phone) => {
        if (!phone || phone.trim() === '') return true;
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 10) return digits.startsWith('0');
        if (digits.length === 9) return !digits.startsWith('0');
        return false;
    };

    const determineGenderFromRole = (role) => {
        if (['husband', 'son', 'father', 'grandfather', 'brother', 'uncle'].includes(role)) return 'male';
        if (['wife', 'daughter', 'mother', 'grandmother', 'sister', 'aunt', 'widow', 'divorced', 'abandoned', 'second_wife'].includes(role)) return 'female';
        return 'male';
    };

    const handleAddMember = async () => {
        // Name Validation
        if (!currentMember.name.trim()) return alert('⚠️ أدخل اسم الفرد');

        // DOB Validation
        if (!dobDay || !dobMonth || !dobYear) return alert('⚠️ تاريخ الميلاد مطلوب');
        const day = parseInt(dobDay), month = parseInt(dobMonth), year = parseInt(dobYear);
        const currentYear = new Date().getFullYear();

        if (isNaN(day) || day < 1 || day > 31 ||
            isNaN(month) || month < 1 || month > 12 ||
            isNaN(year) || year < 1900 || year > currentYear) {
            return alert('⚠️ تاريخ الميلاد غير صحيح');
        }

        const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        let finalDeathDate = '';

        // Widow Data Validation
        if (currentMember.role === 'widow') {
            if (!currentMember.deceasedHusbandName) return alert('⚠️ يرجى إدخال اسم الزوج المتوفي');

            // Death Date Validation
            if (!deathDay || !deathMonth || !deathYear) return alert('⚠️ تاريخ وفاة الزوج مطلوب');
            const dDay = parseInt(deathDay), dMonth = parseInt(deathMonth), dYear = parseInt(deathYear);

            if (isNaN(dDay) || dDay < 1 || dDay > 31 ||
                isNaN(dMonth) || dMonth < 1 || dMonth > 12 ||
                isNaN(dYear) || dYear < 1900 || dYear > currentYear) {
                return alert('⚠️ تاريخ الوفاة غير صحيح');
            }
            finalDeathDate = `${dYear}-${String(dMonth).padStart(2, '0')}-${String(dDay).padStart(2, '0')}`;
        }

        // NID Validation
        if (!currentMember.nid || currentMember.nid.length === 0) return alert('⚠️ رقم الهوية مطلوب');
        const nidDigits = currentMember.nid.replace(/\D/g, '');
        if (nidDigits.length !== 9) return alert('⚠️ رقم الهوية يجب أن يتكون من 9 أرقام بالضبط');

        if (members.some(m => m.nid === nidDigits)) {
            return alert('⚠️ رقم الهوية هذا مضاف بالفعل في هذه العائلة!');
        }

        const isDuplicateInDrafts = drafts.some(draft =>
            draft.members && draft.members.some(m => m.nid === nidDigits)
        );

        if (isDuplicateInDrafts) {
            return alert('⚠️ انتبه: رقم الهوية هذا موجود في مسودة أخرى محفوظة مسبقاً!');
        }

        if (isOnline) {
            try {
                const existsInDB = await checkNidExists(nidDigits);
                if (existsInDB) {
                    return alert('⚠️ رقم الهوية هذا مسجل مسبقاً في قاعدة البيانات!');
                }
            } catch (e) {
                console.error('Error checking DB:', e);
            }
        }

        setMembers([...members, {
            ...currentMember,
            nid: nidDigits,
            dob: formattedDate,
            husbandDeathDate: finalDeathDate,
            id: Date.now()
        }]);

        // Reset Member Form
        setCurrentMember({
            name: '', nid: '', role: 'son', healthNotes: '', isPregnant: false, isNursing: false, guardianGender: 'male', roleDescription: '', deceasedHusbandName: '', husbandDeathDate: '',
            shoeSize: '', clothesSize: ''
        });
        setDobDay(''); setDobMonth(''); setDobYear('');
        setDeathDay(''); setDeathMonth(''); setDeathYear('');
    };

    const saveDraft = () => {
        if (!familyNumber) return alert('⚠️ رقم العائلة مطلوب');
        if (!familyAddress) return alert('⚠️ العنوان مطلوب');

        if (familyPhone && !validatePhoneNumber(familyPhone)) {
            return alert('⚠️ رقم الجوال غير صحيح.\nيجب أن يكون 10 أرقام يبدأ بـ 0\nأو 9 أرقام لا يبدأ بـ 0');
        }

        if (alternativeMobile && !validatePhoneNumber(alternativeMobile)) {
            return alert('⚠️ رقم الجوال البديل غير صحيح.');
        }

        if (members.length === 0) return alert('⚠️ يجب إضافة فرد واحد على الأقل');

        const cleanPhone = familyPhone.replace(/\D/g, '');
        const cleanAltMobile = alternativeMobile.replace(/\D/g, '');

        const newDraft = {
            id: Date.now(),
            campId: selectedCamp.camp_id,
            familyNumber,
            address: familyAddress,
            phone: cleanPhone,
            alternativeMobile: cleanAltMobile,
            housingStatus,
            familyNeeds,
            delegate: selectedDelegate,
            shelterType: shelterType,
            shelterOther: shelterOther,
            members,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        const updatedDrafts = [...drafts, newDraft];
        setDrafts(updatedDrafts);
        localStorage.setItem('offline_drafts', JSON.stringify(updatedDrafts));

        setSuccessMsg('تم حفظ المسودة محلياً بنجاح');
        setTimeout(() => setSuccessMsg(''), 2500);

        const currentNum = parseInt(familyNumber);
        if (!isNaN(currentNum)) {
            const nextNum = currentNum + 1;
            setFamilyNumber(String(nextNum));
            if (selectedCamp) {
                localStorage.setItem(`next_fam_num_${selectedCamp.camp_id}`, String(nextNum));
            }
        } else {
            setFamilyNumber('');
        }

        setFamilyAddress('');
        setFamilyPhone('');
        setAlternativeMobile('');
        setHousingStatus('');
        setFamilyNeeds('');
        setShelterType('');
        setShelterOther('');
        setMembers([]);
    };

    const deleteDraft = (id) => {
        if (!window.confirm('هل أنت متأكد من حذف هذه المسودة؟')) return;
        const updated = drafts.filter(d => d.id !== id);
        setDrafts(updated);
        localStorage.setItem('offline_drafts', JSON.stringify(updated));
    };

    const uploadDrafts = async () => {
        if (!isOnline) return alert('لا يوجد اتصال بالإنترنت');
        setLoading(true);

        const pending = drafts.filter(d => d.campId === selectedCamp.camp_id);
        if (pending.length === 0) {
            setLoading(false);
            return alert('لا توجد مسودات لهذا المخيم للرفع');
        }

        let successCount = 0;
        let failCount = 0;

        for (const draft of pending) {
            try {
                const allFams = await getAllFamilies(draft.campId);
                if (allFams.some(f => f.family_number === draft.familyNumber)) {
                    throw new Error(`رقم العائلة ${draft.familyNumber} موجود مسبقاً`);
                }

                for (const m of draft.members) {
                    if (m.nid) {
                        const exists = await checkNidExists(m.nid);
                        if (exists) {
                            throw new Error(`رقم الهوية (${m.nid}) للمدعو ${m.name} مسجل مسبقاً في النظام`);
                        }
                    }
                }

                const fam = await createFamily({
                    family_number: draft.familyNumber,
                    address: draft.address,
                    contact: draft.phone,
                    alternative_mobile: draft.alternativeMobile || null,
                    housing_status: draft.housingStatus || null,
                    family_needs: draft.familyNeeds || null,
                    delegate: draft.delegate || null,
                    shelter_type: draft.shelterType || null,
                    shelter_type_other: draft.shelterType === 'other' ? draft.shelterOther : null,
                    camp_id: draft.campId
                });

                for (const m of draft.members) {
                    let gender;
                    if (m.role === 'guardian') {
                        gender = m.guardianGender || 'male';
                    } else {
                        gender = determineGenderFromRole(m.role);
                    }

                    await createIndividual({
                        family_id: fam.family_id,
                        name: m.name,
                        nid: m.nid || null,
                        dob: m.dob || null,
                        gender: gender,
                        role: m.role,
                        role_description: m.role === 'other' ? m.roleDescription : null,
                        deceased_husband_name: m.role === 'widow' ? m.deceasedHusbandName : null,
                        husband_death_date: m.role === 'widow' ? m.husbandDeathDate : null,
                        is_pregnant: m.isPregnant || false,
                        is_nursing: m.isNursing || false,
                        shoe_size: m.shoeSize || null,
                        clothes_size: m.clothesSize || null,
                        notes: m.healthNotes || null
                    });
                }

                successCount++;
                deleteDraftInternal(draft.id);

            } catch (err) {
                console.error(err);
                failCount++;
                updateDraftStatus(draft.id, 'error', err.message);
            }
        }

        setLoading(false);
        if (successCount > 0) setSuccessMsg(`✅ تم رفع ${successCount} عائلة بنجاح!`);
        if (failCount > 0) setErrorMsg(`⚠️ فشل رفع ${failCount} عائلة. تحقق من الأخطاء في القائمة.`);

        setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 5000);
    };

    const deleteDraftInternal = (id) => {
        setDrafts(current => {
            const updated = current.filter(d => d.id !== id);
            localStorage.setItem('offline_drafts', JSON.stringify(updated));
            return updated;
        });
    };

    const updateDraftStatus = (id, status, error) => {
        setDrafts(current => {
            const updated = current.map(d => d.id === id ? { ...d, status, error } : d);
            localStorage.setItem('offline_drafts', JSON.stringify(updated));
            return updated;
        });
    };

    const loadDraftToEdit = (draft) => {
        if (!window.confirm('تحميل المسودة للتعديل؟ سيتم حذفها من القائمة وتحتاج لحفظها مجدداً.')) return;
        setFamilyNumber(draft.familyNumber);
        setFamilyAddress(draft.address);
        setFamilyPhone(draft.phone);
        setAlternativeMobile(draft.alternativeMobile || '');
        setHousingStatus(draft.housingStatus || '');
        setFamilyNeeds(draft.familyNeeds || '');
        setSelectedDelegate(draft.delegate || '');
        setShelterType(draft.shelterType || '');
        setShelterOther(draft.shelterOther || '');
        setMembers(draft.members);

        setShowDraftsMobile(false);
        deleteDraftInternal(draft.id);
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-100px)] pb-24 md:pb-10 px-4 md:px-0">

            {/* --- Main Left Column: Form --- */}
            <div className="flex-1 order-2 md:order-1">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                        <div className="bg-gray-100 p-2 rounded-xl">
                            <WifiOff className="h-5 w-5 md:h-6 md:w-6 text-gray-500" />
                        </div>
                        <span className="md:inline">إدخال بيانات (دون اتصال)</span>
                    </h1>
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        <div className={`px-4 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-2 border shadow-sm ${isOnline ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {isOnline ? <><Wifi className="h-3.5 w-3.5" /> متصل</> : <><WifiOff className="h-3.5 w-3.5" /> مقطوع</>}
                        </div>
                        {/* Mobile Toggle for Drafts */}
                        <button
                            onClick={() => setShowDraftsMobile(!showDraftsMobile)}
                            className="md:hidden bg-indigo-600 p-2.5 rounded-xl text-white relative shadow-lg shadow-indigo-200 active:scale-95 transition"
                        >
                            <FileText className="h-5 w-5" />
                            {drafts.length > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white font-bold">
                                    {drafts.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Status Messages */}
                <AnimatePresence>
                    {successMsg && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-xl mb-4 text-sm font-bold shadow-sm">
                            {successMsg}
                        </motion.div>
                    )}
                    {errorMsg && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl mb-4 text-sm font-bold shadow-sm">
                            {errorMsg}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Family Info Card */}
                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <h3 className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-2 border-b pb-2">بيانات العائلة</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">رقم العائلة <span className="text-red-500">*</span></label>
                            <input
                                value={familyNumber} onChange={e => setFamilyNumber(e.target.value)}
                                className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 text-base focus:border-indigo-500 focus:ring-0 transition outline-none"
                                placeholder="مثال: 101" inputMode="numeric"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">المفوض</label>
                            <select
                                value={selectedDelegate} onChange={e => setSelectedDelegate(e.target.value)}
                                className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 text-base focus:border-indigo-500 focus:ring-0 transition outline-none bg-white"
                            >
                                <option value="">بدون مفوض</option>
                                {delegates.map((d, i) => <option key={i} value={d.name}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-600 mb-1">العنوان <span className="text-red-500">*</span></label>
                            <input
                                value={familyAddress} onChange={e => setFamilyAddress(e.target.value)}
                                className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 text-base focus:border-indigo-500 focus:ring-0 transition outline-none"
                                placeholder="المنطقة، المعلم الأقرب"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-600 mb-1">رقم الجوال</label>
                            <input
                                value={familyPhone}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    if (val.length <= 10) setFamilyPhone(val);
                                }}
                                className={`w-full border-2 rounded-xl px-3 py-2 text-base focus:ring-0 transition outline-none ${familyPhone && !validatePhoneNumber(familyPhone)
                                    ? 'border-red-300 bg-red-50 focus:border-red-500'
                                    : 'border-gray-100 focus:border-indigo-500'
                                    }`}
                                placeholder="059xxxxxxx" inputMode="tel"
                            />
                            {familyPhone && !validatePhoneNumber(familyPhone) && (
                                <p className="text-[10px] text-red-500 mt-1">يجب أن يكون 10 أرقام (يبدأ بـ 0) أو 9 أرقام (بدون 0)</p>
                            )}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-600 mb-1">رقم جوال بديل (اختياري)</label>
                            <input
                                value={alternativeMobile}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    if (val.length <= 10) setAlternativeMobile(val);
                                }}
                                className={`w-full border-2 rounded-xl px-3 py-2 text-base focus:ring-0 transition outline-none ${alternativeMobile && !validatePhoneNumber(alternativeMobile)
                                    ? 'border-red-300 bg-red-50 focus:border-red-500'
                                    : 'border-gray-100 focus:border-indigo-500'
                                    }`}
                                placeholder="059xxxxxxx" inputMode="tel"
                            />
                            {alternativeMobile && !validatePhoneNumber(alternativeMobile) && (
                                <p className="text-[10px] text-red-500 mt-1">يجب أن يكون 10 أرقام (يبدأ بـ 0) أو 9 أرقام (بدون 0)</p>
                            )}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-600 mb-1">حالة السكن</label>
                            <select
                                value={housingStatus} onChange={e => setHousingStatus(e.target.value)}
                                className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 text-base focus:border-indigo-500 bg-white outline-none"
                            >
                                <option value="">-- اختر حالة السكن --</option>
                                <option value="سيء">سيء</option>
                                <option value="جيد">جيد</option>
                                <option value="ممتاز">ممتاز</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-600 mb-1">احتياجات الأسرة</label>
                            <input
                                value={familyNeeds} onChange={e => setFamilyNeeds(e.target.value)}
                                className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 text-base focus:border-indigo-500 outline-none"
                                placeholder="..."
                            />
                        </div>
                    </div>

                    <div className="mt-4 border-t pt-4">
                        <label className="block text-xs font-bold text-gray-600 mb-1">نوع السكن / الخيمة</label>
                        <select
                            value={shelterType} onChange={e => setShelterType(e.target.value)}
                            className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 text-base focus:border-indigo-500 bg-white outline-none"
                        >
                            <option value="">-- اختر نوع السكن --</option>
                            <option value="ready_tent">خيمة جاهزة</option>
                            <option value="manufactured_tent">خيمة مصنعة</option>
                            <option value="house">بيت</option>
                            <option value="other">أخرى</option>
                        </select>
                        {shelterType === 'other' && (
                            <input
                                value={shelterOther} onChange={e => setShelterOther(e.target.value)}
                                className="w-full border-2 border-indigo-100 rounded-xl px-3 py-2 mt-2 text-base focus:border-indigo-500 outline-none"
                                placeholder="وضح المتوفر"
                            />
                        )}
                    </div>
                </div>

                {/* Member Form Card */}
                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 mt-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-50 rounded-bl-[80px] -z-0"></div>
                    <h3 className="font-bold mb-4 flex items-center gap-2 relative z-10 text-indigo-900">
                        <User className="h-5 w-5" /> إضافة أفراد العائلة
                    </h3>

                    {/* Member Input Form - Grid Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">

                        {/* Row 1: Name and Role */}
                        <div className="md:col-span-3">
                            <label className="block text-[10px] font-bold text-gray-400 mb-1">الاسم الرباعي <span className="text-red-500">*</span></label>
                            <input
                                value={currentMember.name} onChange={e => setCurrentMember({ ...currentMember, name: e.target.value })}
                                placeholder="الاسم الرباعي"
                                className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 focus:border-indigo-500 outline-none text-base"
                            />
                        </div>

                        <div className="md:col-span-1">
                            <label className="block text-[10px] font-bold text-gray-400 mb-1">الصفة</label>
                            <select
                                value={currentMember.role}
                                onChange={e => setCurrentMember({ ...currentMember, role: e.target.value })}
                                className="w-full border-2 border-gray-100 rounded-xl px-2 py-2 focus:border-indigo-500 outline-none text-base bg-white"
                            >
                                {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>

                        {/* Row 2: Conditional Fields */}
                        <AnimatePresence>
                            {/* جنس الوصي */}
                            {currentMember.role === 'guardian' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="md:col-span-4"
                                >
                                    <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-200">
                                        <label className="block text-[10px] font-bold text-gray-600 mb-1">جنس الوصي</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-yellow-100">
                                                <input type="radio" value="male" checked={currentMember.guardianGender === 'male'} onChange={() => setCurrentMember({ ...currentMember, guardianGender: 'male' })} name="gGender" />
                                                <span>ذكر</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-yellow-100">
                                                <input type="radio" value="female" checked={currentMember.guardianGender === 'female'} onChange={() => setCurrentMember({ ...currentMember, guardianGender: 'female' })} name="gGender" />
                                                <span>أنثى</span>
                                            </label>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* وصف الأخرى */}
                            {currentMember.role === 'other' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="md:col-span-4"
                                >
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">وصف الصفة</label>
                                    <input
                                        value={currentMember.roleDescription}
                                        onChange={e => setCurrentMember({ ...currentMember, roleDescription: e.target.value })}
                                        placeholder="مثال: عم، خال..."
                                        className="w-full border-2 border-yellow-200 bg-yellow-50 rounded-xl px-3 py-2 focus:border-indigo-500 outline-none text-base"
                                    />
                                </motion.div>
                            )}

                            {/* بيانات الأرملة */}
                            {currentMember.role === 'widow' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="md:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-purple-50 p-4 rounded-xl border border-purple-100"
                                >
                                    <div>
                                        <label className="block text-[10px] font-bold text-purple-700 mb-1">اسم الزوج المتوفي</label>
                                        <input
                                            value={currentMember.deceasedHusbandName}
                                            onChange={e => setCurrentMember({ ...currentMember, deceasedHusbandName: e.target.value })}
                                            className="w-full border-2 border-white bg-white rounded-xl px-3 py-2 focus:border-purple-500 outline-none text-base"
                                            placeholder="الاسم الثلاثي"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-purple-700 mb-1">تاريخ الوفاة</label>
                                        <div className="grid grid-cols-3 gap-2" dir="ltr">
                                            <input placeholder="Y" className="w-full border-2 border-white bg-white rounded-xl px-1 py-2 text-center text-base outline-none focus:border-purple-500" inputMode="numeric" value={deathYear} onChange={e => setDeathYear(e.target.value)} />
                                            <input placeholder="M" className="w-full border-2 border-white bg-white rounded-xl px-1 py-2 text-center text-base outline-none focus:border-purple-500" inputMode="numeric" value={deathMonth} onChange={e => setDeathMonth(e.target.value)} />
                                            <input placeholder="D" className="w-full border-2 border-white bg-white rounded-xl px-1 py-2 text-center text-base outline-none focus:border-purple-500" inputMode="numeric" value={deathDay} onChange={e => setDeathDay(e.target.value)} />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Row 3: DOB, NID, Button */}
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-gray-400 mb-1">تاريخ الميلاد <span className="text-red-500">*</span></label>
                            <div className="grid grid-cols-3 gap-2" dir="ltr">
                                <input placeholder="Y" className="w-full border-2 border-gray-100 rounded-xl px-1 py-2 text-center text-base outline-none focus:border-indigo-500" inputMode="numeric" value={dobYear} onChange={e => setDobYear(e.target.value)} />
                                <input placeholder="M" className="w-full border-2 border-gray-100 rounded-xl px-1 py-2 text-center text-base outline-none focus:border-indigo-500" inputMode="numeric" value={dobMonth} onChange={e => setDobMonth(e.target.value)} />
                                <input placeholder="D" className="w-full border-2 border-gray-100 rounded-xl px-1 py-2 text-center text-base outline-none focus:border-indigo-500" inputMode="numeric" value={dobDay} onChange={e => setDobDay(e.target.value)} />
                            </div>
                        </div>

                        {/* Sizes */}
                        <div className="md:col-span-2 flex gap-2">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-gray-400 mb-1">مقاس الحذاء</label>
                                <input
                                    value={currentMember.shoeSize} onChange={e => setCurrentMember({ ...currentMember, shoeSize: e.target.value })}
                                    placeholder="مثال: 42"
                                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 focus:border-indigo-500 outline-none text-base"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-gray-400 mb-1">مقاس الملابس</label>
                                <input
                                    value={currentMember.clothesSize} onChange={e => setCurrentMember({ ...currentMember, clothesSize: e.target.value })}
                                    placeholder="مثال: XL"
                                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 focus:border-indigo-500 outline-none text-base"
                                />
                            </div>
                        </div>

                        {/* NID & Add Button */}
                        <div className="md:col-span-4 flex gap-3 items-end">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-gray-400 mb-1">رقم الهوية (9 أرقام) <span className="text-red-500">*</span></label>
                                <input
                                    value={currentMember.nid}
                                    onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 9);
                                        setCurrentMember({ ...currentMember, nid: val });
                                    }}
                                    placeholder="رقم الهوية"
                                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 focus:border-indigo-500 outline-none text-base font-mono tracking-widest text-center"
                                    inputMode="numeric"
                                />
                            </div>
                            <button
                                onClick={handleAddMember}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-[46px] w-[46px] flex items-center justify-center shadow-lg transition transform active:scale-95 shrink-0 mb-[1px]"
                                title="إضافة الفرد"
                            >
                                <Plus className="h-6 w-6" />
                            </button>
                        </div>
                    </div>

                    {/* Members List */}
                    <div className="space-y-2 mt-4 bg-gray-50/50 rounded-xl p-2 min-h-[100px]">
                        {members.length === 0 && <p className="text-center text-gray-400 text-xs py-8">لم يتم إضافة أفراد بعد</p>}
                        {
                            members.map((m, idx) => (
                                <div key={m.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 shadow-sm animate-in slide-in-from-bottom-2 fade-in duration-300">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded flex items-center justify-center text-xs font-bold">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">{m.name}</p>
                                            <div className="flex gap-2 text-[10px] text-gray-500">
                                                <span>{roles.find(r => r.value === m.role)?.label}</span>
                                                <span>•</span>
                                                <span className="font-mono">{m.dob}</span>
                                                <span>•</span>
                                                <span className="font-mono">{m.nid}</span>
                                                {(m.shoeSize || m.clothesSize) && <span className="text-indigo-600">({m.shoeSize || '-'} / {m.clothesSize || '-'})</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => setMembers(members.filter(x => x.id !== m.id))} className="text-red-400 hover:bg-red-50 p-2 rounded-lg transition">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))
                        }
                    </div >
                </div >

                <div className="sticky bottom-4 mt-6">
                    <button
                        onClick={saveDraft}
                        className="w-full bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-xl transition transform active:scale-95"
                    >
                        <Save className="h-6 w-6" />
                        حفظ العائلة كمسودة
                    </button>
                </div>
            </div >

            {/* --- Sidebar: Drafts --- */}
            {/* Desktop: Small Fixed / Mobile: Drawer */}
            <div className={`
                fixed inset-y-0 right-0 z-50 w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out md:translate-x-0
                md:static md:w-56 md:shadow-none md:bg-gray-50 md:rounded-2xl md:h-auto md:order-2 md:border md:block
                ${showDraftsMobile ? 'translate-x-0' : 'translate-x-full'}
            `}>
                <div className="h-full flex flex-col p-4">
                    <div className="flex justify-between items-center mb-4 md:mb-6">
                        <h2 className="font-bold text-gray-700 flex items-center gap-2 text-sm md:text-base">
                            <FileText className="h-5 w-5" />
                            المسودات ({drafts.length})
                        </h2>
                        {/* Mobile Close Button */}
                        <button onClick={() => setShowDraftsMobile(false)} className="md:hidden text-gray-400">
                            <X className="h-6 w-6" />
                        </button>
                    </div>


                    {isOnline && drafts.length > 0 && selectedCamp && (
                        <button
                            onClick={uploadDrafts}
                            disabled={loading}
                            className="w-full mb-4 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload className="h-4 w-4" />}
                            <span>رفع الكل ({drafts.filter(d => d.campId === selectedCamp.camp_id).length})</span>
                        </button>
                    )}

                    <div className="flex-1 overflow-y-auto space-y-3 -mx-2 px-2 pb-20 md:pb-0 custom-scrollbar">
                        {drafts.length === 0 && (
                            <div className="text-center py-10 opacity-50 space-y-2">
                                <FileText className="h-12 w-12 mx-auto text-gray-300" />
                                <p className="text-xs">لا مسودات محفوظة</p>
                            </div>
                        )}

                        {drafts.map(draft => (
                            <div
                                key={draft.id}
                                className={`bg-white p-3 rounded-xl border relative group transition hover:shadow-md ${draft.status === 'error' ? 'border-red-200 bg-red-50' : 'border-gray-100'
                                    }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div onClick={() => loadDraftToEdit(draft)} className="cursor-pointer flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-gray-800 text-sm">#{draft.familyNumber}</h4>
                                            {draft.campId !== selectedCamp?.camp_id && (
                                                <span className="text-[9px] bg-gray-200 px-1 rounded text-gray-600">مخيم آخر</span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-0.5 max-w-[140px] truncate">{draft.members.length} أفراد</p>
                                    </div>
                                    <button onClick={() => deleteDraft(draft.id)} className="text-gray-400 hover:text-red-500 p-1">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                                {draft.error && (
                                    <div className="mt-2 text-[10px] text-red-600 bg-red-100/50 p-1.5 rounded flex items-start gap-1">
                                        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                        <span>{draft.error.substring(0, 50)}...</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mobile Overlay for Sidebar */}
            {
                showDraftsMobile && (
                    <div
                        className="fixed inset-0 bg-black/20 z-40 md:hidden backdrop-blur-sm"
                        onClick={() => setShowDraftsMobile(false)}
                    />
                )
            }
        </div >
    );
}
