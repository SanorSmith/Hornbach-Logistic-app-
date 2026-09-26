import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

export interface DepartmentOption {
  id: string;
  name: string;
}

/** The facility's active avdelningar, sorted by name (for pickers and filters). */
export function useDepartments() {
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('departments')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Error fetching departments:', error);
          toast.error('Fel vid hämtning av avdelningar');
          return;
        }
        setDepartments((data as DepartmentOption[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return departments;
}
