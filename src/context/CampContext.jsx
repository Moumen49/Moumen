
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCamps } from '../lib/db';
import { useAuth } from './AuthContext';

const CampContext = createContext();

export function useCamp() {
    return useContext(CampContext);
}

export function CampProvider({ children }) {
    const [selectedCamp, setSelectedCamp] = useState(null);
    const [camps, setCamps] = useState([]);
    const [loading, setLoading] = useState(true);

    // Need user and loading status from AuthContext
    const { user, loading: authLoading } = useAuth();

    // Initial Load & Auth Change Handling
    useEffect(() => {
        if (authLoading) return; // Wait for auth to initialize

        if (user === null) {
            // User is confirmed logged out: Clear all camp data
            setSelectedCamp(null);
            setCamps([]);
            localStorage.removeItem('selected_camp_id');
            setLoading(false);
        } else if (user) {
            // User logged in: Load camps
            loadCamps();
        }
    }, [user, authLoading]);

    const loadCamps = async () => {
        try {
            let list = [];

            // 1. Try fetching from DB if online
            try {
                if (navigator.onLine) {
                    list = await getCamps();
                    // Cache the fresh list
                    if (list.length > 0) {
                        localStorage.setItem('cached_camps', JSON.stringify(list));
                    }
                } else {
                    throw new Error('Offline');
                }
            } catch (err) {
                console.log("Fetching camps failed (offline/error), attempting to load cache...", err);
                // 2. Fallback to cache
                const cached = localStorage.getItem('cached_camps');
                if (cached) {
                    list = JSON.parse(cached);
                }
            }

            // RESTRICTION LOGIC:
            // 1. Manager (old role): sees only their assigned camp_id
            if (user && user.camp_id && user.role === 'manager') {
                list = list.filter(c => c.camp_id === user.camp_id);
            }
            // 2. Supervisor (new role): sees only camps in their assigned_camps array
            else if (user && user.role === 'supervisor' && user.assigned_camps) {
                const allowedCampIds = user.assigned_camps || [];
                list = list.filter(c => allowedCampIds.includes(c.camp_id));
            }
            // 3. Admin/System Admin: sees all camps (no filter)

            setCamps(list);

            // Auto-select logic
            // First, check if we have a forcefully selected camp in localStorage (user preference)
            const storedCampId = localStorage.getItem('selected_camp_id');

            if (user && user.camp_id && user.role === 'manager') {
                // Restricted Manager: MUST use assigned camp
                const myCamp = list.find(c => c.camp_id === user.camp_id);
                if (myCamp) {
                    setSelectedCamp(myCamp);
                    localStorage.setItem('selected_camp_id', myCamp.camp_id);
                }
            } else if (user && user.role === 'supervisor' && user.assigned_camps) {
                // Supervisor: can switch between assigned camps
                if (storedCampId) {
                    const found = list.find(c => c.camp_id === storedCampId);
                    if (found) {
                        setSelectedCamp(found);
                    } else if (list.length > 0) {
                        // If stored ID not in allowed list, default to first allowed camp
                        setSelectedCamp(list[0]);
                        localStorage.setItem('selected_camp_id', list[0].camp_id);
                    }
                } else if (list.length === 1) {
                    setSelectedCamp(list[0]);
                    localStorage.setItem('selected_camp_id', list[0].camp_id);
                } else if (list.length > 1) {
                    // Multiple camps: wait for user to select
                    // Or auto-select first
                    setSelectedCamp(list[0]);
                    localStorage.setItem('selected_camp_id', list[0].camp_id);
                }
            } else {
                // Admin User: Restore previous choice or default
                if (storedCampId) {
                    const found = list.find(c => c.camp_id === storedCampId);
                    if (found) {
                        setSelectedCamp(found);
                    } else if (list.length > 0) {
                        // If stored ID invalid, maybe fall back to first? 
                        // Or keep null to force selection.
                        if (list.length === 1) {
                            setSelectedCamp(list[0]);
                            localStorage.setItem('selected_camp_id', list[0].camp_id);
                        }
                    }
                } else if (list.length === 1) {
                    setSelectedCamp(list[0]);
                    localStorage.setItem('selected_camp_id', list[0].camp_id);
                }
            }

        } catch (error) {
            console.error("Failed to load camps", error);
        } finally {
            setLoading(false);
        }
    };

    const changeCamp = (camp) => {
        setSelectedCamp(camp);
        if (camp) {
            localStorage.setItem('selected_camp_id', camp.camp_id);
        } else {
            localStorage.removeItem('selected_camp_id');
        }
    };

    const refreshCamps = async () => {
        await loadCamps();
    };

    const value = {
        selectedCamp,
        camps,
        loading,
        changeCamp,
        refreshCamps
    };

    return (
        <CampContext.Provider value={value}>
            {children}
        </CampContext.Provider>
    );
}
