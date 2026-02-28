-- Fix duplicate assignments for point #1
-- Remove duplicate assignments and keep only one per point

-- Delete all assignments for point #1
DELETE FROM public.department_point_assignments 
WHERE point_id = '0166e7b6-4cd7-4c12-a1fe-e8e0ded99607';

-- Re-insert single assignment for point #1
INSERT INTO public.department_point_assignments (
  department_id,
  point_id, 
  department_number
) VALUES (
  (SELECT id FROM public.departments WHERE name = 'GM' LIMIT 1),
  '0166e7b6-4cd7-4c12-a1fe-e8e0ded99607',
  'V1'
);

-- Verify the result
SELECT 
  rp.point_number,
  dpa.point_id,
  dpa.department_number
FROM public.department_point_assignments dpa
JOIN public.red_points rp ON dpa.point_id = rp.id
ORDER BY rp.point_number;
