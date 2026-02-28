-- Debug script to check point IDs vs assignment IDs
-- Run this in Supabase SQL Editor

-- Show all red points with their IDs
SELECT 
  point_number,
  id as point_id,
  status
FROM public.red_points 
ORDER BY point_number;

-- Show all assignments with their point IDs
SELECT 
  rp.point_number,
  dpa.point_id as assignment_point_id,
  dpa.department_number
FROM public.department_point_assignments dpa
JOIN public.red_points rp ON dpa.point_id = rp.id
ORDER BY rp.point_number;
