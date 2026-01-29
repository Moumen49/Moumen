import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAllFamilies, getAllIndividuals, findHeadOfFamily } from '../lib/db';
import { useCamp } from '../context/CampContext';
import FamilyCard from '../components/FamilyCard';
import { Printer } from 'lucide-react';

export default function PrintFamilies() {
    const { selectedCamp, loading: campLoading } = useCamp();
    const [searchParams] = useSearchParams();
    const mode = searchParams.get('mode') || 'active'; // active, inactive, all
    const singleId = searchParams.get('id');

    const [printData, setPrintData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!campLoading && selectedCamp) {
            loadData();
        }
    }, [selectedCamp, campLoading, mode, singleId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const allFamilies = await getAllFamilies(selectedCamp.camp_id);
            const allIndividuals = await getAllIndividuals(selectedCamp.camp_id);

            let filteredFamilies = [];
            if (singleId) {
                filteredFamilies = allFamilies.filter(f => f.family_id === singleId);
            } else if (mode === 'active') {
                filteredFamilies = allFamilies.filter(f => !f.is_departed);
            } else if (mode === 'inactive') {
                filteredFamilies = allFamilies.filter(f => f.is_departed);
            } else if (mode === 'all') {
                filteredFamilies = allFamilies;
            }

            const data = filteredFamilies.map(fam => ({
                family: fam,
                members: sortMembers(allIndividuals.filter(i => i.family_id === fam.family_id))
            }));

            setPrintData(data);
        } catch (error) {
            console.error(error);
            alert('حدث خطأ في تحميل البيانات');
        } finally {
            setLoading(false);
        }
    };

    const sortMembers = (mems) => {
        return mems.sort((a, b) => {
            const roleScore = (r) => {
                if (!r) return 5;
                const role = r.toLowerCase().trim();
                // 1: Husband/Head
                if (['husband', 'father', 'زوج', 'أب', 'اب'].includes(role)) return 1;
                // 2: Widows/Divorced/Guardians
                if (['widow', 'أرملة', 'مطلقة', 'divorced', 'مهجورة', 'abandoned', 'وصي', 'guardian'].includes(role)) return 2;
                // 3: Wives
                if (['wife', 'mother', 'زوجة', 'أم', 'ام', 'زوجة ثانية', 'second_wife'].includes(role)) return 3;
                // 4: Children
                if (['son', 'daughter', 'ابن', 'ابنة'].includes(role)) return 4;
                return 5;
            };
            return roleScore(a.role) - roleScore(b.role) || (new Date(a.dob || 0).getTime() - new Date(b.dob || 0).getTime());
        });
    };

    if (campLoading || loading) {
        return <div className="flex justify-center items-center h-screen">جاري تحضير الملفات للطباعة...</div>;
    }

    if (!printData || printData.length === 0) {
        return <div className="p-10 text-center text-xl font-bold">لا توجد بيانات للطباعة</div>;
    }

    return (
        <div className="bg-white min-h-screen">
            <style>{`
                @media print {
                    @page { margin: 0; size: A4; }
                    body { margin: 0; padding: 0; }
                    .no-print { display: none !important; }
                    .printable-card {
                        break-after: page;
                        page-break-after: always;
                    }
                }
            `}</style>

            {/* Header for Screen Only */}
            <div className="no-print sticky top-0 bg-white border-b shadow-sm z-50 px-6 py-4 flex justify-between items-center mb-8">
                <h1 className="text-xl font-bold">عرض الطباعة ({printData.length} بطاقة)</h1>
                <button
                    onClick={() => window.print()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-bold transition shadow-lg"
                >
                    <Printer className="h-5 w-5" />
                    طباعة الآن
                </button>
            </div>

            {/* Cards */}
            <div>
                {printData.map((data, idx) => (
                    <FamilyCard key={data.family.family_id || idx} family={data.family} members={data.members} />
                ))}
            </div>
        </div>
    );
}
