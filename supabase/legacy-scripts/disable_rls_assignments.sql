-- Disable RLS for department assignments table
-- This will fix the fetch issues

ALTER TABLE public.department_point_assignments DISABLE ROW LEVEL SECURITY;
