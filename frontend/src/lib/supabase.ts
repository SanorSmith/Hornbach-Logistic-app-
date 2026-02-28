import { createClient } from '@supabase/supabase-js';
import { Database } from '../types';

// Use environment variables with fallback for development
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tgrgqulnmwgcowlrrkfv.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncmdxdWxubXdnY293bHJya2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMjkyMzUsImV4cCI6MjA4NzgwNTIzNX0.ZSEz2OD0qyui0vGqd92Wrn8EB1VIMi8FuBDWDIqqLV4';

console.log('Supabase initialized with URL:', supabaseUrl);

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
