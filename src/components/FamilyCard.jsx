import React from 'react';
import { MapPin, Phone, Users, CheckSquare, Square } from 'lucide-react';
import { findHeadOfFamily } from '../lib/db';

const FamilyCard = ({ family, members = [], isDepartedOverride = null }) => {
    const isDeparted = isDepartedOverride !== null ? isDepartedOverride : family.is_departed;

    // Simplified head logic using shared helper
    const headMember = findHeadOfFamily(members);

    const translateRole = (member) => {
        const map = {
            husband: 'زوج',
            wife: 'زوجة',
            second_wife: 'زوجة ثانية',
            widow: 'أرملة',
            divorced: 'مطلقة',
            abandoned: 'مهجورة',
            guardian: 'وصي',
            son: 'ابن',
            daughter: 'ابنة',
            other: 'أخرى'
        };

        // إذا كان الدور "أخرى" وهناك وصف، اعرض الوصف
        if (member.role === 'other' && member.role_description) {
            return member.role_description;
        }

        return map[member.role] || member.role;
    };

    return (
        <div
            className="printable-card bg-white text-gray-900 shadow-none relative overflow-visible flex flex-col mx-auto border-b border-gray-200 print:border-none"
            style={{
                width: '210mm',
                minHeight: '297mm',
                padding: '20mm',
                direction: 'rtl',
                pageBreakAfter: 'always',
                breakAfter: 'page',
                position: 'relative',
                boxSizing: 'border-box'
            }}
        >
            {/* DEPARTED WATERMARK */}
            {isDeparted && (
                <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden pointer-events-none">
                    <div className="text-red-500/10 text-9xl font-black rotate-45 border-8 border-red-500/10 p-10 rounded-3xl uppercase tracking-widest">
                        عائلة مغادرة
                    </div>
                </div>
            )}

            {/* DECORATIVE ELEMENTS */}
            <div className={`absolute top-0 right-0 w-40 h-40 rounded-bl-[100px] ${isDeparted ? 'bg-red-50' : 'bg-indigo-900/5'}`}></div>
            <div className={`absolute bottom-0 left-0 w-60 h-20 rounded-tr-[100px] ${isDeparted ? 'bg-red-50' : 'bg-indigo-900/5'}`}></div>

            {/* HEADER */}
            <div className={`flex justify-between items-start mb-8 border-b-2 pb-6 relative z-10 ${isDeparted ? 'border-red-100' : 'border-indigo-900/10'}`}>
                <div>
                    <h1 className={`text-3xl font-bold mb-1 flex items-center gap-3 ${isDeparted ? 'text-red-700' : 'text-indigo-900'}`}>
                        بطاقة العائلة الموحدة
                        {isDeparted && (
                            <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold border border-red-200">
                                مغادرة
                            </span>
                        )}
                    </h1>
                    <p className="text-gray-500 text-sm">مخيمات الرمال</p>
                </div>
                <div className="text-left">
                    <div className={`text-4xl font-black ${isDeparted ? 'text-red-100' : 'text-indigo-900/10'}`}>#{family.family_number}</div>
                    <div className="text-xs text-gray-400 mt-1">تاريخ الإصدار: {new Date().toLocaleDateString('ar-EG')}</div>
                </div>
            </div>

            {/* FAMILY INFO */}
            <div className={`grid grid-cols-2 gap-6 mb-8 p-5 rounded-xl border relative z-10 ${isDeparted ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                <div>
                    <h3 className="text-xs text-gray-400 font-bold uppercase mb-2">رب الأسرة</h3>
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${isDeparted ? 'bg-red-200 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            {headMember?.name.charAt(0) || '؟'}
                        </div>
                        <div>
                            <div className="font-bold text-lg text-gray-800">{headMember?.name || 'غير مسجل'}</div>
                            <div className="text-sm text-gray-500 font-mono">{headMember?.nid || '-'}</div>
                        </div>
                    </div>
                </div>
                <div>
                    <h3 className="text-xs text-gray-400 font-bold uppercase mb-2">العنوان والتواصل</h3>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <MapPin className={`h-4 w-4 ${isDeparted ? 'text-red-500' : 'text-indigo-500'}`} />
                            <span>{family.address || 'غير محدد'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Phone className={`h-4 w-4 ${isDeparted ? 'text-red-500' : 'text-indigo-500'}`} />
                            <span dir="ltr" className="text-left">{family.contact || 'لا يوجد'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* MEMBER LIST */}
            <div className="flex-1 relative z-10">
                <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2 ${isDeparted ? 'text-red-700 border-red-100' : 'text-indigo-900 border-indigo-100'}`}>
                    <Users className="h-5 w-5" />
                    أفراد العائلة ({members.length} فرد)
                </h3>

                <table className="w-full text-right text-sm border-collapse">
                    <thead>
                        <tr className={`border-b-2 ${isDeparted ? 'border-red-100' : 'border-indigo-100'}`}>
                            <th className={`pb-3 pr-2 font-bold text-xs uppercase ${isDeparted ? 'text-red-900/60' : 'text-indigo-900/60'}`}>الاسم</th>
                            <th className={`pb-3 font-bold text-xs uppercase ${isDeparted ? 'text-red-900/60' : 'text-indigo-900/60'}`}>الصفة</th>
                            <th className={`pb-3 font-bold text-xs uppercase ${isDeparted ? 'text-red-900/60' : 'text-indigo-900/60'}`}>تاريخ الميلاد</th>
                            <th className={`pb-3 font-bold text-xs uppercase ${isDeparted ? 'text-red-900/60' : 'text-indigo-900/60'}`}>رقم الهوية</th>
                            <th className={`pb-3 font-bold text-xs uppercase ${isDeparted ? 'text-red-900/60' : 'text-indigo-900/60'}`}>الملاحظات الصحية</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {members.map((member) => {
                            const isEligibleFemale = ['wife', 'second_wife', 'widow', 'divorced', 'abandoned', 'daughter'].includes(member.role);

                            return (
                                <tr key={member.individual_id} className="hover:bg-gray-50/50">
                                    <td className="py-3 pr-2 font-bold text-gray-800 text-xs">{member.name}</td>
                                    <td className="py-3">
                                        <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${['husband', 'father', 'widow'].includes(member.role) ? 'bg-indigo-100 text-indigo-700' :
                                            ['wife', 'mother'].includes(member.role) ? 'bg-pink-100 text-pink-700' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                            {translateRole(member)}
                                        </span>
                                    </td>
                                    <td className="py-3 font-medium text-gray-700 font-mono text-xs whitespace-nowrap">{member.dob || '-'}</td>
                                    <td className="py-3 font-mono text-gray-500 text-xs">{member.nid || '-'}</td>
                                    <td className="py-3">
                                        <div className="flex flex-col gap-1 items-start">
                                            {member.notes && (
                                                <span className="text-red-600 text-[10px] font-medium bg-red-50 px-2 py-1 rounded border border-red-100 mb-1">
                                                    {member.notes}
                                                </span>
                                            )}

                                            {isEligibleFemale && (
                                                <div className="flex gap-4 mt-1">
                                                    <div className="flex items-center gap-1.5" title="حامل">
                                                        {member.is_pregnant ?
                                                            <CheckSquare className="h-4 w-4 text-indigo-600" /> :
                                                            <Square className="h-4 w-4 text-gray-300" />
                                                        }
                                                        <span className="text-[10px] text-gray-500">حامل</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5" title="مرضعة">
                                                        {member.is_nursing ?
                                                            <CheckSquare className="h-4 w-4 text-indigo-600" /> :
                                                            <Square className="h-4 w-4 text-gray-300" />
                                                        }
                                                        <span className="text-[10px] text-gray-500">مرضعة</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div >

            {/* FOOTER */}
            < div className="mt-8 pt-6 border-t border-gray-200 flex justify-between items-end text-xs text-gray-400 relative z-10" >
                <div>
                    <p>تم استخراج الوثيقة إلكترونياً</p>
                    <p className="mt-1">النظام الذكي لإدارة شؤون العائلات</p>
                </div>
                <div className="text-center">
                    <div className="mb-2 text-gray-500">توقيع المسؤول</div>
                    <div className="w-32 h-10 border-b-2 border-gray-300"></div>
                </div>
            </div >
        </div >
    );
};

export default FamilyCard;
