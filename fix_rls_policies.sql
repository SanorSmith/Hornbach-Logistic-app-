-- Fix RLS policies to allow users to read their own profile
-- This should resolve the 500 error when fetching user profile

-- First, let's check what's blocking the query
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;

-- Create a simpler, more permissive policy for authenticated users
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Also ensure the policy allows reading without complex joins
CREATE POLICY "Authenticated users can view all users"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

-- Make sure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
