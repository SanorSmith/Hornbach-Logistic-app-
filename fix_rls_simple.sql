-- Simple RLS fix - allow authenticated users to read all users
-- This will resolve the 500 error

DROP POLICY IF EXISTS "Authenticated users can view all users" ON public.users;

CREATE POLICY "Authenticated users can view all users"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);
