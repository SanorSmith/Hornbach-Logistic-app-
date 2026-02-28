-- Test if the table exists and has data
-- Run this in Supabase SQL Editor

-- Check if table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'department_point_assignments'
) as table_exists;

-- Check if table has data
SELECT COUNT(*) as total_assignments 
FROM public.department_point_assignments;

-- Show all assignments if any
SELECT 
  d.name as department_name,
  rp.point_number as global_number,
  dpa.department_number as department_number
FROM public.department_point_assignments dpa
JOIN public.departments d ON dpa.department_id = d.id
JOIN public.red_points rp ON dpa.point_id = rp.id
ORDER BY d.name, rp.point_number;
