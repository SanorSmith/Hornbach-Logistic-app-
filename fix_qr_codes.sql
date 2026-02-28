-- Fix QR codes for all red points
-- Run this in Supabase SQL Editor

-- Update all red points to have proper QR codes
UPDATE public.red_points 
SET qr_code = 'RP-' || LPAD(point_number::text, 3, '0')
WHERE qr_code IS NULL OR qr_code = '';

-- Verify the QR codes were set correctly
SELECT 
  id,
  point_number,
  qr_code,
  status,
  department_id
FROM public.red_points 
ORDER BY point_number;

-- Check if any points still don't have QR codes
SELECT COUNT(*) as points_without_qr
FROM public.red_points 
WHERE qr_code IS NULL OR qr_code = '';
