import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useDepartmentAssignments() {
  // point id -> department number shown on the point (e.g. "12")
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  // point id -> id of the department the point is assigned to
  const [assignedDepartments, setAssignedDepartments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const fetchAllAssignments = async () => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('department_point_assignments')
        .select('point_id, department_number, department_id');

      if (error) {
        console.error('Supabase error:', error);
        return;
      }

      if (data) {
        const rows = data as { point_id: string; department_number: string; department_id: string }[];
        const assignmentsMap = rows.reduce((acc, assignment) => {
          acc[assignment.point_id] = assignment.department_number;
          return acc;
        }, {} as Record<string, string>);
        setAssignments(assignmentsMap);
        setAssignedDepartments(
          rows.reduce((acc, assignment) => {
            acc[assignment.point_id] = assignment.department_id;
            return acc;
          }, {} as Record<string, string>)
        );
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAssignments();
  }, []);

  return { assignments, assignedDepartments, loading, refetch: fetchAllAssignments };
}
