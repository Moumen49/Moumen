
import { supabase, supabaseAdmin } from './supabaseClient';

// Helper for username to virtual email conversion
export function usernameToEmail(username) {
    if (!username) return '';
    // If it already looks like an email, keep it
    if (username.includes('@')) return username;
    // Otherwise, append virtual domain
    return `${username.trim().toLowerCase()}@system.local`;
}

// Helper to extract username from virtual email for display
export function emailToUsername(email) {
    if (!email) return '';
    if (email.endsWith('@system.local')) {
        return email.replace('@system.local', '');
    }
    return email;
}

/**
 * Standard logic to find the head of household from a list of members.
 * Supports English and Arabic roles with a fallback to the oldest person.
 */
export function findHeadOfFamily(members) {
    if (!members || members.length === 0) return null;

    const headRoles = [
        'husband', 'widower', 'widow', 'divorced', 'abandoned', 'second_wife', 'guardian', 'other',
        'father', 'head', 'head_of_household',
        'زوج', 'أرمل', 'أرملة', 'مطلقة', 'مهجورة', 'زوجة ثانية', 'وصي', 'أخرى', 'أب', 'اب', 'رب أسرة', 'ربة أسرة'
    ];

    // 1. Try to find by specific role
    let head = members.find(m => m.role && headRoles.includes(m.role.toLowerCase().trim()));

    // 2. Special check for "Other" with "Rab" in description
    if (!head) {
        head = members.find(m => m.role === 'أخرى' && m.role_description?.includes('رب'));
    }

    // 3. Fallback: Oldest person
    if (!head) {
        head = [...members].sort((a, b) => {
            const dateA = a.dob ? new Date(a.dob).getTime() : Infinity;
            const dateB = b.dob ? new Date(b.dob).getTime() : Infinity;
            return dateA - dateB; // Oldest first
        })[0];
    }

    return head;
}

// Helper for client-side ID generation (keeping for optimistic UI)
function uuidv4() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// For compatibility with any code calling getDB directly (though they shouldn't if we replace all exports)
export async function getDB() {
    return supabase;
}

// ============================================
// FAMILIES - العائلات
// ============================================

// Helper for recursive fetching
async function fetchAll(query) {
    let allData = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;

        if (!data || data.length === 0) break;

        allData = allData.concat(data);

        if (data.length < pageSize) break;
        page++;
    }
    return allData;
}

export async function getAllFamilies(campId = null) {
    let query = supabase.from('families').select('*', { count: 'exact' });
    if (campId) {
        query = query.eq('camp_id', campId);
    }

    // Use recursive fetch to get EVERYTHING
    const data = await fetchAll(query);

    // Sort by family_number client-side
    data.sort((a, b) => (parseInt(a.family_number) || 0) - (parseInt(b.family_number) || 0));
    return data;
}

export async function getFamilyOverview(campId = null) {
    let query = supabase.from('family_overview').select('*');
    if (campId) {
        query = query.eq('camp_id', campId);
    }
    // Fetch all records using range
    const data = await fetchAll(query);

    // Sort logic
    data.sort((a, b) => (parseInt(a.family_number) || 0) - (parseInt(b.family_number) || 0));
    return data;
}

export async function getFamily(familyId) {
    const { data, error } = await supabase.from('families').select('*').eq('family_id', familyId).single();
    if (error) throw error;
    return data;
}

export async function getFamilyMembers(familyId) {
    const { data, error } = await supabase.from('individuals').select('*, health_records(*)').eq('family_id', familyId);
    if (error) throw error;

    // Map health records flattened? Or keep structure?
    // EditFamily expects flattened probably or handles it. 
    // Let's standardise on returning individuals.
    return data.map(ind => {
        const health = Array.isArray(ind.health_records) ? ind.health_records[0] : ind.health_records;
        return {
            ...ind,
            is_pregnant: health?.is_pregnant || false,
            is_nursing: health?.is_nursing || false,
            notes: health?.notes || ''
        };
    });
}

export async function getAllIndividuals(campId = null) {
    let query = supabase.from('individuals').select(`
        *,
        families!inner (*),
        health_records (*)
    `);

    if (campId) {
        query = query.eq('families.camp_id', campId);
    }

    // Use recursive fetch to get EVERYTHING
    const allIndividuals = await fetchAll(query);

    return allIndividuals.map(ind => {
        const family = ind.families;
        const health = Array.isArray(ind.health_records) ? ind.health_records[0] : ind.health_records;

        return {
            ...ind,
            // families: family, // Keeps nested object if needed
            family_number: family?.family_number,
            family_contact: family?.contact,
            family_delegate: family?.delegate,
            family_address: family?.address,
            is_departed: family?.is_departed || false,
            is_pregnant: health?.is_pregnant || false,
            is_nursing: health?.is_nursing || false,
            health_notes: health?.notes || ''
        };
    });
}

// Check if NID exists
export async function checkNidExists(nid) {
    if (!nid) return false;
    const { count, error } = await supabase
        .from('individuals')
        .select('*', { count: 'exact', head: true })
        .eq('nid', nid);

    if (error) {
        console.error('Error checking NID:', error);
        return false;
    }
    return count > 0;
}

export async function createIndividual(individualData) {
    const newIndividual = {
        individual_id: individualData.individual_id || uuidv4(),
        family_id: individualData.family_id,
        name: individualData.name,
        nid: individualData.nid || null,
        dob: individualData.dob || null,
        gender: individualData.gender,
        role: individualData.role,
        role_description: individualData.role_description || null,
        deceased_husband_name: individualData.deceased_husband_name || null,
        husband_death_date: individualData.husband_death_date || null,
        shoe_size: individualData.shoe_size || null,
        clothes_size: individualData.clothes_size || null,
        created_at: new Date().toISOString()
    };

    const { error: indError } = await supabase.from('individuals').insert(newIndividual);
    if (indError) throw indError;

    if (individualData.is_pregnant || individualData.is_nursing || individualData.notes) {
        const healthData = {
            individual_id: newIndividual.individual_id,
            is_pregnant: individualData.is_pregnant || false,
            is_nursing: individualData.is_nursing || false,
            notes: individualData.notes || null
        };
        const { error: hError } = await supabase.from('health_records').insert(healthData);
        if (hError) throw hError;
    }

    return newIndividual;
}

export async function updateIndividual(individualId, updates) {
    const { is_pregnant, is_nursing, notes, ...indFields } = updates;

    // Update individual basic data
    if (Object.keys(indFields).length > 0) {
        const { error } = await supabase.from('individuals').update(indFields).eq('individual_id', individualId);
        if (error) throw error;
    }

    // Update or Insert health record
    if (is_pregnant !== undefined || is_nursing !== undefined || notes !== undefined) {
        const { data: existing } = await supabase.from('health_records').select('*').eq('individual_id', individualId).single();

        const healthUpdates = {};
        if (is_pregnant !== undefined) healthUpdates.is_pregnant = is_pregnant;
        if (is_nursing !== undefined) healthUpdates.is_nursing = is_nursing;
        if (notes !== undefined) healthUpdates.notes = notes;

        if (existing) {
            await supabase.from('health_records').update(healthUpdates).eq('individual_id', individualId);
        } else {
            await supabase.from('health_records').insert({ individual_id: individualId, ...healthUpdates });
        }
    }

    return { ...updates, individual_id: individualId }; // Return mocked result or fetch fresh
}

export async function deleteIndividual(individualId) {
    // Cascade should handle health records
    const { error } = await supabase.from('individuals').delete().eq('individual_id', individualId);
    if (error) throw error;
}

export async function deleteFamilyMembers(familyId) {
    const { error } = await supabase.from('individuals').delete().eq('family_id', familyId);
    if (error) throw error;
}

// ============================================
// AID DELIVERIES
// ============================================

export async function getFullFamilyByHeadNid(nid) {
    // Find individual with that NID
    const { data: ind } = await supabase.from('individuals').select('family_id').eq('nid', nid).maybeSingle();

    if (!ind) return null;

    const { data: family } = await supabase.from('families').select('*').eq('family_id', ind.family_id).single();
    return family;
}

export async function getFamilyAid(familyId) {
    const { data, error } = await supabase.from('aid_deliveries').select('*').eq('family_id', familyId);
    if (error) throw error;
    return data;
}

export async function getAllAidDeliveries() {
    const query = supabase.from('aid_deliveries').select('*');
    return await fetchAll(query);
}

export async function addFamilyAid(aidData) {
    // Check for duplicate if parcel_id is present (Idempotency)
    if (aidData.parcel_id) {
        const { data: existing } = await supabase
            .from('aid_deliveries')
            .select('*')
            .eq('family_id', aidData.family_id)
            .eq('parcel_id', aidData.parcel_id)
            .maybeSingle();

        if (existing) {
            console.log(`Duplicate parcel ignored: ${aidData.parcel_id} for family ${aidData.family_id}`);
            return existing;
        }
    }

    const newAid = {
        delivery_id: aidData.delivery_id || uuidv4(),
        ...aidData,
        created_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('aid_deliveries').insert(newAid).select().single();
    if (error) throw error;
    return data;
}

export async function deleteFamilyAid(deliveryId) {
    const { error } = await supabase.from('aid_deliveries').delete().eq('delivery_id', deliveryId);
    if (error) throw error;
}

export async function deleteAllAidDeliveries() {
    const { error } = await supabase.from('aid_deliveries').delete().neq('delivery_id', '00000000-0000-0000-0000-000000000000'); // Hack to delete all
    if (error) throw error;
}

// ============================================
// BATCH OPERATIONS
// ============================================

export async function saveFamilyWithMembers(familyData, members, currentUser = null) {
    // Sequential fallback for simplicity or RPC?
    // Let's do client-side sequential calls.
    let family;

    if (familyData.family_id) {
        // Check if exists
        const { data: existing } = await supabase.from('families').select('*').eq('family_id', familyData.family_id).maybeSingle();
        if (existing) {
            family = await updateFamily(familyData.family_id, {
                family_number: familyData.family_number,
                address: familyData.address,
                contact: familyData.contact,
                alternative_mobile: familyData.alternative_mobile,
                housing_status: familyData.housing_status,
                family_needs: familyData.family_needs,
                delegate: familyData.delegate,
                camp_id: familyData.camp_id || existing.camp_id,
                is_departed: familyData.is_departed
            });
        } else {
            family = await createFamily(familyData);
        }
    } else {
        familyData.camp_id = familyData.camp_id || 'default';
        family = await createFamily(familyData);
    }

    // Delete existing members (Full replacement strategy as per previous db.js)
    await deleteFamilyMembers(family.family_id);

    // Add new members
    for (const member of members) {
        await createIndividual({ ...member, family_id: family.family_id });
    }

    // التحقق من التطابق عبر المخيمات وإرسال إشعارات
    await checkCrossCampDuplicates(family.family_id, family.camp_id, members, currentUser);

    return family;
}

export async function batchImportFamilies(familiesData, campId = 'default') {
    return batchImportDataFast(familiesData, null, campId);
}

export async function batchImportDataFast(familiesData, progressCallback, campId = 'default') {
    const results = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < familiesData.length; i += BATCH_SIZE) {
        const batch = familiesData.slice(i, i + BATCH_SIZE);

        // We will do this 1 by 1 inside the batch loop to capture individual errors 
        // OR try to do bulk insert. 
        // Bulk insert is risky if one fails.
        // Let's iterate.
        for (const f of batch) {
            try {
                // Prepare Family
                const familyId = uuidv4();
                const newFamily = {
                    family_id: familyId,
                    family_number: f.family_number,
                    address: f.address,
                    contact: f.contact,
                    alternative_mobile: f.alternative_mobile || null,
                    housing_status: f.housing_status || null,
                    family_needs: f.family_needs || null,
                    camp_id: campId,
                    is_departed: false,
                    created_at: new Date().toISOString()
                };

                const { error: fErr } = await supabase.from('families').insert(newFamily);
                if (fErr) throw fErr;

                // Prepare Members
                if (f.members && f.members.length > 0) {
                    for (const m of f.members) {
                        await createIndividual({ ...m, family_id: familyId });
                    }
                }

                results.push({ success: true, family_id: familyId, family_number: f.family_number });
            } catch (err) {
                console.error("Import Error", err);
                results.push({ success: false, error: err.message, family_number: f.family_number });
            }
        }

        if (progressCallback) {
            progressCallback(Math.min(i + BATCH_SIZE, familiesData.length), familiesData.length);
        }
    }
    return results;
}

// ============================================
// USERS & AUTH
// ============================================

export async function registerUser(userData) {
    const { email, password, assigned_camps, ...meta } = userData;
    // Use username as email if explicitly provided as username or if email is not a standard email
    const virtualEmail = usernameToEmail(userData.username || email);

    const { data, error } = await supabase.auth.signUp({
        email: virtualEmail,
        password: password,
        options: {
            data: meta // This will include username, role, camp_id, etc.
        }
    });

    if (error) throw new Error(error.message);

    // If supervisor, save assigned_camps to user_permissions table
    if (userData.role === 'supervisor' && assigned_camps && assigned_camps.length > 0) {
        const { error: permError } = await supabase
            .from('user_permissions')
            .insert({
                user_id: data.user.id,
                assigned_camps: assigned_camps
            });

        if (permError) {
            console.error('Error saving user permissions:', permError);
            // Don't throw, user is created but permissions failed
        }
    }

    // Return formatted user object compatible with app
    return {
        user_id: data.user.id,
        email: data.user.email,
        username: data.user.user_metadata?.username,
        fullName: data.user.user_metadata?.fullName,
        role: data.user.user_metadata?.role,
        camp_id: data.user.user_metadata?.camp_id,
        assigned_camps: assigned_camps || []
    };
}

export async function authenticateUser(identifier, password) {
    const virtualEmail = usernameToEmail(identifier);
    const { data, error } = await supabase.auth.signInWithPassword({
        email: virtualEmail,
        password
    });

    if (error) throw new Error(error.message);

    // If supervisor, fetch assigned_camps from user_permissions
    let assigned_camps = [];
    if (data.user.user_metadata?.role === 'supervisor') {
        const { data: perms } = await supabase
            .from('user_permissions')
            .select('assigned_camps')
            .eq('user_id', data.user.id)
            .single();

        assigned_camps = perms?.assigned_camps || [];
    }

    return {
        user_id: data.user.id,
        email: data.user.email,
        username: data.user.user_metadata?.username,
        fullName: data.user.user_metadata?.fullName,
        role: data.user.user_metadata?.role,
        camp_id: data.user.user_metadata?.camp_id,
        assigned_camps: assigned_camps
    };
}

// Get all users (Admin only - uses Supabase Admin API)
export async function getAllUsers() {
    try {
        // Note: This requires admin privileges on the client or a server function
        // For now, we'll use the auth.admin API which requires service role key
        // In production, this should be called from a secure backend endpoint

        const { data, error } = await supabaseAdmin.auth.admin.listUsers();

        if (error) throw new Error(error.message);

        // Fetch all user permissions in one query
        const { data: allPerms } = await supabase
            .from('user_permissions')
            .select('*');

        const permsMap = {};
        if (allPerms) {
            allPerms.forEach(p => {
                permsMap[p.user_id] = p.assigned_camps || [];
            });
        }

        return data.users.map(user => ({
            user_id: user.id,
            email: user.email,
            username: user.user_metadata?.username || 'غير محدد',
            fullName: user.user_metadata?.fullName || '', // Add this line
            role: user.user_metadata?.role || 'user',
            camp_id: user.user_metadata?.camp_id || null,
            assigned_camps: permsMap[user.id] || [],
            user_metadata: user.user_metadata, // Standardise metadata access
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at
        }));
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
}

// Get single user by ID
export async function getUserById(userId) {
    try {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (error) throw new Error(error.message);

        return {
            user_id: data.user.id,
            email: data.user.email,
            username: data.user.user_metadata?.username,
            role: data.user.user_metadata?.role,
            camp_id: data.user.user_metadata?.camp_id
        };
    } catch (error) {
        console.error('Error fetching user:', error);
        throw error;
    }
}

// Update user metadata (username, role, camp_id, password)
export async function updateUserData(userId, updates) {
    try {
        // Get current user data first
        const { data: currentUser } = await supabaseAdmin.auth.admin.getUserById(userId);

        // Separate assigned_camps from user metadata
        const { assigned_camps, ...metaUpdates } = updates;

        const updatedMetadata = {
            ...currentUser.user.user_metadata,
            ...metaUpdates
        };

        const updatePayload = {
            user_metadata: updatedMetadata,
            ...(updates.username && { email: usernameToEmail(updates.username) }),
            ...(updates.email && { email: updates.email }),
            ...(updates.password && { password: updates.password }) // إضافة كلمة المرور
        };

        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            updatePayload
        );

        if (error) throw new Error(error.message);

        // Update assigned_camps if role is supervisor
        if (updates.role === 'supervisor' && assigned_camps !== undefined) {
            // Upsert user_permissions
            const { error: permError } = await supabase
                .from('user_permissions')
                .upsert({
                    user_id: userId,
                    assigned_camps: assigned_camps,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

            if (permError) {
                console.error('Error updating user permissions:', permError);
            }
        } else if (updates.role && updates.role !== 'supervisor') {
            // If changing FROM supervisor to another role, delete permissions
            await supabase
                .from('user_permissions')
                .delete()
                .eq('user_id', userId);
        }

        return {
            user_id: data.user.id,
            email: data.user.email,
            username: data.user.user_metadata?.username,
            fullName: data.user.user_metadata?.fullName,
            role: data.user.user_metadata?.role,
            camp_id: data.user.user_metadata?.camp_id,
            assigned_camps: assigned_camps
        };
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
}

// Delete user account
export async function deleteUser(userId) {
    try {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw new Error(error.message);
        return true;
    } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
    }
}

// ============================================
// NOTIFICATIONS
// ============================================

export async function createNotification(notificationData) {
    const notif = {
        notification_id: uuidv4(),
        ...notificationData,
        is_read: 0,
        created_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('notifications').insert(notif).select().single();
    if (error) throw error;
    return data;
}

export async function getUnreadNotifications() {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('is_read', 0)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function markNotificationAsRead(id) {
    await supabase.from('notifications').update({ is_read: 1 }).eq('notification_id', id);
}

export async function deleteAllNotifications() {
    const { error } = await supabase.from('notifications').delete().neq('notification_id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
}


// التحقق من تطابق NIDs عبر المخيمات
export async function checkCrossCampDuplicates(familyId, campId, members, currentUser = null) {
    try {
        // جمع جميع NIDs من أفراد العائلة (استثناء القيم الفارغة)
        const nidsToCheck = members
            .map(m => m.nid)
            .filter(nid => nid && nid.trim() !== '');

        if (nidsToCheck.length === 0) {
            return; // لا توجد أرقام هوية للتحقق منها
        }

        // البحث عن أي أفراد بنفس NIDs في قاعدة البيانات
        const { data: duplicateIndividuals, error } = await supabase
            .from('individuals')
            .select(`
                individual_id,
                nid,
                name,
                role,
                family_id,
                families!inner (
                    family_id,
                    family_number,
                    camp_id,
                    is_departed,
                    camps!inner (
                        name
                    )
                )
            `)
            .in('nid', nidsToCheck)
            .neq('families.camp_id', campId); // فقط المخيمات المختلفة

        if (error) {
            console.error('Error checking cross-camp duplicates:', error);
            return;
        }

        if (!duplicateIndividuals || duplicateIndividuals.length === 0) {
            return; // لا توجد تطابقات
        }

        // الحصول على معلومات العائلة الحالية
        const { data: currentFamily } = await supabase
            .from('families')
            .select(`
                family_number,
                is_departed,
                camps!inner (
                    name
                )
            `)
            .eq('family_id', familyId)
            .single();

        // إذا كانت العائلة الحالية مغادرة، لا نرسل إشعارات
        if (!currentFamily || currentFamily.is_departed) {
            return;
        }

        // تجميع التطابقات حسب العائلة
        const duplicatesByFamily = {};
        for (const dup of duplicateIndividuals) {
            const otherFamily = dup.families;

            // تجاهل إذا كانت العائلة الأخرى مغادرة
            if (otherFamily.is_departed) {
                continue;
            }

            const familyKey = otherFamily.family_id;
            if (!duplicatesByFamily[familyKey]) {
                duplicatesByFamily[familyKey] = {
                    family_number: otherFamily.family_number,
                    camp_name: otherFamily.camps.name,
                    individuals: []
                };
            }

            duplicatesByFamily[familyKey].individuals.push({
                name: dup.name,
                nid: dup.nid,
                role: dup.role
            });
        }

        // تحديد رب العائلة الحالية
        const priorityRoles = { 'husband': 1, 'wife': 2, 'widow': 3, 'widower': 4, 'divorced': 5, 'abandoned': 6, 'guardian': 7 };
        let currentHeadName = 'غير معروف';
        let lowestPriority = 99;

        for (const m of members) {
            const p = priorityRoles[m.role] || 99;
            if (p < lowestPriority) {
                lowestPriority = p;
                currentHeadName = m.name;
            }
        }

        // إرسال إشعار لكل عائلة مطابقة
        for (const [otherFamilyId, info] of Object.entries(duplicatesByFamily)) {
            const duplicateCount = info.individuals.length;
            if (duplicateCount === 0) continue;

            // محاولة جلب اسم رب العائلة الأخرى
            let otherHeadName = 'غير معروف';
            try {
                const { data: headData } = await supabase
                    .from('individuals')
                    .select('name, role')
                    .eq('family_id', otherFamilyId);

                if (headData) {
                    let bestP = 99;
                    for (const h of headData) {
                        const p = priorityRoles[h.role] || 99;
                        if (p < bestP) {
                            bestP = p;
                            otherHeadName = h.name;
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching other head name:", err);
            }

            const message = `⚠️ تنبيه: العائلة رقم ${currentFamily.family_number} (${currentHeadName}) في مخيم ${currentFamily.camps.name} لديها تطابق في أرقام الهوية مع العائلة رقم ${info.family_number} (${otherHeadName}) في مخيم ${info.camp_name}. (عدد الأفراد المتطابقين: ${duplicateCount})`;

            // إنشاء الإشعار
            await createNotification({
                user_name: currentUser?.username || 'النظام',
                message: message,
                type: 'alert'
            });
        }

    } catch (error) {
        console.error('Error in checkCrossCampDuplicates:', error);
        // لا نقوم برفع الخطأ لعدم إيقاف عملية الحفظ
    }
}

// فحص جميع العائلات الموجودة للبحث عن تطابقات سابقة
export async function scanExistingFamiliesForDuplicates(currentUser = null) {
    try {
        console.log('بدء فحص العائلات الموجودة...');

        // جلب جميع الأفراد مع معلومات العائلة
        const { data: allIndividuals, error } = await supabase
            .from('individuals')
            .select(`
                individual_id,
                nid,
                name,
                role,
                family_id,
                families!inner (
                    family_id,
                    family_number,
                    camp_id,
                    is_departed
                )
            `)
            .not('nid', 'is', null);

        if (error) {
            console.error('Error fetching individuals:', error);
            throw error;
        }

        // فلترة الأفراد من العائلات النشطة فقط
        const activeIndividuals = allIndividuals.filter(ind => !ind.families.is_departed);
        console.log(`تم جلب ${activeIndividuals.length} فرد من العائلات النشطة`);

        // تحديد اسم رب العائلة لكل عائلة وتصفية العائلات حسب المخيم
        const familyHeads = {};
        const priorityRoles = { 'husband': 1, 'wife': 2, 'widow': 3, 'widower': 4, 'divorced': 5, 'abandoned': 6, 'guardian': 7 };

        for (const ind of activeIndividuals) {
            const fid = ind.family_id;
            const rolePriority = priorityRoles[ind.role] || 99;

            if (!familyHeads[fid] || rolePriority < familyHeads[fid].priority) {
                familyHeads[fid] = { name: ind.name, priority: rolePriority };
            }
        }

        // جلب معلومات جميع المخيمات
        const { data: allCamps } = await supabase
            .from('camps')
            .select('camp_id, name');

        const campsMap = {};
        if (allCamps) {
            allCamps.forEach(c => {
                campsMap[c.camp_id] = c.name;
            });
        }

        // إنشاء خريطة للأفراد حسب رقم الهوية (تخطي الذين ليس لهم مخيم محدد في قاعدة البيانات)
        const nidMap = {};
        for (const ind of activeIndividuals) {
            if (!ind.nid || ind.nid.trim() === '') continue;
            if (!campsMap[ind.families.camp_id]) continue; // تخطي إذا كان المخيم غير موجود في جدول المخيمات

            if (!nidMap[ind.nid]) {
                nidMap[ind.nid] = [];
            }
            nidMap[ind.nid].push(ind);
        }

        // البحث عن التطابقات عبر المخيمات
        const duplicates = [];
        for (const [nid, individuals] of Object.entries(nidMap)) {
            if (individuals.length < 2) continue; // لا يوجد تكرار

            // التحقق من وجود أفراد في مخيمات مختلفة
            const campIds = new Set(individuals.map(ind => ind.families.camp_id));
            if (campIds.size > 1) {
                // يوجد تطابق عبر مخيمات مختلفة
                duplicates.push({
                    nid: nid,
                    individuals: individuals
                });
            }
        }

        console.log(`تم العثور على ${duplicates.length} هوية مكررة عبر المخيمات الموثقة`);

        // تجميع التطابقات حسب أزواج العائلات لتجنب كثرة الإشعارات
        const familyPairDuplicates = {};

        for (const dup of duplicates) {
            const individuals = dup.individuals;

            // إنشاء جميع الأزواج الممكنة من الأفراد في مخيمات مختلفة لهذه الهوية
            for (let i = 0; i < individuals.length; i++) {
                for (let j = i + 1; j < individuals.length; j++) {
                    const ind1 = individuals[i];
                    const ind2 = individuals[j];

                    // فقط إذا كانوا في مخيمات مختلفة
                    if (ind1.families.camp_id !== ind2.families.camp_id) {
                        // ترتيب المعرفات لضمان ثبات المفتاح
                        const pair = [ind1.families, ind2.families].sort((a, b) => a.family_id.localeCompare(b.family_id));
                        const pairKey = `${pair[0].family_id}_${pair[1].family_id}`;

                        if (!familyPairDuplicates[pairKey]) {
                            familyPairDuplicates[pairKey] = {
                                f1: pair[0],
                                f2: pair[1],
                                sharedNids: new Set()
                            };
                        }
                        familyPairDuplicates[pairKey].sharedNids.add(dup.nid);
                    }
                }
            }
        }

        // إرسال إشعار لكل زوج من العائلات المتطابقة
        let notificationCount = 0;
        const pairs = Object.values(familyPairDuplicates);

        for (const pair of pairs) {
            const sharedCount = pair.sharedNids.size;
            if (sharedCount === 0) continue;

            const camp1Name = campsMap[pair.f1.camp_id];
            const camp2Name = campsMap[pair.f2.camp_id];

            const head1Name = familyHeads[pair.f1.family_id]?.name || 'غير معروف';
            const head2Name = familyHeads[pair.f2.family_id]?.name || 'غير معروف';

            const message = `⚠️ تطابق بيانات: العائلة رقم ${pair.f1.family_number} (${head1Name}) في مخيم ${camp1Name} لديها تطابق في أرقام الهوية مع العائلة رقم ${pair.f2.family_number} (${head2Name}) في مخيم ${camp2Name}. (عدد الأفراد المتطابقين: ${sharedCount})`;

            await createNotification({
                user_name: currentUser?.username || 'النظام',
                message: message,
                type: 'alert'
            });

            notificationCount++;
        }

        console.log(`تم إرسال ${notificationCount} إشعار ملخص`);
        return {
            success: true,
            totalDuplicates: duplicates.length,
            notificationsSent: notificationCount
        };

    } catch (error) {
        console.error('Error in scanExistingFamiliesForDuplicates:', error);
        throw error;
    }
}


// ============================================
// DELEGATES
// ============================================

export async function getDelegates(campId) {
    let query = supabase.from('delegates').select('*');
    if (campId) {
        query = query.eq('camp_id', campId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function addDelegate(delegateData) {
    let name;
    let data = {};
    if (typeof delegateData === 'string') {
        name = delegateData;
        data = { name };
    } else {
        name = delegateData.name;
        data = delegateData;
    }

    const newDel = {
        delegate_id: uuidv4(),
        ...data,
        created_at: new Date().toISOString()
    };
    const { data: res, error } = await supabase.from('delegates').insert(newDel).select().single();
    if (error) throw error;
    return res;
}

export async function updateDelegate(id, updates) {
    const { data, error } = await supabase.from('delegates').update(updates).eq('delegate_id', id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteDelegate(id) {
    const { error } = await supabase.from('delegates').delete().eq('delegate_id', id);
    if (error) throw error;
}

export async function assignDelegatesToCamp(targetCampId) {
    // Sets all delegates with null camp_id to targetCampId
    // Supabase update
    const { count, error } = await supabase
        .from('delegates')
        .update({ camp_id: targetCampId })
        .is('camp_id', null)
        .select('*', { count: 'exact' });

    if (error) throw error;
    return count; // Supabase usually returns count if requested
}

export async function getUnassignedDelegatesCount() {
    const { count, error } = await supabase
        .from('delegates')
        .select('*', { count: 'exact', head: true })
        .is('camp_id', null);
    if (error) throw error;
    return count;
}

export async function moveDelegatesByName(sourceCampName, targetCampName) {
    // Get Camp IDs
    const { data: source } = await supabase.from('camps').select('camp_id').eq('name', sourceCampName).single();
    const { data: target } = await supabase.from('camps').select('camp_id').eq('name', targetCampName).single();

    if (!source || !target) throw new Error('Camps not found');

    const { count, error } = await supabase
        .from('delegates')
        .update({ camp_id: target.camp_id })
        .eq('camp_id', source.camp_id)
        .select('*', { count: 'exact' });

    if (error) throw error;
    return count;
}

// ============================================
// CAMPS
// ============================================

export async function getCamps() {
    const { data, error } = await supabase.from('camps').select('*');
    if (error) throw error;
    return data;
}

export async function addCamp(campData) {
    const camp = {
        camp_id: uuidv4(),
        name: typeof campData === 'string' ? campData : campData.name,
        is_default: false,
        created_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('camps').insert(camp).select().single();
    if (error) throw error;
    return data;
}

export async function updateCamp(id, updates) {
    const { data, error } = await supabase.from('camps').update(updates).eq('camp_id', id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteCamp(id) {
    const { error } = await supabase.from('camps').delete().eq('camp_id', id);
    if (error) throw error;
}

export async function assignCampToOrphans(targetCampId) {
    const { count, error } = await supabase
        .from('families')
        .update({ camp_id: targetCampId })
        .is('camp_id', null)
        .select('*', { count: 'exact' });
    if (error) throw error;
    return count;
}

export async function upsertHealthRecord(healthData) {
    const { data, error } = await supabase.from('health_records').upsert(healthData).select().single();
    if (error) throw error;
    return data;
}

export async function createFamily(familyData) {
    const newFamily = {
        family_id: familyData.family_id || uuidv4(),
        ...familyData,
        created_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('families').insert(newFamily).select().single();
    if (error) throw error;
    return data;
}

export async function updateFamily(familyId, updates) {
    const { data, error } = await supabase.from('families').update(updates).eq('family_id', familyId).select().single();
    if (error) throw error;
    return data;
}

export async function deleteFamily(familyId) {
    const { error } = await supabase.from('families').delete().eq('family_id', familyId);
    if (error) throw error;
}

// ============================================
// PARCELS MANAGEMENT
// ============================================

export async function getParcels(campId) {
    let query = supabase.from('parcels').select('*').order('created_at', { ascending: false });
    if (campId) {
        query = query.eq('camp_id', campId);
    }
    const { data, error } = await query;
    if (error) {
        // Fallback if table doesn't exist yet, return empty to prevent crash
        console.warn("Parcels table might not exist yet:", error.message);
        return [];
    }
    return data;
}

export async function createParcel(parcelData) {
    // 1. Calculate new display_id manually (Reset to 1 if empty)
    const { data: maxData } = await supabase
        .from('parcels')
        .select('display_id')
        .eq('camp_id', parcelData.camp_id)
        .order('display_id', { ascending: false })
        .limit(1)
        .maybeSingle();

    let nextId = 1;
    if (maxData && maxData.display_id) {
        nextId = maxData.display_id + 1;
    }

    const newParcel = {
        parcel_id: parcelData.parcel_id || uuidv4(),
        ...parcelData,
        display_id: nextId,
        created_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('parcels').insert(newParcel).select().single();
    if (error) throw error;
    return data;
}

export async function updateParcel(parcelId, updates) {
    const { data, error } = await supabase.from('parcels').update(updates).eq('parcel_id', parcelId).select().single();
    if (error) throw error;
    return data;
}

export async function deleteParcel(parcelId) {
    // First, maybe unlink aid deliveries? Or relies on cascade?
    // Safe choice: Set parcel_id to null in aid_deliveries or delete them depending on requirement.
    // Assuming backend foreign key has ON DELETE SET NULL or CASCADE.
    // If not, we do it manually:
    await supabase.from('aid_deliveries').delete().eq('parcel_id', parcelId);

    const { error } = await supabase.from('parcels').delete().eq('parcel_id', parcelId);
    if (error) throw error;
}

export async function getParcelBeneficiaries(parcelId) {
    // Get all aid deliveries linked to this parcel, with family details
    const { data, error } = await supabase
        .from('aid_deliveries')
        .select(`
            *,
            families:family_id (
                family_number,
                address,
                contact,
                delegate,
                individuals!inner (
                    name,
                    nid
                )
            )
        `)
        .eq('parcel_id', parcelId);

    // Note: individuals!inner is tricky if we just want the head.
    // Better strategy: Fetch aid_deliveries, then fetch families manually or use a view.
    // For now, let's just get the aid records and let the UI resolve family names if possible,
    // OR rely on the fact that `recipient` field often stores the name.

    if (error) throw error;
    return data;
}
