-- Fix UPDATE policy for red_points
-- Run this in Supabase SQL Editor

-- Check current policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'red_points'
ORDER BY policyname;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all authenticated users to read red points" ON public.red_points;
DROP POLICY IF EXISTS "Allow all authenticated users to update red points" ON public.red_points;
DROP POLICY IF EXISTS "Allow all authenticated users to insert red points" ON public.red_points;

-- Create comprehensive policies
CREATE POLICY "Allow authenticated read" 
  ON public.red_points 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow authenticated update" 
  ON public.red_points 
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated insert" 
  ON public.red_points 
  FOR INSERT 
  WITH CHECK (true);

-- Verify policies were created
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'red_points'
ORDER BY policyname;

-- Test update query
UPDATE public.red_points 
SET status = 'LEDIG'
WHERE id = (SELECT id FROM public.red_points LIMIT 1);

SELECT 'Update test successful' as result;
