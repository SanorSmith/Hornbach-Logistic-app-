import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RedPoint } from '../types';

export interface PointDetails {
  /** The point's name in its department (e.g. "KASSA", "V1"), if assigned. */
  name: string | null;
  departmentName: string | null;
  departmentLocation: string | null;
}

interface DepartmentRow {
  name: string;
  location: string | null;
}

/**
 * Department and display name for one point. The department comes from its
 * assignment in department_point_assignments, falling back to the point's
 * own department_id when it is not assigned.
 */
export function usePointDetails(point: RedPoint): PointDetails {
  const [details, setDetails] = useState<PointDetails>({
    name: null,
    departmentName: point.department?.name ?? null,
    departmentLocation: point.department?.location ?? null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: assignment } = await supabase
        .from('department_point_assignments' as never)
        .select('department_number, department:departments(name, location)')
        .eq('point_id', point.id)
        .maybeSingle();

      const row = assignment as { department_number: string; department: DepartmentRow | null } | null;
      let department = row?.department ?? null;

      if (!department && point.department_id) {
        const { data } = await supabase
          .from('departments')
          .select('name, location')
          .eq('id', point.department_id)
          .maybeSingle();
        department = (data as DepartmentRow | null) ?? null;
      }

      if (!cancelled) {
        setDetails({
          name: row?.department_number ?? null,
          departmentName: department?.name ?? null,
          departmentLocation: department?.location ?? null,
        });
      }
    })().catch((error) => console.error('Error loading point details:', error));

    return () => {
      cancelled = true;
    };
  }, [point.id, point.department_id]);

  return details;
}
