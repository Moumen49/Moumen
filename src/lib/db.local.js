import { openDB } from 'idb';

const DB_NAME = 'family_data_local';
const DB_VERSION = 9; // Bump version for constraints fix

let dbPromise = null;

export function getDB() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion, newVersion, transaction) {
                // Families store
                if (!db.objectStoreNames.contains('families')) {
                    const store = db.createObjectStore('families', { keyPath: 'family_id' });
                    // Changed to unique: false to allow same family numbers in different camps
                    store.createIndex('family_number', 'family_number', { unique: false });
                }
                const famStore = transaction.objectStore('families');
                if (!famStore.indexNames.contains('camp_id')) {
                    famStore.createIndex('camp_id', 'camp_id', { unique: false });
                }

                // Individuals store
                if (!db.objectStoreNames.contains('individuals')) {
                    const store = db.createObjectStore('individuals', { keyPath: 'individual_id' });
                    store.createIndex('family_id', 'family_id', { unique: false });
                    store.createIndex('nid', 'nid', { unique: false });
                } else {
                    const store = transaction.objectStore('individuals');
                    if (!store.indexNames.contains('nid')) {
                        store.createIndex('nid', 'nid', { unique: false });
                    }
                }
                // Health records store
                if (!db.objectStoreNames.contains('health_records')) {
                    const store = db.createObjectStore('health_records', { keyPath: 'individual_id' });
                }
                // Aid Deliveries store (New in V2)
                if (!db.objectStoreNames.contains('aid_deliveries')) {
                    const store = db.createObjectStore('aid_deliveries', { keyPath: 'delivery_id' });
                    store.createIndex('family_id', 'family_id', { unique: false });
                }
                // Users store (New in V4)
                if (!db.objectStoreNames.contains('users')) {
                    const store = db.createObjectStore('users', { keyPath: 'user_id' });
                    store.createIndex('email', 'email', { unique: true });
                }
                // Notifications store (New in V4)
                if (!db.objectStoreNames.contains('notifications')) {
                    const store = db.createObjectStore('notifications', { keyPath: 'notification_id' });
                    store.createIndex('created_at', 'created_at', { unique: false });
                    store.createIndex('is_read', 'is_read', { unique: false });
                }
                // Delegates store (New in V5)
                if (!db.objectStoreNames.contains('delegates')) {
                    const store = db.createObjectStore('delegates', { keyPath: 'delegate_id' });
                    // Changed to unique: false to allow same delegate names in different camps (if needed)
                    store.createIndex('name', 'name', { unique: false });
                }
                // Camps store (New in V8)
                if (!db.objectStoreNames.contains('camps')) {
                    const store = db.createObjectStore('camps', { keyPath: 'camp_id' });
                    store.createIndex('name', 'name', { unique: true });
                }

                // MIGRATION FOR V9: Relax constraints
                if (oldVersion < 9) {
                    // Relax family_number constraint
                    if (db.objectStoreNames.contains('families')) {
                        const store = transaction.objectStore('families');
                        if (store.indexNames.contains('family_number')) {
                            store.deleteIndex('family_number');
                        }
                        store.createIndex('family_number', 'family_number', { unique: false });
                    }

                    // Relax delegate name constraint
                    if (db.objectStoreNames.contains('delegates')) {
                        const store = transaction.objectStore('delegates');
                        if (store.indexNames.contains('name')) {
                            store.deleteIndex('name');
                        }
                        store.createIndex('name', 'name', { unique: false });
                    }
                }
            },
            blocked() {
                console.warn('Database open blocked: Close other tabs');
                alert('الرجاء إغلاق التبويبات الأخرى للسماح بتحديث قاعدة البيانات');
            },
            blocking() {
                console.warn('Database blocking: Reloading...');
                dbPromise = null;
                window.location.reload();
            },
            terminated() {
                console.error('Database terminated');
                dbPromise = null;
            }
        });
    }
    return dbPromise;
}

// Generate UUID with fallback
function uuidv4() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ============================================
// FAMILIES - العائلات
// ============================================

export async function getAllFamilies(campId = null) {
    const db = await getDB();
    let families;

    if (campId) {
        families = await db.getAllFromIndex('families', 'camp_id', campId);
    } else {
        families = await db.getAll('families');
    }

    // Sort by family_number
    families.sort((a, b) => {
        return (parseInt(a.family_number) || 0) - (parseInt(b.family_number) || 0);
    });

    return families;
}

export async function getFamily(familyId) {
    const db = await getDB();
    return await db.get('families', familyId);
}

export async function createFamily(familyData) {
    const db = await getDB();
    const newFamily = {
        family_id: familyData.family_id || uuidv4(),
        ...familyData,
        // Make sure camp_id is stored. If undefined, it might be null/missing which is fine for global visibility if logic dictates, but we aim for camp-specific.
        camp_id: familyData.camp_id || 'default',
        is_departed: familyData.is_departed || false,
        created_at: new Date().toISOString()
    };

    await db.put('families', newFamily);
    return newFamily;
}

export async function updateFamily(familyId, updates) {
    const db = await getDB();
    const tx = db.transaction('families', 'readwrite');
    const store = tx.objectStore('families');

    const family = await store.get(familyId);
    if (!family) throw new Error('Family not found');

    const updatedFamily = { ...family, ...updates };
    await store.put(updatedFamily);
    await tx.done;

    return updatedFamily;
}

export async function deleteFamily(familyId) {
    const db = await getDB();

    // Get all individuals for this family to verify they exist before deletion
    const allIndividuals = await db.getAllFromIndex('individuals', 'family_id', familyId);

    const tx = db.transaction(['families', 'individuals', 'health_records'], 'readwrite');

    // Delete family
    await tx.objectStore('families').delete(familyId);

    // Delete members and their health records
    const healthStore = tx.objectStore('health_records');
    const indStore = tx.objectStore('individuals');

    for (const member of allIndividuals) {
        await healthStore.delete(member.individual_id);
        await indStore.delete(member.individual_id);
    }

    await tx.done;
}

// ============================================
// INDIVIDUALS - الأفراد
// ============================================

export async function getFamilyMembers(familyId) {
    const db = await getDB();

    // Use getAllFromIndex for better performance than opening a cursor manually
    const members = await db.getAllFromIndex('individuals', 'family_id', familyId);

    // Fetch health records
    const membersWithHealth = await Promise.all(members.map(async (member) => {
        const health = await db.get('health_records', member.individual_id);
        return {
            ...member,
            health_records: health || null,
            is_pregnant: health?.is_pregnant || false,
            is_nursing: health?.is_nursing || false,
            notes: health?.notes || ''
        };
    }));

    return membersWithHealth;
}

export async function getAllIndividuals(campId = null) {
    const db = await getDB();

    // Get all content
    // To minimize transactions, we get ALL items from each store
    // Optimization: If campId is provided, we should filter families first.

    let families;
    if (campId) {
        families = await db.getAllFromIndex('families', 'camp_id', campId);
    } else {
        families = await db.getAll('families');
    }

    const individuals = await db.getAll('individuals');
    const healthRecords = await db.getAll('health_records');

    // Create Maps for O(1) lookup
    const familiesMap = new Map(families.map(f => [f.family_id, f]));
    const healthMap = new Map(healthRecords.map(h => [h.individual_id, h]));

    // Filter individuals who belong to the relevant families
    const results = [];

    for (const ind of individuals) {
        const family = familiesMap.get(ind.family_id);
        if (familiesMap.has(ind.family_id)) {
            const health = healthMap.get(ind.individual_id);
            results.push({
                ...ind,
                families: family,
                health_records: health,
                family_number: family?.family_number,
                family_contact: family?.contact,
                family_address: family?.address,
                is_pregnant: health?.is_pregnant || false,
                is_nursing: health?.is_nursing || false,
                health_notes: health?.notes || ''
            });
        }
    }

    return results;
}

export async function createIndividual(individualData) {
    const db = await getDB();
    const newIndividual = {
        individual_id: individualData.individual_id || uuidv4(),
        family_id: individualData.family_id,
        name: individualData.name,
        nid: individualData.nid || null,
        dob: individualData.dob || null,
        gender: individualData.gender,
        role: individualData.role,
        role_description: individualData.role_description || null, // وصف لـ "أخرى"
        deceased_husband_name: individualData.deceased_husband_name || null, // اسم الزوج المتوفي للأرملة
        husband_death_date: individualData.husband_death_date || null, // تاريخ وفاة الزوج
        created_at: new Date().toISOString()
    };

    const tx = db.transaction(['individuals', 'health_records'], 'readwrite');
    await tx.objectStore('individuals').put(newIndividual);

    // Create health record if health data exists or just to initialize
    if (individualData.is_pregnant || individualData.is_nursing || individualData.notes) {
        const healthData = {
            individual_id: newIndividual.individual_id,
            is_pregnant: individualData.is_pregnant || false,
            is_nursing: individualData.is_nursing || false,
            notes: individualData.notes || null
        };
        await tx.objectStore('health_records').put(healthData);
    }

    await tx.done;
    return newIndividual;
}

export async function updateIndividual(individualId, updates) {
    const db = await getDB();
    const tx = db.transaction(['individuals', 'health_records'], 'readwrite');

    const indStore = tx.objectStore('individuals');
    const ind = await indStore.get(individualId);

    if (!ind) throw new Error('Individual not found');

    const { is_pregnant, is_nursing, notes, ...indFields } = updates;
    const updatedInd = { ...ind, ...indFields };

    await indStore.put(updatedInd);

    // Update health record
    if (is_pregnant !== undefined || is_nursing !== undefined || notes !== undefined) {
        const healthStore = tx.objectStore('health_records');
        let health = await healthStore.get(individualId);

        if (!health) {
            health = { individual_id: individualId };
        }

        if (is_pregnant !== undefined) health.is_pregnant = is_pregnant;
        if (is_nursing !== undefined) health.is_nursing = is_nursing;
        if (notes !== undefined) health.notes = notes;

        await healthStore.put(health);
    }

    await tx.done;
    return updatedInd;
}

export async function deleteIndividual(individualId) {
    const db = await getDB();
    const tx = db.transaction(['individuals', 'health_records'], 'readwrite');
    await tx.objectStore('individuals').delete(individualId);
    await tx.objectStore('health_records').delete(individualId);
    await tx.done;
}

export async function deleteFamilyMembers(familyId) {
    const db = await getDB();
    const members = await db.getAllFromIndex('individuals', 'family_id', familyId);

    if (members.length === 0) return;

    const tx = db.transaction(['individuals', 'health_records'], 'readwrite');
    const indStore = tx.objectStore('individuals');
    const healthStore = tx.objectStore('health_records');

    for (const member of members) {
        await indStore.delete(member.individual_id);
        await healthStore.delete(member.individual_id);
    }
    await tx.done;
}

// ============================================
// AID DELIVERIES - تسليم المساعدات
// ============================================

export async function getFullFamilyByHeadNid(nid) {
    const db = await getDB();
    // Use index for O(1) if precise match
    // Note: getFromIndex only returns the *first* match, which is fine for NID
    const individual = await db.getFromIndex('individuals', 'nid', nid);

    if (!individual) return null;

    // Check if they are a head of family or relevant role? 
    // The user said "Head of Family ID", so we might want to check roles.
    // However, the request implies the file contains "Head of Family ID" which maps to the family.
    // So if the NID exists, we assume it's the correct person.

    const family = await db.get('families', individual.family_id);
    return family;
}

export async function getFamilyAid(familyId) {
    const db = await getDB();
    return await db.getAllFromIndex('aid_deliveries', 'family_id', familyId);
}

export async function addFamilyAid(aidData) {
    const db = await getDB();
    const newAid = {
        delivery_id: aidData.delivery_id || uuidv4(),
        ...aidData,
        created_at: new Date().toISOString()
    };
    await db.put('aid_deliveries', newAid);
    return newAid;
}

export async function deleteFamilyAid(deliveryId) {
    const db = await getDB();
    await db.delete('aid_deliveries', deliveryId);
}

export async function deleteAllAidDeliveries() {
    const db = await getDB();
    const tx = db.transaction('aid_deliveries', 'readwrite');
    await tx.objectStore('aid_deliveries').clear();
    await tx.done;
}

export async function getAllAidDeliveries() {
    const db = await getDB();
    return db.getAll('aid_deliveries');
}

// ============================================
// HEALTH RECORDS - السجلات الصحية
// ============================================

export async function upsertHealthRecord(healthData) {
    const db = await getDB();
    await db.put('health_records', healthData);
    return healthData;
}

// ============================================
// BATCH OPERATIONS - عمليات الدفعة
// ============================================

export async function saveFamilyWithMembers(familyData, members) {
    // We run this sequentially using existing helpers to ensure consistency
    let family;
    if (familyData.family_id) {
        // Update
        const existing = await getFamily(familyData.family_id);
        if (existing) {
            family = await updateFamily(familyData.family_id, {
                family_number: familyData.family_number,
                address: familyData.address,
                contact: familyData.contact,
                alternative_mobile: familyData.alternative_mobile,
                housing_status: familyData.housing_status,
                family_needs: familyData.family_needs,
                delegate: familyData.delegate,
                camp_id: familyData.camp_id || existing.camp_id || 'default', // Preserve or set
                is_departed: familyData.is_departed !== undefined ? familyData.is_departed : existing.is_departed
            });
        } else {
            family = await createFamily(familyData);
        }
    } else {
        // Default to default camp if not specified
        if (!familyData.camp_id) familyData.camp_id = 'default';
        family = await createFamily(familyData);
    }

    // Delete existing members
    await deleteFamilyMembers(family.family_id);

    // Create new members
    for (const member of members) {
        await createIndividual({
            ...member,
            family_id: family.family_id
        });
    }

    return family;
}

export async function batchImportFamilies(familiesData, campId = 'default') {
    return batchImportDataFast(familiesData, null, campId);
}

// Optimized Batch Import (One Transaction per Batch)
export async function batchImportDataFast(familiesData, progressCallback, campId = 'default') {
    const db = await getDB();
    const results = [];

    // Process in batches of 50
    const BATCH_SIZE = 50;

    for (let i = 0; i < familiesData.length; i += BATCH_SIZE) {
        const batch = familiesData.slice(i, i + BATCH_SIZE);

        try {
            const tx = db.transaction(['families', 'individuals', 'health_records'], 'readwrite');
            const famStore = tx.objectStore('families');
            const indStore = tx.objectStore('individuals');
            const healthStore = tx.objectStore('health_records');

            for (const f of batch) {
                try {
                    // Create Family
                    const familyId = uuidv4();
                    const newFamily = {
                        family_id: familyId,
                        family_number: f.family_number,
                        address: f.address,
                        contact: f.contact,
                        alternative_mobile: f.alternative_mobile || null,
                        housing_status: f.housing_status || null,
                        family_needs: f.family_needs || null,
                        camp_id: campId, // Associate with current camp
                        is_departed: false,
                        created_at: new Date().toISOString()
                    };
                    await famStore.put(newFamily);

                    // Members
                    if (f.members && f.members.length > 0) {
                        for (const m of f.members) {
                            const indId = uuidv4();
                            const newInd = {
                                individual_id: indId,
                                family_id: familyId,
                                name: m.name,
                                nid: m.nid || null,
                                dob: m.dob || null,
                                gender: m.gender,
                                role: m.role,
                                created_at: new Date().toISOString()
                            };
                            await indStore.put(newInd);

                            if (m.is_pregnant || m.is_nursing || m.notes) {
                                await healthStore.put({
                                    individual_id: indId,
                                    is_pregnant: m.is_pregnant || false,
                                    is_nursing: m.is_nursing || false,
                                    notes: m.notes || null
                                });
                            }
                        }
                    }
                    results.push({ success: true, family_id: familyId, family_number: f.family_number });
                } catch (err) {
                    console.error("Error inserting family in batch", err);
                    throw err; // Fail the batch
                }
            }

            await tx.done;

            if (progressCallback) {
                progressCallback(Math.min(i + BATCH_SIZE, familiesData.length), familiesData.length);
            }

        } catch (error) {
            // Mark this batch as failed
            batch.forEach(f => {
                results.push({
                    success: false,
                    error: error.message,
                    family_number: f.family_number
                });
            });
        }
    }

    return results;
}

// ============================================
// USERS & AUTH - المستخدمين والصلاحيات
// ============================================

export async function registerUser(userData) {
    const db = await getDB();

    // Check if email exists
    const existing = await db.getFromIndex('users', 'email', userData.email);
    if (existing) {
        throw new Error('البريد الإلكتروني مسجل مسبقاً');
    }

    const newUser = {
        user_id: uuidv4(),
        email: userData.email,
        password: userData.password, // Plain text for local simplicity as requested implies; in prod use hash
        username: userData.username || userData.email.split('@')[0],
        role: userData.role || 'user', // 'admin' or 'user'
        created_at: new Date().toISOString()
    };

    await db.put('users', newUser);
    return newUser;
}

export async function authenticateUser(email, password) {
    const db = await getDB();
    const user = await db.getFromIndex('users', 'email', email);

    if (!user || user.password !== password) {
        throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    return user;
}

// ============================================
// NOTIFICATIONS - الإشعارات
// ============================================

export async function createNotification(notificationData) {
    const db = await getDB();
    const notification = {
        notification_id: uuidv4(),
        type: notificationData.type || 'info', // 'new_entry', 'alert', 'info'
        message: notificationData.message,
        user_name: notificationData.user_name || 'System',
        created_at: new Date().toISOString(),
        is_read: 0 // 0 = unread, 1 = read
    };

    await db.put('notifications', notification);
    return notification;
}

export async function getUnreadNotifications() {
    const db = await getDB();
    // getAllFromIndex might not support filter easily, so we get all and filter or use cursor
    // For local small app, fetching all active notifications is fine.
    const all = await db.getAllFromIndex('notifications', 'created_at');
    // Filter for unread and sort descending
    return all.filter(n => n.is_read === 0).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function markNotificationAsRead(id) {
    const db = await getDB();
    const notif = await db.get('notifications', id);
    if (notif) {
        notif.is_read = 1;
        await db.put('notifications', notif);
    }
}

// ============================================
// ============================================
// DELEGATES - المفوضين
// ============================================

export async function getDelegates(campId) {
    const db = await getDB();
    const delegates = await db.getAll('delegates');
    if (campId) {
        return delegates.filter(d => d.camp_id === campId);
    }
    return delegates;
}

export async function addDelegate(delegateData) {
    const db = await getDB();
    let name;
    let data = {};

    if (typeof delegateData === 'string') {
        name = delegateData;
        data = { name };
    } else {
        name = delegateData.name;
        data = delegateData;
    }

    // Check for existing delegate with same name IN THE SAME CAMP
    const allDelegates = await db.getAll('delegates');
    const existing = allDelegates.find(d => d.name === name && d.camp_id === data.camp_id);

    if (existing) {
        throw new Error('المفوض موجود بالفعل في هذا المخيم');
    }

    const delegate = {
        delegate_id: uuidv4(),
        ...data,
        created_at: new Date().toISOString()
    };
    await db.add('delegates', delegate);
    return delegate;
}

export async function updateDelegate(id, updates) {
    const db = await getDB();
    const delegate = await db.get('delegates', id);
    if (!delegate) throw new Error('Delegate not found');

    const updated = { ...delegate, ...updates };
    await db.put('delegates', updated);
    return updated;
}

export async function deleteDelegate(id) {
    const db = await getDB();
    await db.delete('delegates', id);
}

export async function assignDelegatesToCamp(targetCampId) {
    const db = await getDB();

    // Verify Target Camp exists
    const targetCamp = await db.get('camps', targetCampId);
    if (!targetCamp) {
        throw new Error('المخيم المحدد غير موجود');
    }

    const delegates = await db.getAll('delegates');
    let count = 0;
    for (const delegate of delegates) {
        if (!delegate.camp_id) {
            delegate.camp_id = targetCamp.camp_id;
            await db.put('delegates', delegate);
            count++;
        }
    }
    return count;
}

export async function getUnassignedDelegatesCount() {
    const db = await getDB();
    const delegates = await db.getAll('delegates');
    return delegates.filter(d => !d.camp_id).length;
}

export async function moveDelegatesByName(sourceCampName, targetCampName) {
    const db = await getDB();
    const camps = await db.getAll('camps');

    // Fuzzy matching or exact? Let's try exact first, then fuzzy if needed.
    // The user was specific about names.
    const source = camps.find(c => c.name.trim() === sourceCampName.trim());
    const target = camps.find(c => c.name.trim() === targetCampName.trim());

    if (!source) throw new Error(`المخيم المصدر "${sourceCampName}" غير موجود`);
    if (!target) throw new Error(`المخيم الهدف "${targetCampName}" غير موجود`);

    const delegates = await db.getAll('delegates');
    let count = 0;

    for (const d of delegates) {
        if (d.camp_id === source.camp_id) {
            d.camp_id = target.camp_id;
            await db.put('delegates', d);
            count++;
        }
    }

    // Optional: Delete the source camp if it's empty now? Maybe safer not to automatically.

    return count;
}

// ============================================
// CAMPS - المخيمات
// ============================================

export async function getCamps() {
    const db = await getDB();
    return db.getAll('camps');
}

export async function addCamp(campData) {
    const db = await getDB();
    let name;
    let data = {};

    if (typeof campData === 'string') {
        name = campData;
        data = { name };
    } else {
        name = campData.name;
        data = campData;
    }

    const existing = await db.getFromIndex('camps', 'name', name);
    if (existing) {
        throw new Error('المخيم موجود بالفعل');
    }

    const camp = {
        camp_id: uuidv4(),
        ...data,
        is_default: false,
        created_at: new Date().toISOString()
    };
    await db.add('camps', camp);
    return camp;
}

export async function updateCamp(id, updates) {
    const db = await getDB();
    const camp = await db.get('camps', id);
    if (!camp) throw new Error('Camp not found');

    const updated = { ...camp, ...updates };
    await db.put('camps', updated);
    return updated;
}

export async function deleteCamp(id) {
    const db = await getDB();
    await db.delete('camps', id);
}

export async function assignCampToOrphans(targetCampId) {
    const db = await getDB();
    const tx = db.transaction('families', 'readwrite');
    const store = tx.objectStore('families');

    // Get all families
    const families = await store.getAll();
    let count = 0;

    for (const fam of families) {
        if (!fam.camp_id) {
            fam.camp_id = targetCampId;
            await store.put(fam);
            count++;
        }
    }

    await tx.done;
    return count;
}

// ============================================
// LEGACY COMPATIBILITY
// ============================================

export const initDBFunc = getDB; // Alias if needed
