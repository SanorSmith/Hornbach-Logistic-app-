-- COMPLETE FIX FOR ALL ISSUES

-- 1. Disable RLS completely (fixes 500 errors)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.red_points DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- 2. Create a simple user without UUID dependency
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'LINEFEEDER',
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert some test data
INSERT INTO public.user_profiles (email, full_name, role, is_active) 
SELECT 'admin@logistics.se', 'Admin User', 'ADMIN', true
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE email = 'admin@logistics.se');

INSERT INTO public.user_profiles (email, full_name, role, is_active) 
SELECT 'linefeeder@logistics.se', 'Linefeeder Test', 'LINEFEEDER', true
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE email = 'linefeeder@logistics.se');
