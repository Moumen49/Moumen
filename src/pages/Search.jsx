import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getAllFamilies, getAllIndividuals } from '../lib/db';
import { useCamp } from '../context/CampContext';
import * as XLSX from 'xlsx';
import { Download, Search as SearchIcon, Filter, RefreshCw, Pencil, UserX, MapPin, Phone } from 'lucide-react';

const calculateAge = (dob) => {
    if (!dob) return 0;
    try {
        const birthDate = new Date(dob);
        if (isNaN(birthDate.getTime())) return 0;
        const diff = Date.now() - birthDate.getTime();
        return Math.abs(new Date(diff).getUTCFullYear() - 1970);
    } catch (e) {
        return 0;
    }
};

const translateShelter = (type, other) => {
    if (type === 'other') return other || 'أخرى';
    const map = {
        'ready_tent': 'خيمة جاهزة',
        'manufactured_tent': 'خيمة مصنعة',
        'house': 'بيت'
    };
    return map[type] || type || '-';
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

const SortIcon = ({ sortConfig, column }) => {
    if (sortConfig.key !== column) return <div className="w-4 h-4 inline-block opacity-20">↕</div>;
    return <div className="w-4 h-4 inline-block">{sortConfig.direction === 'ascending' ? '↑' : '↓'}</div>;
};

export default function Search() {
    const { selectedCamp } = useCamp();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterRole, setFilterRole] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchField, setSearchField] = useState('all');
    const [minAge, setMinAge] = useState('');
    const [maxAge, setMaxAge] = useState('');
    const [familySizeFilter, setFamilySizeFilter] = useState('');
    const [motherStatus, setMotherStatus] = useState('all'); // all, pregnant, nursing
    const [departedFilter, setDepartedFilter] = useState('active'); // 'active', 'departed', 'all'
    const [sortConfig, setSortConfig] = useState({ key: 'familyNumber', direction: 'ascending' });

    useEffect(() => {
        if (selectedCamp) {
            loadData();
        } else {
            setData([]);
            setLoading(false);
        }
    }, [selectedCamp]);

    const loadData = async () => {
        if (!selectedCamp) return;
        setLoading(true);
        try {
            const families = await getAllFamilies(selectedCamp.camp_id);
            const individuals = await getAllIndividuals(selectedCamp.camp_id);

            // Join Data
            const fullData = individuals.map(ind => {
                const family = families.find(f => f.family_id === ind.family_id) || {};
                const familySize = individuals.filter(i => i.family_id === ind.family_id).length;

                return {
                    ...ind,
                    familyNumber: family.family_number || '-',
                    familyAddress: family.address || '-',
                    familyContact: family.contact || '-',
                    familyAlternativeMobile: family.alternative_mobile || '-',
                    familyHousingStatus: family.housing_status || '-',
                    familyNeeds: family.family_needs || '-',
                    familyDelegate: family.delegate || '-',
                    familyShelterType: family.shelter_type || '-',
                    familyShelterOther: family.shelter_type_other || '-',
                    familySize: familySize,
                    familyIsDeparted: family.is_departed || false,
                    age: calculateAge(ind.dob),
                    healthNotes: ind.health_notes || ind.notes || '',
                    isPregnant: ind.is_pregnant || false,
                    isNursing: ind.is_nursing || false,
                    shoeSize: ind.shoe_size || '-',
                    clothesSize: ind.clothes_size || '-'
                };
            });

            setData(fullData);
        } catch (error) {
            console.error('Load error:', error);
        } finally {
            setLoading(false);
        }
    };

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const filteredData = useMemo(() => {
        let result = data.filter(item => {
            if (searchQuery) {
                const query = searchQuery.toString().toLowerCase().trim();
                const itemNum = (item.familyNumber || '').toString().toLowerCase().trim();
                const itemName = (item.name || '').toLowerCase();
                const itemNid = (item.nid || '').toString();

                if (searchField === 'all') {
                    if (!itemNum.includes(query) && !itemName.includes(query) && !itemNid.includes(query)) return false;
                } else if (searchField === 'name') {
                    if (!itemName.includes(query)) return false;
                } else if (searchField === 'familyNumber') {
                    if (itemNum !== query) return false;
                } else if (searchField === 'nid') {
                    if (!itemNid.includes(query)) return false;
                }
            }

            if (filterRole !== 'all' && item.role !== filterRole) return false;
            if (minAge && item.age < parseInt(minAge)) return false;
            if (maxAge && item.age > parseInt(maxAge)) return false;
            if (familySizeFilter && item.familySize !== parseInt(familySizeFilter)) return false;
            if (motherStatus === 'pregnant' && !item.isPregnant) return false;
            if (motherStatus === 'nursing' && !item.isNursing) return false;

            if (departedFilter === 'active' && item.familyIsDeparted) return false;
            if (departedFilter === 'departed' && !item.familyIsDeparted) return false;

            return true;
        });

        if (sortConfig.key) {
            result.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];
                if (sortConfig.key === 'familyNumber') {
                    const numA = parseInt(valA);
                    const numB = parseInt(valB);
                    if (!isNaN(numA) && !isNaN(numB)) {
                        valA = numA;
                        valB = numB;
                    }
                }
                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [data, filterRole, minAge, maxAge, motherStatus, searchQuery, familySizeFilter, sortConfig, departedFilter, searchField]);

    const handleExport = () => {
        const ws = XLSX.utils.json_to_sheet(filteredData.map(item => ({
            'رقم العائلة': item.familyNumber,
            'الاسم': item.name,
            'الهوية': item.nid || '',
            'الدور': translateRole(item.role),
            'العمر': item.age,
            'عدد الأفراد': item.familySize,
            'رقم التواصل': item.familyContact,
            'رقم بديل': item.familyAlternativeMobile,
            'العنوان': item.familyAddress,
            'المفوض': item.familyDelegate,
            'نوع السكن': translateShelter(item.familyShelterType, item.familyShelterOther),
            'حالة السكن': item.familyHousingStatus,
            'احتياجات الأسرة': item.familyNeeds,
            'مقاس الحذاء': item.shoeSize,
            'مقاس الملابس': item.clothesSize,
            'حامل': item.isPregnant ? 'نعم' : 'لا',
            'مرضع': item.isNursing ? 'نعم' : 'لا',
            'ملاحظات': item.healthNotes
        })));

        const wb = XLSX.utils.book_new();
        if (!wb.Workbook) wb.Workbook = {};
        if (!wb.Workbook.Views) wb.Workbook.Views = [];
        if (!wb.Workbook.Views[0]) wb.Workbook.Views[0] = {};
        wb.Workbook.Views[0].RTL = true;
        XLSX.utils.book_append_sheet(wb, ws, "البيانات");
        XLSX.writeFile(wb, "family_data_export.xlsx");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800">البحث والتقارير</h1>
                <button
                    onClick={handleExport}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition-colors"
                >
                    <Download className="h-4 w-4" />
                    تصدير لملف Excel
                </button>
            </div>

            <div className="bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase mr-1">البحث في</label>
                        <div className="flex gap-2">
                            <select
                                value={searchField}
                                onChange={(e) => setSearchField(e.target.value)}
                                className="w-[85px] md:w-[100px] p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs md:text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                            >
                                <option value="all">الكل</option>
                                <option value="name">الاسم</option>
                                <option value="familyNumber">رقم عائلة</option>
                                <option value="nid">الهوية</option>
                            </select>
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder={
                                        searchField === 'all' ? "الاسم، رقم العائلة..." :
                                            searchField === 'name' ? "بحث بالاسم..." :
                                                searchField === 'familyNumber' ? "برقم العائلة..." :
                                                    "برقم الهوية..."
                                    }
                                    className="w-full p-2.5 pl-9 bg-gray-50 border border-gray-200 rounded-xl text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase mr-1">الصفة / الدور</label>
                        <select
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs md:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value)}
                        >
                            <option value="all">الكل</option>
                            <option value="husband">زوج</option>
                            <option value="wife">زوجة</option>
                            <option value="second_wife">زوجة ثانية</option>
                            <option value="widow">أرملة</option>
                            <option value="widower">أرمل</option>
                            <option value="divorced">مطلقة</option>
                            <option value="abandoned">مهجورة</option>
                            <option value="guardian">وصي</option>
                            <option value="son">ابن</option>
                            <option value="daughter">ابنة</option>
                            <option value="other">أخرى</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase mr-1">العمر (من - إلى)</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="من"
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs md:text-sm outline-none font-bold"
                                value={minAge}
                                onChange={(e) => setMinAge(e.target.value)}
                            />
                            <input
                                type="number"
                                placeholder="إلى"
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs md:text-sm outline-none font-bold"
                                value={maxAge}
                                onChange={(e) => setMaxAge(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase mr-1">مرحلة الأمومة</label>
                        <select
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs md:text-sm font-bold outline-none"
                            value={motherStatus}
                            onChange={(e) => setMotherStatus(e.target.value)}
                        >
                            <option value="all">الكل</option>
                            <option value="pregnant">حامل</option>
                            <option value="nursing">مرضع</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase mr-1">حجم العائلة</label>
                        <input
                            type="number"
                            placeholder="عدد الأفراد"
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs md:text-sm outline-none font-bold"
                            value={familySizeFilter}
                            onChange={(e) => setFamilySizeFilter(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase mr-1">حالة العائلة</label>
                        <select
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs md:text-sm font-bold outline-none"
                            value={departedFilter}
                            onChange={(e) => setDepartedFilter(e.target.value)}
                        >
                            <option value="active">النشطة</option>
                            <option value="departed">المغادرة</option>
                            <option value="all">الكل</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-center pt-2">
                    <button
                        onClick={loadData}
                        className="w-full md:w-auto px-10 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-center gap-3 transition-all font-black text-sm md:text-base shadow-xl shadow-indigo-100 active:scale-95"
                    >
                        <RefreshCw className="h-5 w-5" />
                        تحديث وتطبيق الفلاتر
                    </button>
                </div>
            </div>

            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right min-w-[1500px]">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold border-b select-none whitespace-nowrap">
                            <tr>
                                <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 sticky right-0 bg-gray-50 z-10" onClick={() => requestSort('familyNumber')}>
                                    رقم العائلة <SortIcon sortConfig={sortConfig} column="familyNumber" />
                                </th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 sticky right-[100px] bg-gray-50 z-10" onClick={() => requestSort('name')}>
                                    الاسم <SortIcon sortConfig={sortConfig} column="name" />
                                </th>
                                <th className="px-4 py-3">الهوية</th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('role')}>
                                    الدور <SortIcon sortConfig={sortConfig} column="role" />
                                </th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('age')}>
                                    العمر <SortIcon sortConfig={sortConfig} column="age" />
                                </th>
                                <th className="px-4 py-3">أفراد</th>
                                <th className="px-4 py-3">تواصل</th>
                                <th className="px-4 py-3">بديل</th>
                                <th className="px-4 py-3">المفوض</th>
                                <th className="px-4 py-3">نوع السكن</th>
                                <th className="px-4 py-3">حالة السكن</th>
                                <th className="px-4 py-3">العنوان</th>
                                <th className="px-4 py-3">احتياجات</th>
                                <th className="px-4 py-3">حذاء</th>
                                <th className="px-4 py-3">ملابس</th>
                                <th className="px-4 py-3">وضع خاص</th>
                                <th className="px-4 py-3">ملاحظات</th>
                                <th className="px-4 py-3 sticky left-0 bg-gray-50 z-10">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm whitespace-nowrap">
                            {loading ? (
                                <tr><td colSpan="18" className="text-center p-8">جاري التحميل...</td></tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan="18" className="text-center p-8 text-gray-500">لا توجد بيانات</td></tr>
                            ) : (
                                filteredData.map((item, idx) => (
                                    <tr key={idx} className={`transition ${item.familyIsDeparted ? 'bg-orange-50/40 hover:bg-orange-50' : 'hover:bg-gray-50'}`}>
                                        <td className="px-4 py-3 font-bold text-indigo-700 sticky right-0 bg-white z-10">
                                            #{item.familyNumber}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-900 sticky right-[100px] bg-white z-10">{item.name}</td>
                                        <td className="px-4 py-3 font-mono text-xs">{item.nid}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-xs ${item.role === 'husband' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>
                                                {translateRole(item.role)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">{item.age}</td>
                                        <td className="px-4 py-3 text-center">{item.familySize}</td>
                                        <td className="px-4 py-3 font-mono text-xs">{item.familyContact}</td>
                                        <td className="px-4 py-3 font-mono text-xs">{item.familyAlternativeMobile}</td>
                                        <td className="px-4 py-3">{item.familyDelegate}</td>
                                        <td className="px-4 py-3">{translateShelter(item.familyShelterType, item.familyShelterOther)}</td>
                                        <td className="px-4 py-3">{item.familyHousingStatus}</td>
                                        <td className="px-4 py-3 truncate max-w-[150px]">{item.familyAddress}</td>
                                        <td className="px-4 py-3 truncate max-w-[150px]">{item.familyNeeds}</td>
                                        <td className="px-4 py-3 text-center">{item.shoeSize}</td>
                                        <td className="px-4 py-3 text-center">{item.clothesSize}</td>
                                        <td className="px-4 py-3 text-pink-600 font-bold">
                                            {item.isPregnant && "حامل "}
                                            {item.isNursing && "مرضع"}
                                        </td>
                                        <td className="px-4 py-3 truncate max-w-[150px]">{item.healthNotes}</td>
                                        <td className="px-4 py-3 sticky left-0 bg-white z-10">
                                            <Link to={`/edit/${item.family_id}`} className="text-indigo-600 bg-indigo-50 p-2 rounded-lg">
                                                <Pencil className="h-4 w-4" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="md:hidden space-y-4">
                {loading ? (
                    <div className="bg-white p-8 rounded-2xl text-center">جاري التحميل...</div>
                ) : filteredData.length === 0 ? (
                    <div className="bg-white p-8 rounded-2xl text-center">لا توجد نتائج</div>
                ) : (
                    filteredData.map((item, idx) => (
                        <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <span className="font-black text-indigo-600">#{item.familyNumber}</span>
                                    <h3 className="font-bold text-gray-900 mt-1">{item.name}</h3>
                                    <p className="text-xs text-gray-500">{item.nid}</p>
                                </div>
                                <Link to={`/edit/${item.family_id}`} className="bg-indigo-50 text-indigo-600 p-2 rounded-xl">
                                    <Pencil className="h-5 w-5" />
                                </Link>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                                <div className="bg-gray-50 p-2 rounded-lg">
                                    <p className="text-gray-400 font-bold uppercase text-[10px]">الدور</p>
                                    <p className="font-bold">{translateRole(item.role)}</p>
                                </div>
                                <div className="bg-gray-50 p-2 rounded-lg">
                                    <p className="text-gray-400 font-bold uppercase text-[10px]">العمر</p>
                                    <p className="font-bold">{item.age} سنة</p>
                                </div>
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-400 pt-2 border-t font-mono">
                                <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{item.familyAddress}</div>
                                <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{item.familyContact}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className="p-4 bg-white/50 text-xs text-gray-500 text-center rounded-xl">
                عدد النتائج: {filteredData.length}
            </div>
        </div>
    );
}
