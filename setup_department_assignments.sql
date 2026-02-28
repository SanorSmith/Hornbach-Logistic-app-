-- Run this in Supabase SQL Editor to create the department assignments table

CREATE TABLE IF NOT EXISTS public.department_point_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  point_id UUID NOT NULL REFERENCES public.red_points(id) ON DELETE CASCADE,
  department_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(department_id, point_id),
  UNIQUE(department_id, department_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_department_assignments_department_id ON public.department_point_assignments(department_id);
CREATE INDEX IF NOT EXISTS idx_department_assignments_point_id ON public.department_point_assignments(point_id);

-- RLS policies
ALTER TABLE public.department_point_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read department assignments" 
ON public.department_point_assignments FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage department assignments" 
ON public.department_point_assignments FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
