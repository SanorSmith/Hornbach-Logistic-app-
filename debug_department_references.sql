-- Debug script to check department references
-- Run this in Supabase SQL Editor

-- Check which departments are referenced by red_points
SELECT 
  d.id as department_id,
  d.name as department_name,
  COUNT(rp.id) as points_count
FROM public.departments d
LEFT JOIN public.red_points rp ON d.id = rp.department_id
GROUP BY d.id, d.name
ORDER BY d.name;

-- Check all red_points and their department assignments
SELECT 
  rp.id as point_id,
  rp.point_number,
  rp.department_id,
  d.name as department_name
FROM public.red_points rp
LEFT JOIN public.departments d ON rp.department_id = d.id
ORDER BY rp.point_number;

-- Check department_point_assignments table
SELECT 
  dpa.department_number,
  dpa.point_id,
  rp.point_number,
  d.name as department_name
FROM public.department_point_assignments dpa
JOIN public.red_points rp ON dpa.point_id = rp.id
JOIN public.departments d ON dpa.department_id = d.id
ORDER BY d.name, dpa.department_number;
