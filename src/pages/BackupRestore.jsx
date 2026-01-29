import React from 'react';
import { Database, Construction } from 'lucide-react';

export default function BackupRestore() {
    return (
        <div className="min-h-[60vh] flex items-center justify-center p-4 md:p-8 pb-24 md:pb-10">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="mx-auto w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center relative">
                    <Database className="h-12 w-12 text-indigo-600 absolute" />
                    <Construction className="h-8 w-8 text-purple-600 absolute bottom-2 right-2" />
                </div>

                <div className="space-y-3">
                    <h1 className="text-3xl font-bold text-gray-900">
                        النسخ الاحتياطي والاستعادة
                    </h1>
                    <p className="text-lg text-gray-600">
                        🚧 جاري العمل على هذه الميزة
                    </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-right">
                    <p className="text-sm text-blue-800 leading-relaxed">
                        نعمل حالياً على تطوير نظام متقدم للنسخ الاحتياطي والاستعادة لضمان حماية بياناتك.
                        سيتم إضافة هذه الميزة قريباً.
                    </p>
                </div>

                <div className="pt-4">
                    <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                        قيد التطوير والإنجاز
                    </div>
                </div>
            </div>
        </div>
    );
}
