import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useDepartmentAssignments() {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchAllAssignments = async () => {
    try {
      setLoading(true);
      console.log('Starting to fetch assignments...');
      
      // @ts-ignore - Supabase type inference issue
      const { data, error } = await supabase
        .from('department_point_assignments')
        .select('point_id, department_number');

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Supabase error:', error);
        return;
      }

      if (data) {
        console.log('Raw data from Supabase:', data);
        const assignmentsMap = data.reduce((acc, assignment) => {
          acc[assignment.point_id] = assignment.department_number;
          return acc;
        }, {} as Record<string, string>);
        console.log('Processed assignments map:', assignmentsMap);
        setAssignments(assignmentsMap);
      } else {
        console.log('No data returned from Supabase');
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

  return { assignments, loading, refetch: fetchAllAssignments };
}
