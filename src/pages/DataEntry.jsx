import React, { useState, useEffect } from 'react';
import { createFamily, createIndividual, getAllFamilies, getAllIndividuals, batchImportFamilies, createNotification, getDelegates, checkNidExists, checkCrossCampDuplicates } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useCamp } from '../context/CampContext';
import * as XLSX from 'xlsx';
import { Plus, Trash2, Save, User, MapPin, Phone, Upload, Download, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DataEntry() {
    const { user } = useAuth();
    const { selectedCamp } = useCamp();
    const [loading, setLoading] = useState(false);

    // ... rest of state ...
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // Bulk Import State
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importTotal, setImportTotal] = useState(0);
    const [importCurrent, setImportCurrent] = useState(0);

    // Family State
    const [familyNumber, setFamilyNumber] = useState('');
    const [familyAddress, setFamilyAddress] = useState('');
    const [familyPhone, setFamilyPhone] = useState('');
    const [alternativeMobile, setAlternativeMobile] = useState('');
    const [housingStatus, setHousingStatus] = useState('');
    const [familyNeeds, setFamilyNeeds] = useState('');

    // Delegate State
    const [delegates, setDelegates] = useState([]);
    const [selectedDelegate, setSelectedDelegate] = useState('');

    // Shelter State
    const [shelterType, setShelterType] = useState('');
    const [shelterOther, setShelterOther] = useState('');

    const loadDelegates = async (campId) => {
        try {
            const list = await getDelegates(campId);
            setDelegates(list);
        } catch (error) {
            console.error('Failed to load delegates', error);
        }
    };

    const suggestNextFamilyNumber = async (campId) => {
        try {
            const families = await getAllFamilies(campId);
            if (families.length > 0) {
                // Families are already sorted by number in getAllFamilies
                const lastFamily = families[families.length - 1];
                const lastNum = parseInt(lastFamily.family_number, 10);
                if (!isNaN(lastNum)) {
                    setFamilyNumber(String(lastNum + 1));
                } else {
                    setFamilyNumber('1');
                }
            } else {
                setFamilyNumber('1');
            }
        } catch (error) {
            console.error('Failed to suggest family number', error);
        }
    };

    useEffect(() => {
        if (selectedCamp) {
            loadDelegates(selectedCamp.camp_id);
            suggestNextFamilyNumber(selectedCamp.camp_id); // Call suggestion on camp change
        } else {
            setDelegates([]);
            setFamilyNumber('');
        }
    }, [selectedCamp]);

    // Individuals State
    const [members, setMembers] = useState([]);

    // Current Member Form State
    const [currentMember, setCurrentMember] = useState({
        name: '',
        nid: '',
        dob: '',
        role: 'son',
        healthNotes: '',
        isPregnant: false,
        isNursing: false,
        guardianGender: 'male',
        roleDescription: '', // For 'other'
        deceasedHusbandName: '', // For 'widow'
        husbandDeathDate: '',     // For 'widow'
        shoeSize: '',
        clothesSize: ''
    });

    // Date of Birth fields (separate)
    const [dobDay, setDobDay] = useState('');
    const [dobMonth, setDobMonth] = useState('');
    const [dobYear, setDobYear] = useState('');

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

    const handleDownloadTemplate = () => {
        const headers = [
            'رقم العائلة', 'اسم الفرد', 'رقم الهوية', 'الصفة', 'عنوان العائلة',
            'تاريخ الميلاد', 'رقم تواصل العائلة', 'رقم جوال بديل',
            'نوع السكن', 'حالة السكن (سيء/جيد/ممتاز)', 'احتياجات الأسرة',
            'ملاحظات صحية', 'مقاس الحذاء', 'مقاس الملابس',
            'حامل؟ (نعم/لا)', 'مرضع؟ (نعم/لا)', 'المفوض'
        ];
        const sampleData = [
            [
                '101', 'أحمد علي', '800000000', 'زوج', 'غزة، الرمال',
                '1980-01-01', '0599000000', '0599111111',
                'خيمة جاهزة', 'جيد', 'حليب أطفال',
                'لا يوجد', '42', 'XL',
                'لا', 'لا', 'اسم المفوض'
            ],
            [
                '101', 'سارة أحمد', '900000000', 'زوجة', 'غزة، الرمال',
                '1985-05-15', '0599000000', '',
                'خيمة جاهزة', 'جيد', 'حليب أطفال',
                'سكري', '38', 'L',
                'نعم', 'لا', 'اسم المفوض'
            ],
            [
                '102', 'مريم خالد', '750000000', 'أرملة', 'خانيونس',
                '1975-03-10', '0598111111', '',
                'خيمة مصنعة', 'سيء', '',
                '', '39', 'XXL',
                'لا', 'لا', 'اسم مفوض آخر'
            ]
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
        const wb = XLSX.utils.book_new();
        if (!wb.Workbook) wb.Workbook = {};
        if (!wb.Workbook.Views) wb.Workbook.Views = [];
        if (!wb.Workbook.Views[0]) wb.Workbook.Views[0] = {};
        wb.Workbook.Views[0].RTL = true;

        XLSX.utils.book_append_sheet(wb, ws, "نموذج البيانات");
        XLSX.writeFile(wb, "family_data_template.xlsx");
    };

    const handleFileUpload = async (e) => {
        if (!selectedCamp) {
            alert('الرجاء اختيار المخيم أولاً من القائمة الجانبية');
            e.target.value = '';
            return;
        }

        const file = e.target.files[0];
        if (!file) return;

        setIsImporting(true);
        setLoading(true);
        setErrorMsg('');

        try {
            const data = await file.arrayBuffer();
            const wb = XLSX.read(data, { type: 'array', cellDates: true });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

            await processBulkData(rawData);
        } catch (err) {
            console.error('File upload error:', err);
            setErrorMsg('خطأ في قراءة الملف: ' + err.message);
        } finally {
            setIsImporting(false);
            setLoading(false);
            e.target.value = '';
        }
    };

    const processBulkData = async (rawData) => {
        if (rawData.length < 2) {
            setErrorMsg('الملف فارغ أو لا يحتوي على بيانات');
            return;
        }

        // Skip header row
        const rows = rawData.slice(1);

        // Role mapping for Arabic variations
        const roleMap = {
            'زوج': 'husband', 'أب': 'father', 'اب': 'father',
            'زوجة': 'wife', 'زوجه': 'wife', 'أم': 'mother', 'ام': 'mother',
            'ابن': 'son',
            'ابنة': 'daughter', 'إبنة': 'daughter', 'ابنه': 'daughter', 'إبنه': 'daughter',
            'أرملة': 'widow', 'ارملة': 'widow', 'أرمله': 'widow', 'ارمله': 'widow',
            'أرمل': 'widower', 'ارمل': 'widower',
            'مطلقة': 'divorced', 'مطلقه': 'divorced',
            'مهجورة': 'abandoned', 'مهجوره': 'abandoned',
            'جد': 'grandfather',
            'جدة': 'grandmother', 'جده': 'grandmother'
        };

        // Load delegates for validation
        const validDelegates = await getDelegates(selectedCamp?.camp_id);
        const delegateNames = validDelegates.map(d => d.name);

        // Helper function: Calculate Levenshtein distance
        const levenshteinDistance = (str1, str2) => {
            const matrix = [];
            const len1 = str1.length;
            const len2 = str2.length;

            for (let i = 0; i <= len2; i++) {
                matrix[i] = [i];
            }
            for (let j = 0; j <= len1; j++) {
                matrix[0][j] = j;
            }
            for (let i = 1; i <= len2; i++) {
                for (let j = 1; j <= len1; j++) {
                    if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                        matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                        matrix[i][j] = Math.min(
                            matrix[i - 1][j - 1] + 1,
                            matrix[i][j - 1] + 1,
                            matrix[i - 1][j] + 1
                        );
                    }
                }
            }
            return matrix[len2][len1];
        };

        // Helper function: Calculate similarity percentage
        const calculateSimilarity = (str1, str2) => {
            const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
            const maxLen = Math.max(str1.length, str2.length);
            return maxLen === 0 ? 100 : ((maxLen - distance) / maxLen) * 100;
        };

        // Helper function: Find best matching delegate
        const findBestDelegate = (inputDelegate) => {
            if (!inputDelegate) return null;

            let bestMatch = null;
            let bestSimilarity = 0;

            for (const delegateName of delegateNames) {
                const similarity = calculateSimilarity(inputDelegate, delegateName);
                if (similarity > bestSimilarity) {
                    bestSimilarity = similarity;
                    bestMatch = delegateName;
                }
            }

            // Return match only if similarity is >= 65%
            return bestSimilarity >= 65 ? bestMatch : null;
        };

        // Group by family number and track delegate issues
        const familiesMap = {};
        const delegateIssues = []; // Track families with invalid delegates

        for (const row of rows) {
            if (!row || row.length < 4) continue;

            const familyNum = String(row[0] || '').trim();
            const memberName = String(row[1] || '').trim();
            const memberNid = String(row[2] || '').trim();
            const memberRoleRaw = String(row[3] || '').trim();
            const familyAddress = String(row[4] || '').trim();
            const memberDob = row[5] ? parseExcelDate(row[5]) : null;
            const familyPhone = String(row[6] || '').trim();
            const alternativeMobile = String(row[7] || '').trim();
            const shelterTypeRaw = String(row[8] || '').trim();
            const housingStatus = String(row[9] || '').trim();
            const familyNeeds = String(row[10] || '').trim();
            const healthNotes = String(row[11] || '').trim();
            const shoeSize = String(row[12] || '').trim();
            const clothesSize = String(row[13] || '').trim();
            const isPregnantStr = String(row[14] || '').trim().toLowerCase();
            const isNursingStr = String(row[15] || '').trim().toLowerCase();
            const familyDelegateRaw = String(row[16] || '').trim();

            if (!familyNum || !memberName) continue;

            // Map shelter type
            let shelterType = '';
            let shelterOther = '';

            if (shelterTypeRaw) {
                if (shelterTypeRaw.includes('جاهزة')) shelterType = 'ready_tent';
                else if (shelterTypeRaw.includes('مصنعة')) shelterType = 'manufactured_tent';
                else if (shelterTypeRaw.includes('بيت')) shelterType = 'house';
                else {
                    shelterType = 'other';
                    shelterOther = shelterTypeRaw;
                }
            } else {
                shelterType = null;
            }

            const memberRole = roleMap[memberRoleRaw] || memberRoleRaw;
            const isPregnant = ['نعم', 'yes', '1', 'true'].includes(isPregnantStr);
            const isNursing = ['نعم', 'yes', '1', 'true'].includes(isNursingStr);

            // Find matching delegate
            let matchedDelegate = null;
            if (familyDelegateRaw) {
                matchedDelegate = findBestDelegate(familyDelegateRaw);
                if (!matchedDelegate && !delegateIssues.find(d => d.familyNum === familyNum)) {
                    delegateIssues.push({
                        familyNum,
                        inputDelegate: familyDelegateRaw
                    });
                }
            }

            if (!familiesMap[familyNum]) {
                familiesMap[familyNum] = {
                    family: {
                        number: familyNum,
                        address: familyAddress,
                        phone: familyPhone,
                        alternative_mobile: alternativeMobile,
                        housing_status: housingStatus,
                        family_needs: familyNeeds,
                        shelter_type: shelterType,
                        shelter_other: shelterOther,
                        delegate: matchedDelegate
                    },
                    members: []
                };
            }

            familiesMap[familyNum].members.push({
                name: memberName,
                role: memberRole,
                dob: memberDob,
                nid: memberNid,
                notes: healthNotes,
                isPregnant,
                isNursing,
                shoeSize,
                clothesSize
            });
        }

        // If there are delegate issues, show error and stop
        if (delegateIssues.length > 0) {
            const issuesList = delegateIssues.map(issue =>
                `عائلة رقم ${issue.familyNum}: المفوض "${issue.inputDelegate}" غير موجود`
            ).join('\n');

            const errorMessage = `⚠️ تم العثور على مفوضين غير موجودين في النظام:\n\n${issuesList}\n\nالرجاء تصحيح أسماء المفوضين أو إضافتهم في صفحة الإعدادات.`;
            setErrorMsg(errorMessage);
            alert(errorMessage);
            return; // Stop processing
        }

        // Prepare data for batch import
        const familiesToImport = [];

        for (const famNum in familiesMap) {
            const famData = familiesMap[famNum];

            familiesToImport.push({
                family_number: famData.family.number,
                address: famData.family.address,
                contact: famData.family.phone,
                alternative_mobile: famData.family.alternative_mobile,
                housing_status: famData.family.housing_status,
                family_needs: famData.family.family_needs,
                shelter_type: famData.family.shelter_type,
                shelter_type_other: famData.family.shelter_other,
                delegate: famData.family.delegate || null,
                members: famData.members.map(m => {
                    const gender = determineGender(m.role);
                    return {
                        name: m.name,
                        nid: m.nid || null,
                        dob: m.dob || null,
                        gender: gender,
                        role: m.role,
                        is_pregnant: m.isPregnant || false,
                        is_nursing: m.isNursing || false,
                        shoe_size: m.shoeSize || null,
                        clothes_size: m.clothesSize || null,
                        notes: m.notes || null
                    };
                })
            });
        }

        try {
            // Set progress states
            setImportTotal(familiesToImport.length);
            setImportCurrent(0);
            setImportProgress(0);

            // جلب البيانات الحالية للمخيم للتحقق من التكرار
            const campId = selectedCamp?.camp_id || 'default';
            const existingFamilies = await getAllFamilies(campId);
            const existingIndividuals = await getAllIndividuals(campId);

            // Import with progress callback
            const results = [];
            for (let i = 0; i < familiesToImport.length; i++) {
                const familyData = familiesToImport[i];

                try {
                    // 1. التحقق من رقم العائلة (إذا كانت العائلة نشطة)
                    const dupFamily = existingFamilies.find(f => f.family_number === familyData.family_number && !f.is_departed);
                    if (dupFamily) {
                        throw new Error(`العائلة رقم ${familyData.family_number} موجودة مسبقاً في هذا المخيم`);
                    }

                    // 2. التحقق من أرقام الهوية في نفس المخيم
                    if (familyData.members && familyData.members.length > 0) {
                        for (const member of familyData.members) {
                            if (member.nid) {
                                const dupInd = existingIndividuals.find(ind => ind.nid === member.nid && !ind.is_departed);
                                if (dupInd) {
                                    throw new Error(`رقم الهوية ${member.nid} (${dupInd.name}) موجود مسبقاً في العائلة رقم ${dupInd.family_number}`);
                                }
                            }
                        }
                    }

                    // Create family
                    const family = await createFamily({
                        family_number: familyData.family_number,
                        address: familyData.address,
                        contact: familyData.contact,
                        alternative_mobile: familyData.alternative_mobile,
                        housing_status: familyData.housing_status,
                        family_needs: familyData.family_needs,
                        delegate: familyData.delegate || null,
                        shelter_type: familyData.shelter_type || null,
                        shelter_type_other: familyData.shelter_type_other || null,
                        camp_id: campId
                    });

                    // Create members
                    if (familyData.members && familyData.members.length > 0) {
                        for (const member of familyData.members) {
                            await createIndividual({
                                family_id: family.family_id,
                                shoe_size: member.shoe_size || null,
                                clothes_size: member.clothes_size || null,
                                ...member
                            });
                        }

                        // فحص التطابق بين المخيمات بعد إضافة جميع الأفراد
                        await checkCrossCampDuplicates(
                            family.family_id,
                            family.camp_id,
                            familyData.members,
                            user
                        );
                    }

                    results.push({ success: true, family_id: family.family_id, family_number: family.family_number });
                } catch (error) {
                    results.push({
                        success: false,
                        error: error.message,
                        family_number: familyData.family_number
                    });
                }

                // Update progress
                const current = i + 1;
                setImportProgress(Math.round((current / familiesToImport.length) * 100));
            }

            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;

            // Clear any previous messages
            setErrorMsg('');

            if (failCount > 0) {
                const failMessages = results
                    .filter(r => !r.success)
                    .map(r => `• عائلة ${r.family_number}: ${r.error}`)
                    .join('\n');

                setErrorMsg(`⚠️ تم رفض بعض البيانات للأسباب التالية:\n\n${failMessages}`);
            }

            // Show success message prominently
            let message = '';
            if (successCount > 0) {
                message = `✅ تم استيراد ${successCount} عائلة بنجاح!\n`;
            }
            if (failCount > 0) {
                message += `❌ فشل استيراد ${failCount} عائلة بسبب تكرار البيانات.`;
            }

            if (message) {
                setSuccessMsg(message);
                if (failCount > 0) {
                    alert(message + "\n\nالرجاء مراجعة رسائل الخطأ الحمراء أسفل الصفحة.");
                } else {
                    alert(message);
                }
            }

            // Notify Admin
            if (user && successCount > 0) {
                createNotification({
                    type: 'new_entry',
                    message: `قام ${user.fullName || user.username || user.email} باستيراد ${successCount} عائلة جديدة.`,
                    user_name: user.fullName || user.username || user.email
                });
            }

            // Keep message for longer
            setTimeout(() => setSuccessMsg(''), 10000);
        } catch (err) {
            console.error('Batch import error:', err);
            const errorMessage = 'حدث خطأ أثناء الاستيراد: ' + err.message;
            setErrorMsg(errorMessage);
            alert(errorMessage);
        } finally {
            setImportProgress(0);
            setImportCurrent(0);
            setImportTotal(0);
        }
    };

    const handleAddMember = async () => {
        if (!currentMember.name) {
            alert('الرجاء إدخال اسم الفرد');
            return;
        }

        // التحقق من تاريخ الميلاد
        if (!dobDay || !dobMonth || !dobYear) {
            alert('الرجاء إدخال تاريخ الميلاد كاملاً (اليوم - الشهر - السنة)');
            return;
        }

        const day = parseInt(dobDay);
        const month = parseInt(dobMonth);
        const year = parseInt(dobYear);

        if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > new Date().getFullYear()) {
            alert('تاريخ الميلاد غير صحيح');
            return;
        }

        // تحويل التاريخ إلى تنسيق YYYY-MM-DD
        const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // التحقق من رقم الهوية: مطلوب ويجب أن يكون 9 أرقام بالضبط
        if (!currentMember.nid || currentMember.nid.trim() === '') {
            alert('رقم الهوية مطلوب');
            return;
        }

        const nidDigits = currentMember.nid.replace(/\D/g, '');
        if (nidDigits.length !== 9) {
            alert('رقم الهوية يجب أن يكون 9 أرقام بالضبط');
            return;
        }

        // التحقق من أن رقم الهوية غير مكرر في القائمة الحالية
        if (members.some(m => m.nid === nidDigits)) {
            alert('رقم الهوية هذا مضاف بالفعل في هذه العائلة');
            return;
        }

        // التحقق من قاعدة البيانات (async)
        const isDuplicateDB = await checkNidExists(nidDigits);
        if (isDuplicateDB) {
            alert('رقم الهوية هذا مسجل مسبقاً في قاعدة البيانات!');
            return;
        }

        setMembers([...members, {
            ...currentMember,
            dob: formattedDate,
            nid: nidDigits, // حفظ الأرقام فقط
            id: Date.now()
        }]);

        setCurrentMember({
            name: '',
            nid: '',
            dob: '',
            role: 'son',
            healthNotes: '',
            isPregnant: false,
            isNursing: false,
            guardianGender: 'male',
            roleDescription: '',
            deceasedHusbandName: '',
            husbandDeathDate: '',
            shoeSize: '',
            clothesSize: ''
        });

        // إعادة تعيين حقول التاريخ
        setDobDay('');
        setDobMonth('');
        setDobYear('');
    };

    const removeMember = (id) => {
        setMembers(members.filter(m => m.id !== id));
    };
    const validatePhoneNumber = (phone) => {
        if (!phone || phone.trim() === '') {
            return true; // رقم الجوال اختياري
        }

        const digits = phone.replace(/\D/g, '');

        // 10 أرقام: يجب أن تبدأ بصفر
        if (digits.length === 10) {
            return digits.startsWith('0');
        }

        // 9 أرقام: يجب أن لا تبدأ بصفر
        if (digits.length === 9) {
            return !digits.startsWith('0');
        }

        // أي طول آخر غير مقبول
        return false;
    };

    const handleSaveFamily = async () => {
        if (!selectedCamp) {
            alert('الرجاء اختيار المخيم أولاً من القائمة الجانبية');
            return;
        }

        if (!familyNumber || !familyAddress || members.length === 0) {
            alert('الرجاء تعبئة رقم العائلة والعنوان وإضافة فرد واحد على الأقل');
            return;
        }

        // التحقق من رقم الجوال
        if (familyPhone && !validatePhoneNumber(familyPhone)) {
            alert('رقم الجوال غير صحيح. مثال صحيح: 0590000000 أو 590000000');
            return;
        }

        // التحقق من رقم الجوال البديل
        if (alternativeMobile && !validatePhoneNumber(alternativeMobile)) {
            alert('رقم الجوال البديل غير صحيح. مثال صحيح: 0590000000 أو 590000000');
            return;
        }

        setLoading(true);
        setErrorMsg('');

        try {
            // Check if family number exists - need to scope to camp? 
            // Ideally family numbers should be unique per camp or globally? The user didn't specify. 
            // Assuming unique per camp for now, but keeping it simple.
            const allFamilies = await getAllFamilies(selectedCamp.camp_id);
            if (allFamilies.some(f => f.family_number === familyNumber)) {
                alert('رقم العائلة مسجل مسبقاً في هذا المخيم، الرجاء استخدام رقم آخر');
                setLoading(false);
                return;
            }

            // تنظيف رقم الجوال (إزالة أي أحرف غير رقمية)
            const cleanedPhone = familyPhone ? familyPhone.replace(/\D/g, '') : '';
            const cleanedAltMobile = alternativeMobile ? alternativeMobile.replace(/\D/g, '') : '';

            // Create Family
            const family = await createFamily({
                family_number: familyNumber,
                address: familyAddress,
                contact: cleanedPhone,
                alternative_mobile: cleanedAltMobile,
                housing_status: housingStatus,
                family_needs: familyNeeds,
                delegate: selectedDelegate || null,
                shelter_type: shelterType || null,
                shelter_type_other: shelterType === 'other' ? shelterOther : null,
                camp_id: selectedCamp.camp_id
            });
            // ...


            // Add Members
            for (const member of members) {
                // تحديد الجنس: إذا كان وصي، استخدم guardianGender، وإلا استخدم determineGender
                let gender;
                if (member.role === 'guardian') {
                    gender = member.guardianGender || 'male';
                } else {
                    gender = determineGender(member.role);
                }

                await createIndividual({
                    family_id: family.family_id,
                    name: member.name,
                    nid: member.nid || null,
                    dob: member.dob || null,
                    gender: gender,
                    role: member.role,
                    role_description: member.role === 'other' ? member.roleDescription : null,
                    deceased_husband_name: member.role === 'widow' ? member.deceasedHusbandName : null,
                    husband_death_date: member.role === 'widow' ? member.husbandDeathDate : null,
                    is_pregnant: member.isPregnant || false,
                    is_nursing: member.isNursing || false,

                    shoe_size: member.shoeSize || null,
                    clothes_size: member.clothesSize || null,
                    notes: member.healthNotes || null
                });
            }

            setSuccessMsg('تم حفظ العائلة بنجاح!');

            // Notify Admin
            if (user) {
                createNotification({
                    type: 'new_entry',
                    message: `قام ${user.fullName || user.username || user.email} بإضافة عائلة جديدة (#${familyNumber}) مع ${members.length} أفراد.`,
                    user_name: user.fullName || user.username || user.email,
                    link: `/edit/${family.family_id}`
                });
            }

            setTimeout(() => setSuccessMsg(''), 3000);

            // Reset form
            const nextNum = parseInt(familyNumber) ? String(parseInt(familyNumber) + 1) : '';
            setFamilyNumber(nextNum);
            setFamilyAddress(''); // Optional: keep address? Usually reset.
            setFamilyPhone('');
            setAlternativeMobile('');
            setHousingStatus('');
            setFamilyNeeds('');
            setShelterType('');
            setShelterOther('');
            setMembers([]);
        } catch (err) {
            console.error('Error saving family:', err);
            setErrorMsg('حدث خطأ أثناء الحفظ: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Helper functions
    const determineGender = (role) => {
        const femaleRoles = ['wife', 'second_wife', 'widow', 'divorced', 'abandoned', 'daughter'];
        return femaleRoles.includes(role) ? 'female' : 'male';
    };

    const parseExcelDate = (dateVal) => {
        if (!dateVal) return '';

        if (typeof dateVal === 'number') {
            const date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
            return '';
        }

        const strVal = String(dateVal).trim();
        const dmyPattern = /^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/;
        const match = strVal.match(dmyPattern);

        if (match) {
            const day = match[1].padStart(2, '0');
            const month = match[2].padStart(2, '0');
            const year = match[3];
            return `${year}-${month}-${day}`;
        }

        const date = new Date(strVal);
        if (!isNaN(date.getTime())) {
            try {
                return date.toISOString().split('T')[0];
            } catch (e) {
                return '';
            }
        }

        return '';
    };

    const translateRole = (role) => {
        const map = {
            husband: 'زوج', father: 'أب', mother: 'أم', wife: 'زوجة',
            son: 'ابن', daughter: 'ابنة', widow: 'أرملة', widower: 'أرمل',
            divorced: 'مطلقة', abandoned: 'مهجورة',
            grandfather: 'جد', grandmother: 'جدة'
        };
        return map[role] || role;
    };

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">إدخال بيانات العائلات</h1>
                <div className="flex w-full md:w-auto">
                    <button
                        onClick={handleDownloadTemplate}
                        className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold transition shadow-sm text-sm"
                    >
                        <Download className="h-4 w-4" />
                        تحميل نموذج Excel
                    </button>
                </div>
            </div>

            {/* Messages */}
            <AnimatePresence>
                {successMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl whitespace-pre-line"
                    >
                        {successMsg}
                    </motion.div>
                )}
                {errorMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3"
                    >
                        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                        <div>{errorMsg}</div>
                    </motion.div>
                )}

                {/* Progress Indicator */}
                {isImporting && importTotal > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-indigo-50 border-2 border-indigo-200 p-6 rounded-2xl"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            <div>
                                <h3 className="font-bold text-indigo-900 text-lg">جاري الاستيراد...</h3>
                                <p className="text-indigo-700 text-sm">
                                    {importCurrent} من {importTotal} عائلة ({importProgress}%)
                                </p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-indigo-200 rounded-full h-4 overflow-hidden">
                            <motion.div
                                className="bg-indigo-600 h-full rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${importProgress}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>

                        <p className="text-xs text-indigo-600 mt-3 text-center">
                            الرجاء عدم إغلاق الصفحة حتى اكتمال الاستيراد
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Import Section */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-100">
                <div className="flex items-center gap-3 mb-4">
                    <FileSpreadsheet className="h-6 w-6 text-indigo-600" />
                    <h2 className="text-xl font-bold text-gray-800">استيراد من Excel</h2>
                </div>
                <p className="text-sm text-gray-600 mb-4">قم برفع ملف Excel يحتوي على بيانات العائلات. تأكد من تضمين عمود "المفوض" لكل عائلة.</p>


                <div className="flex gap-3 items-center">
                    <label className="flex-1 cursor-pointer">
                        <div className="bg-white border-2 border-dashed border-indigo-300 rounded-xl p-6 hover:border-indigo-500 transition text-center">
                            <Upload className="h-12 w-12 text-indigo-400 mx-auto mb-2" />
                            <p className="text-gray-700 font-medium">اضغط لرفع ملف Excel</p>
                            <p className="text-xs text-gray-500 mt-1">أو اسحب وأفلت الملف هنا</p>
                        </div>
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={isImporting}
                        />
                    </label>
                </div>
            </div>

            {/* Manual Entry Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 mb-6">إدخال يدوي</h2>

                {/* Family Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-indigo-50 rounded-xl">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">رقم العائلة *</label>
                        <input
                            type="text"
                            value={familyNumber}
                            onChange={(e) => setFamilyNumber(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="101"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">العنوان *</label>
                        <input
                            type="text"
                            value={familyAddress}
                            onChange={(e) => setFamilyAddress(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="غزة، الرمال"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">رقم التواصل</label>
                        <input
                            type="tel"
                            value={familyPhone}
                            onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, ''); // إزالة أي حرف غير رقمي
                                if (value.length <= 10) {
                                    setFamilyPhone(value);
                                }
                            }}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none ${familyPhone && !validatePhoneNumber(familyPhone)
                                ? 'border-red-500 focus:ring-red-500 bg-red-50'
                                : familyPhone && validatePhoneNumber(familyPhone)
                                    ? 'border-green-500 focus:ring-green-500 bg-green-50'
                                    : 'border-gray-300 focus:ring-indigo-500'
                                }`}
                            placeholder="0590000000"
                            maxLength="10"
                            dir="ltr"
                        />
                        {familyPhone && !validatePhoneNumber(familyPhone) && (
                            <p className="text-xs text-red-600 mt-1 font-medium">❌ رقم غير صحيح - مثال: 0590000000 أو 590000000</p>
                        )}
                        {(!familyPhone || validatePhoneNumber(familyPhone)) && (
                            <p className="text-xs text-gray-500 mt-1">مثال: 0590000000 أو 590000000</p>
                        )}
                    </div>
                    {/* Delegate Selection */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">تحديد المفوض / المربع</label>
                        <select
                            value={selectedDelegate}
                            onChange={(e) => setSelectedDelegate(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        >
                            <option value="">-- اختر المفوض --</option>
                            {delegates.map(d => (
                                <option key={d.delegate_id} value={d.name}>{d.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Alternative Mobile */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">رقم جوال بديل (اختياري)</label>
                        <input
                            type="tel"
                            value={alternativeMobile}
                            onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '');
                                if (value.length <= 10) setAlternativeMobile(value);
                            }}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none ${alternativeMobile && !validatePhoneNumber(alternativeMobile)
                                ? 'border-red-500 focus:ring-red-500 bg-red-50'
                                : 'border-gray-300 focus:ring-indigo-500'
                                }`}
                            placeholder="059xxxxxxx"
                            maxLength="10"
                            dir="ltr"
                        />
                        {alternativeMobile && !validatePhoneNumber(alternativeMobile) && (
                            <p className="text-xs text-red-600 mt-1 font-medium">❌ رقم غير صحيح</p>
                        )}
                    </div>

                    {/* Housing Status */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">حالة السكن</label>
                        <select
                            value={housingStatus}
                            onChange={(e) => setHousingStatus(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        >
                            <option value="">-- اختر حالة السكن --</option>
                            <option value="سيء">سيء</option>
                            <option value="جيد">جيد</option>
                            <option value="ممتاز">ممتاز</option>
                        </select>
                    </div>

                    {/* Family Needs */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-2">احتياجات الأسرة</label>
                        <input
                            type="text"
                            value={familyNeeds}
                            onChange={(e) => setFamilyNeeds(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="احتياجات خاصة..."
                        />
                    </div>
                </div>

                {/* Shelter Info */}
                <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">نوع السكن / الخيمة</label>
                            <select
                                value={shelterType}
                                onChange={(e) => setShelterType(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                            >
                                <option value="">-- اختر نوع السكن --</option>
                                <option value="ready_tent">خيمة جاهزة</option>
                                <option value="manufactured_tent">خيمة مصنعة</option>
                                <option value="house">بيت</option>
                                <option value="other">أخرى</option>
                            </select>
                        </div>
                        {shelterType === 'other' && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">وضح نوع السكن</label>
                                <input
                                    type="text"
                                    value={shelterOther}
                                    onChange={(e) => setShelterOther(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="اكتب نوع السكن هنا"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Add Member Form */}
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 mb-6">
                    <h3 className="font-bold text-gray-700 mb-4">إضافة فرد جديد</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">الاسم *</label>
                            <input
                                type="text"
                                value={currentMember.name}
                                onChange={(e) => setCurrentMember({ ...currentMember, name: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="اسم الفرد"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">الصفة *</label>
                            <select
                                value={currentMember.role}
                                onChange={(e) => setCurrentMember({ ...currentMember, role: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                {roles.map(r => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                            </select>
                        </div>
                        {/* حقل جنس الوصي - يظهر فقط عند اختيار "وصي" */}
                        {currentMember.role === 'guardian' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">جنس الوصي *</label>
                                <select
                                    value={currentMember.guardianGender}
                                    onChange={(e) => setCurrentMember({ ...currentMember, guardianGender: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-yellow-50"
                                >
                                    <option value="male">ذكر</option>
                                    <option value="female">أنثى</option>
                                </select>
                            </div>
                        )}
                        {/* حقل وصف الأخرى - يظهر فقط عند اختيار "أخرى" */}
                        {currentMember.role === 'other' && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">وصف الصفة *</label>
                                <input
                                    type="text"
                                    value={currentMember.roleDescription}
                                    onChange={(e) => setCurrentMember({ ...currentMember, roleDescription: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-yellow-50"
                                    placeholder="مثال: عم، عمة، خال، خالة..."
                                    required
                                />
                            </div>
                        )}
                        {/* حقول الأرملة - تظهر فقط عند اختيار "أرملة" */}
                        {currentMember.role === 'widow' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">اسم الزوج المتوفي</label>
                                    <input
                                        type="text"
                                        value={currentMember.deceasedHusbandName}
                                        onChange={(e) => setCurrentMember({ ...currentMember, deceasedHusbandName: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50"
                                        placeholder="الاسم الثلاثي للزوج"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الوفاة</label>
                                    <input
                                        type="date"
                                        value={currentMember.husbandDeathDate}
                                        onChange={(e) => setCurrentMember({ ...currentMember, husbandDeathDate: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50 text-right"
                                    />
                                </div>
                            </>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الميلاد *</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={dobDay}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '');
                                        if (value.length <= 2) setDobDay(value);
                                    }}
                                    className="w-1/3 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-center"
                                    placeholder="اليوم"
                                    maxLength="2"
                                    dir="ltr"
                                />
                                <input
                                    type="text"
                                    value={dobMonth}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '');
                                        if (value.length <= 2) setDobMonth(value);
                                    }}
                                    className="w-1/3 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-center"
                                    placeholder="الشهر"
                                    maxLength="2"
                                    dir="ltr"
                                />
                                <input
                                    type="text"
                                    value={dobYear}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '');
                                        if (value.length <= 4) setDobYear(value);
                                    }}
                                    className="w-1/3 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-center"
                                    placeholder="السنة"
                                    maxLength="4"
                                    dir="ltr"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">مثال: يوم 15، شهر 6، سنة 1990</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهوية *</label>
                            <input
                                type="text"
                                value={currentMember.nid}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, ''); // إزالة أي حرف غير رقمي
                                    if (value.length <= 9) {
                                        setCurrentMember({ ...currentMember, nid: value });
                                    }
                                }}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="800000000"
                                maxLength="9"
                                required
                                dir="ltr"
                            />
                            <p className="text-xs text-gray-500 mt-1">9 أرقام بالضبط</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات صحية</label>
                            <input
                                type="text"
                                value={currentMember.healthNotes}
                                onChange={(e) => setCurrentMember({ ...currentMember, healthNotes: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="أي ملاحظات صحية"
                            />
                        </div>

                        {/* Sizes */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">مقاس الحذاء</label>
                            <input
                                type="text"
                                value={currentMember.shoeSize}
                                onChange={(e) => setCurrentMember({ ...currentMember, shoeSize: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="مثال: 42"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">مقاس الملابس</label>
                            <input
                                type="text"
                                value={currentMember.clothesSize}
                                onChange={(e) => setCurrentMember({ ...currentMember, clothesSize: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="مثال: XL أو 14 سنة"
                            />
                        </div>

                        <div className="flex items-center gap-6 pt-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={currentMember.isPregnant}
                                    onChange={(e) => setCurrentMember({ ...currentMember, isPregnant: e.target.checked })}
                                    className="w-4 h-4 text-indigo-600 rounded"
                                />
                                <span className="text-sm font-medium text-gray-700">حامل</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={currentMember.isNursing}
                                    onChange={(e) => setCurrentMember({ ...currentMember, isNursing: e.target.checked })}
                                    className="w-4 h-4 text-indigo-600 rounded"
                                />
                                <span className="text-sm font-medium text-gray-700">مرضع</span>
                            </label>
                        </div>
                    </div>

                    <button
                        onClick={handleAddMember}
                        className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold transition"
                    >
                        <Plus className="h-4 w-4" />
                        إضافة الفرد
                    </button>
                </div>

                {/* Members List */}
                {members.length > 0 && (
                    <div className="mb-6">
                        <h3 className="font-bold text-gray-700 mb-3">الأفراد المضافون ({members.length})</h3>
                        <div className="space-y-2">
                            {members.map((member) => (
                                <div key={member.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-800">{member.name}</div>
                                        <div className="text-sm text-gray-500">
                                            {translateRole(member.role)} • {member.dob} • {member.nid || 'بدون هوية'}
                                            {(member.shoeSize || member.clothesSize) && ` • حذاء: ${member.shoeSize || '-'} / ملابس: ${member.clothesSize || '-'}`}
                                            {member.healthNotes && ` • ${member.healthNotes}`}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeMember(member.id)}
                                        className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Save Button */}
                <button
                    onClick={handleSaveFamily}
                    disabled={loading || members.length === 0}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                    {loading ? (
                        <>جاري الحفظ...</>
                    ) : (
                        <>
                            <Save className="h-5 w-5" />
                            حفظ العائلة
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
