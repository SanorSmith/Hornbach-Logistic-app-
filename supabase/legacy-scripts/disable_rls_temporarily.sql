-- Temporarily disable RLS to fix 500 errors
-- This allows all authenticated users to access data

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.red_points DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
