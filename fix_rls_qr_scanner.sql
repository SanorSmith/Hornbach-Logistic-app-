-- Fix RLS policies for QR scanner functionality
-- Run this in Supabase SQL Editor

-- Drop existing red_points policies that might be causing issues
DROP POLICY IF EXISTS "Everyone can view active red points" ON public.red_points;
DROP POLICY IF EXISTS "Linefeeders can update red point status" ON public.red_points;
DROP POLICY IF EXISTS "Department users can update their points" ON public.red_points;
DROP POLICY IF EXISTS "Admins and Team Leaders can manage red points" ON public.red_points;

-- Create new, more permissive policies for red_points
CREATE POLICY "Allow authenticated users to view red points"
  ON public.red_points FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow linefeeders to update red points"
  ON public.red_points FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND role IN ('LINEFEEDER', 'ADMIN', 'TEAM_LEADER')
    )
  );

CREATE POLICY "Allow admins and team leaders to manage red points"
  ON public.red_points FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND role IN ('ADMIN', 'TEAM_LEADER')
    )
  );

-- Ensure departments have proper policies for joins
DROP POLICY IF EXISTS "Everyone can view active departments" ON public.departments;
DROP POLICY IF EXISTS "Admins and Team Leaders can manage departments" ON public.departments;

CREATE POLICY "Allow authenticated users to view departments"
  ON public.departments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admins and team leaders to manage departments"
  ON public.departments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND role IN ('ADMIN', 'TEAM_LEADER')
    )
  );

-- Ensure users have proper policies for joins
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins and Team Leaders can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins and Team Leaders can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins and Team Leaders can update users" ON public.users;

CREATE POLICY "Allow authenticated users to view users"
  ON public.users FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admins and team leaders to manage users"
  ON public.users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND role IN ('ADMIN', 'TEAM_LEADER')
    )
  );

-- Test the QR scanner query
SELECT 
  rp.*,
  d.*,
  u.id as user_id,
  u.full_name
FROM public.red_points rp
LEFT JOIN public.departments d ON rp.department_id = d.id
LEFT JOIN public.users u ON rp.current_user_id = u.id
WHERE rp.qr_code = 'RP-002'
LIMIT 1;
