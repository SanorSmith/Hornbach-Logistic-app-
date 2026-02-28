-- Grant SELECT permissions to anon role for department_point_assignments
GRANT SELECT ON public.department_point_assignments TO anon;
GRANT SELECT ON public.department_point_assignments TO authenticated;

-- Verify the grants
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name='department_point_assignments';
