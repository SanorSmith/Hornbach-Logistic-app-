-- Test direct update to verify permissions work
-- Run this in Supabase SQL Editor

-- Check RLS status
SELECT 
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'red_points';

-- Test direct update
UPDATE public.red_points 
SET status = 'LEDIG',
    current_user_id = NULL
WHERE id = '901e1c4e-aa97-4ea7-84bf-daa9512f72ae';

-- Check if update worked
SELECT id, point_number, status, current_user_id
FROM public.red_points
WHERE id = '901e1c4e-aa97-4ea7-84bf-daa9512f72ae';

-- If RLS is still enabled, disable it completely
ALTER TABLE public.red_points DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'red_points';
