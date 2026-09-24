-- Fix RLS policies to allow all authenticated users to read data
-- This will resolve the 500 errors

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins and Team Leaders can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins and Team Leaders can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins and Team Leaders can update users" ON public.users;
DROP POLICY IF EXISTS "Everyone can view active departments" ON public.departments;
DROP POLICY IF EXISTS "Admins and Team Leaders can manage departments" ON public.departments;
DROP POLICY IF EXISTS "Everyone can view active red points" ON public.red_points;
DROP POLICY IF EXISTS "Linefeeders can update red point status" ON public.red_points;
DROP POLICY IF EXISTS "Department users can update their points" ON public.red_points;
DROP POLICY IF EXISTS "Admins and Team Leaders can manage red points" ON public.red_points;
DROP POLICY IF EXISTS "Everyone can view status history" ON public.status_history;
DROP POLICY IF EXISTS "Authenticated users can insert history" ON public.status_history;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Create simple permissive policies for reading
CREATE POLICY "Allow authenticated users to read users" ON public.users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to read departments" ON public.departments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to read red points" ON public.red_points FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to read status history" ON public.status_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to read notifications" ON public.notifications FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert/update data
CREATE POLICY "Allow authenticated users to insert users" ON public.users FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to update users" ON public.users FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert departments" ON public.departments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to update departments" ON public.departments FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to update red points" ON public.red_points FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert status history" ON public.status_history FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert notifications" ON public.notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
