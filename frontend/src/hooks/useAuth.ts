import { useEffect } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { User, UserRole } from '../types';
import toast from 'react-hot-toast';

// Where each role lands after logging in.
export const HOME_ROUTE: Record<UserRole, string> = {
  ADMIN: '/',
  TEAM_LEADER: '/',
  LINEFEEDER: '/linefeeder',
  MONITOR: '/monitor',
  DEPARTMENT: '/department',
};

async function loadProfile(authUser: SupabaseUser): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
  return (data as User | null) ?? null;
}

/**
 * Keeps the auth store in sync with the Supabase session.
 * Mount exactly once, near the root of the app.
 */
export function useAuthListener() {
  useEffect(() => {
    const { setUser, logout } = useAuthStore.getState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        logout();
        return;
      }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        const authUser = session.user;
        // Defer Supabase calls out of the auth callback to avoid a client deadlock.
        setTimeout(async () => {
          const profile = await loadProfile(authUser);
          setUser(profile, authUser);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);
}

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const supabaseUser = useAuthStore((state) => state.supabaseUser);
  const isLoading = useAuthStore((state) => state.isLoading);

  const signIn = async (email: string, password: string): Promise<User | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      toast.error('Fel e-post eller lösenord');
      return null;
    }

    const profile = await loadProfile(data.user);
    if (!profile) {
      toast.error('Kontot saknar användarprofil. Kontakta administratören.');
      await supabase.auth.signOut();
      return null;
    }
    if (!profile.is_active) {
      toast.error('Kontot är inaktiverat. Kontakta administratören.');
      await supabase.auth.signOut();
      return null;
    }

    useAuthStore.getState().setUser(profile, data.user);

    // Record the login time (allowed by the "update own profile" policy).
    await supabase
      .from('users')
      // @ts-expect-error - stale Database type makes update() params `never`
      .update({ last_login: new Date().toISOString() })
      .eq('id', profile.id);

    return profile;
  };

  /** Re-reads the current user's profile (e.g. after changing password). */
  const refreshProfile = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    const profile = await loadProfile(data.user);
    useAuthStore.getState().setUser(profile, data.user);
    return profile;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    useAuthStore.getState().logout();
  };

  return { user, supabaseUser, isLoading, signIn, signOut, refreshProfile };
}
