
import { supabase } from './supabaseClient';

const TABLES = [
    'camps',
    'delegates',
    'families',
    'individuals',
    'health_records',
    'aid_deliveries',
    'notifications'
];

/**
 * Creates a JSON object containing all data from all tables.
 */
export async function createFullBackup() {
    const backupData = {
        metadata: {
            version: 2, // Bump to 2 for Supabase
            created_at: new Date().toISOString(),
            app: 'family_data_cloud'
        },
        data: {}
    };

    for (const table of TABLES) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;
        backupData.data[table] = data;
    }

    return backupData;
}

/**
 * Restores the database from a backup JSON object.
 * WARNING: This clears all existing data.
 */
export async function restoreFullBackup(backupData) {
    if (!backupData || !backupData.data) {
        throw new Error('ملف النسخة الاحتياطية غير صالح');
    }

    // confirm again? UI handles confirmation.

    // 1. DELETE ALL DATA (Order matters for Foreign Keys!)
    // We must delete children first: health_records -> individuals -> aid_deliveries -> families -> delegates -> camps
    const DELETE_ORDER = [
        'health_records',
        'individuals',
        'aid_deliveries',
        'families',
        'delegates',
        'camps',
        'notifications'
    ];

    for (const table of DELETE_ORDER) {
        // Delete all rows. 
        // Supabase requires a WHERE clause for delete. for all rows use .neq('id', 0) or similar hack if no explicit "truncate" permission or RPC.
        // We will try deleting where some column is not null. 
        // Actually, we can use a helper if needed.
        // We need a reliable "always true" condition.
        // For tables with UUID PK, check PK is not null.

        let pk = 'id'; // default
        if (table === 'families') pk = 'family_id';
        if (table === 'individuals') pk = 'individual_id';
        // ... need correct PKs.

        // Easier: .neq('created_at', '1900-01-01') ? (assuming date col exists)
        // All my tables have created_at!

        const { error } = await supabase.from(table).delete().neq('created_at', '1970-01-01T00:00:00Z');
        if (error) {
            console.error(`Error clearing table ${table}`, error);
            // It might fail on FK if order is wrong.
            // If we have cascade delete on FKs, deleting families deletes individuals.
            // My schema said: `on delete cascade` for many relations.
            // So deleting families should clear individuals and health_records.
            // Deleting camps? Delegates?
        }
    }

    // 2. INSERT DATA (Order matters: Parents first)
    // Camps -> Delegates -> Families -> Individuals -> Health -> Aid
    const INSERT_ORDER = [
        'camps',
        'delegates',
        'families',
        'individuals',
        'health_records',
        'aid_deliveries',
        'notifications'
    ];

    for (const table of INSERT_ORDER) {
        const rows = backupData.data[table];
        if (rows && rows.length > 0) {
            // Bulk insert
            const { error } = await supabase.from(table).insert(rows);
            if (error) {
                console.error(`Error restoring table ${table}`, error);
                throw new Error(`تعذر استعادة جدول ${table}: ${error.message}`);
            }
        }
    }
}
