import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export function useAuth() {
  const { user, supabaseUser, setUser, setLoading, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await fetchUserProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        logout();
        navigate('/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('Fetching user profile for:', userId);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('User query result:', { data, error });

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }

      if (!data) {
        throw new Error('User not found in database');
      }

      const { data: { user: supabaseUser } } = await supabase.auth.getUser();

      setUser(data, supabaseUser || null);
      setLoading(false);

      // @ts-ignore - Supabase type inference issue
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId);
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast.error('Fel vid hämtning av användarprofil: ' + (error.message || 'Unknown error'));
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        await fetchUserProfile(data.user.id);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Inloggning misslyckades');
      return false;
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      logout();
      navigate('/login');
    } catch (error: any) {
      console.error('Logout error:', error);
      toast.error('Fel vid utloggning');
    }
  };

  return {
    user,
    supabaseUser,
    isLoading: useAuthStore((state) => state.isLoading),
    signIn,
    signOut,
  };
}
