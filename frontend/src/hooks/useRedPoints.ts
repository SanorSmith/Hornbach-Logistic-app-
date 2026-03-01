import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRedPointsStore } from '../store/redPointsStore';
import { RedPoint } from '../types';
import toast from 'react-hot-toast';

export function useRedPoints() {
  const { points, setPoints, updatePoint, setLoading } = useRedPointsStore();

  useEffect(() => {
    fetchRedPoints();

    const channel = supabase
      .channel('red-points-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'red_points',
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            handleRealtimeUpdate(payload.new as RedPoint);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRedPoints = async () => {
    try {
      const { data, error } = await supabase
        .from('red_points')
        .select(`
          *,
          department:departments(*),
          current_user:users(id, full_name)
        `)
        .eq('is_active', true)
        .order('point_number', { ascending: true });

      if (error) throw error;

      setPoints(data || []);
    } catch (error: any) {
      console.error('Error fetching red points:', error);
      toast.error('Fel vid hämtning av röda punkter');
      setLoading(false);
    }
  };

  const handleRealtimeUpdate = async (updatedPoint: RedPoint) => {
    const { data, error } = await supabase
      .from('red_points')
      .select(`
        *,
        department:departments(*),
        current_user:users(id, full_name)
      `)
      .eq('id', updatedPoint.id)
      .single();

    if (!error && data) {
      updatePoint(data);
    }
  };

  const updatePointStatus = async (
    pointId: string,
    status: RedPoint['status'],
    notes?: string
  ) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      // First, get the current point data for history
      const { data: currentPoint } = await supabase
        .from('red_points')
        .select('status')
        .eq('id', pointId)
        .single();

      // Update the point status - MINIMAL TEST
      console.log('Attempting update with:', {
        pointId,
        status,
        current_user_id: status === 'UPPTAGEN' ? user.user?.id : null,
      });

      // Test 1: Try minimal update with just status
      const { error: error1 } = await supabase
        .from('red_points')
        .update({ status: 'LEDIG' })
        .eq('id', pointId);

      if (error1) {
        console.error('Minimal update error:', error1);
        throw error1;
      }

      // Test 2: Try with current_user_id
      const { error: error2 } = await supabase
        .from('red_points')
        .update({
          status,
          current_user_id: status === 'UPPTAGEN' ? user.user?.id : null,
        })
        .eq('id', pointId);

      if (error2) {
        console.error('Full update error:', error2);
        throw error2;
      }

      if (error2) {
        console.error('Full update error details:', {
          message: error2.message,
          details: error2.details,
          hint: error2.hint,
          code: error2.code,
        });
        throw error2;
      }

      if (notes && currentPoint) {
        // @ts-ignore - Supabase type inference issue
        await supabase.from('status_history').insert({
          point_id: pointId,
          user_id: user.user!.id,
          // @ts-ignore
          old_status: currentPoint.status,
          new_status: status,
          action_type: 'STATUS_CHANGE',
          notes,
        });
      }

      // Refresh the points to get updated data
      await fetchRedPoints();

      toast.success('Status uppdaterad!');
      return true;
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Fel vid uppdatering av status');
      return null;
    }
  };

  return {
    points,
    isLoading: useRedPointsStore((state) => state.isLoading),
    updatePointStatus,
    refreshPoints: fetchRedPoints,
  };
}
