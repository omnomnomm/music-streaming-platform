import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { signUp as apiSignUp } from '../services/api';

const AuthContext = createContext(null);

// Loads the public.users profile row for a Supabase Auth session (by auth_id),
// and retries briefly — right after sign-up, the row may not have committed yet.
async function loadProfile(authUser) {
    if (!authUser) return null;
    for (let attempt = 0; attempt < 3; attempt++) {
        const { data } = await supabase.from('users').select('*').eq('auth_id', authUser.id).single();
        if (data) return data;
        await new Promise(r => setTimeout(r, 300));
    }
    return null;
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        supabase.auth.getSession().then(async ({ data: { session } }) => {
            const profile = await loadProfile(session?.user);
            if (active) {
                setUser(profile);
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const profile = await loadProfile(session?.user);
            if (active) setUser(profile);
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, []);

    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { success: false, error: error.message };
        const profile = await loadProfile(data.user);
        if (!profile) return { success: false, error: 'Signed in, but no matching profile was found.' };
        setUser(profile);
        return { success: true, user: profile };
    };

    const signUp = async (fields) => {
        const result = await apiSignUp(fields);
        if (result.success) setUser(result.user);
        return result;
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, signUp, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
