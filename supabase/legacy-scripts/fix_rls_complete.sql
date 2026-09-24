-- Complete RLS fix to allow frontend to read all data
-- Run this in Supabase SQL Editor

-- Check current RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('red_points', 'departments', 'users');

-- TEMPORARILY DISABLE RLS to verify data access
ALTER TABLE public.red_points DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Test if this fixes the frontend
-- After confirming it works, we'll re-enable with proper policies

-- To re-enable later with proper policies:
/*
ALTER TABLE public.red_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Very permissive policies for authenticated users
CREATE POLICY "Allow all for authenticated" ON public.red_points FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.departments FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.users FOR ALL USING (true);
*/
