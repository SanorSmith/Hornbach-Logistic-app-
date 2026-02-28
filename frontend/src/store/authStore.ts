import { create } from 'zustand';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { User } from '../types';

interface AuthState {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  isLoading: boolean;
  setUser: (user: User | null, supabaseUser: SupabaseUser | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  supabaseUser: null,
  isLoading: true,
  setUser: (user, supabaseUser) => set({ user, supabaseUser, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => set({ user: null, supabaseUser: null }),
}));
