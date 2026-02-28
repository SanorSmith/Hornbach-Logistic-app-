-- Create table for department point assignments
-- This allows each department to have its own numbering system for points

CREATE TABLE IF NOT EXISTS public.department_point_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  point_id UUID NOT NULL REFERENCES public.red_points(id) ON DELETE CASCADE,
  department_number TEXT NOT NULL, -- Department-specific numbering (e.g., "1", "2", "A1", "B2")
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(department_id, point_id), -- Each point can only be assigned to one department once
  UNIQUE(department_id, department_number) -- Each department number must be unique within department
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_department_assignments_department_id ON public.department_point_assignments(department_id);
CREATE INDEX IF NOT EXISTS idx_department_assignments_point_id ON public.department_point_assignments(point_id);

-- Add RLS policies
ALTER TABLE public.department_point_assignments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read assignments
CREATE POLICY "Allow authenticated users to read department assignments" 
ON public.department_point_assignments FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow authenticated users to manage assignments
CREATE POLICY "Allow authenticated users to manage department assignments" 
ON public.department_point_assignments FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
