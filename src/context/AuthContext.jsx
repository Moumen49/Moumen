import React, { createContext, useContext, useState, useEffect } from 'react';
import { authenticateUser, registerUser, emailToUsername } from '../lib/db';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check local storage for session as fallback/fast-load
        const storedUser = localStorage.getItem('local_user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse user session", e);
                localStorage.removeItem('local_user');
            }
        }

        // Check Supabase session for truth
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
                console.warn("Session check error:", error.message);
                if (error.message.includes("Invalid Refresh Token") || error.message.includes("Refresh Token Not Found")) {
                    console.log("Forcing logout due to invalid token");
                    logout();
                }
            } else if (!session) {
                // Session expired or invalid on server
                // Only clear if we really want to enforce online check. 
                // For now, if we have local_user, we keep it, BUT valid refresh token error implies we should probably clear.
                // If strictly "no session", it might just mean not logged in.
            }
            setLoading(false);
        }).catch(err => {
            console.error("Unexpected session error:", err);
            setLoading(false);
        });

        // Listen for auth changes (e.g. token refresh, sign out in another tab)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
                setUser(null);
                localStorage.removeItem('local_user');
            } else if (event === 'SIGNED_IN' && session) {
                // Optional: Update user state from session
                const metadata = session.user.user_metadata;

                // Fetch assigned_camps if supervisor
                let assigned_camps = [];
                if (metadata?.role === 'supervisor') {
                    const { data: perms } = await supabase
                        .from('user_permissions')
                        .select('assigned_camps')
                        .eq('user_id', session.user.id)
                        .single();

                    assigned_camps = perms?.assigned_camps || [];
                }

                const userData = {
                    user_id: session.user.id,
                    email: emailToUsername(session.user.email),
                    username: metadata?.username,
                    fullName: metadata?.fullName, // Keep fullName separate
                    role: metadata?.role,
                    camp_id: metadata?.camp_id, // Capture assigned camp
                    assigned_camps: assigned_camps
                };
                setUser(userData);
                localStorage.setItem('local_user', JSON.stringify(userData));
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const login = async (email, password) => {
        try {
            const authUser = await authenticateUser(email, password);
            authUser.email = emailToUsername(authUser.email); // Clean for UI
            // State update handled by onAuthStateChange ideally, but manual here ensures fast UI response
            localStorage.setItem('local_user', JSON.stringify(authUser));
            setUser(authUser);
            return authUser;
        } catch (error) {
            throw error;
        }
    };

    const register = async (email, password, metadata = {}) => {
        try {
            const newUser = await registerUser({
                email,
                password,
                role: metadata.role || 'user',
                username: metadata.username
            });
            newUser.email = emailToUsername(newUser.email); // Clean for UI
            // State update
            localStorage.setItem('local_user', JSON.stringify(newUser));
            setUser(newUser);
            return newUser;
        } catch (error) {
            throw error;
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('local_user');
        localStorage.removeItem('selected_camp_id'); // Clear selected camp on logout
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, register, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
