-- Aggressive RLS fix for QR scanner
-- Run this in Supabase SQL Editor

-- Disable RLS temporarily for red_points to test
ALTER TABLE public.red_points DISABLE ROW LEVEL SECURITY;

-- Test query without RLS
SELECT 
  rp.*,
  d.name as department_name,
  u.full_name as current_user_name
FROM public.red_points rp
LEFT JOIN public.departments d ON rp.department_id = d.id
LEFT JOIN public.users u ON rp.current_user_id = u.id
WHERE rp.qr_code = 'RP-002'
LIMIT 1;

-- If this works, re-enable RLS with very permissive policies
ALTER TABLE public.red_points ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow authenticated users to view red points" ON public.red_points;
DROP POLICY IF EXISTS "Allow linefeeders to update red points" ON public.red_points;
DROP POLICY IF EXISTS "Allow admins and team leaders to manage red points" ON public.red_points;

-- Create very permissive policies
CREATE POLICY "Allow all authenticated users to read red points"
  ON public.red_points FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to update red points"
  ON public.red_points FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to insert red points"
  ON public.red_points FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Also fix departments and users for joins
ALTER TABLE public.departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to view departments" ON public.departments;
DROP POLICY IF EXISTS "Allow admins and team leaders to manage departments" ON public.departments;

CREATE POLICY "Allow all authenticated users to read departments"
  ON public.departments FOR SELECT
  USING (auth.role() = 'authenticated');

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to view users" ON public.users;
DROP POLICY IF EXISTS "Allow admins and team leaders to manage users" ON public.users;

CREATE POLICY "Allow all authenticated users to read users"
  ON public.users FOR SELECT
  USING (auth.role() = 'authenticated');

-- Test the query again with RLS enabled
SELECT 
  rp.*,
  d.name as department_name,
  u.full_name as current_user_name
FROM public.red_points rp
LEFT JOIN public.departments d ON rp.department_id = d.id
LEFT JOIN public.users u ON rp.current_user_id = u.id
WHERE rp.qr_code = 'RP-002'
LIMIT 1;
