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
        .select('*')
        .eq('is_active', true)
        .order('point_number', { ascending: true });

      if (error) throw error;

      setPoints((data as any) || []);
    } catch (error: any) {
      console.error('Error fetching red points:', error);
      toast.error('Fel vid hämtning av röda punkter');
      setLoading(false);
    }
  };

  const handleRealtimeUpdate = async (updatedPoint: RedPoint) => {
    const { data, error } = await supabase
      .from('red_points')
      .select('*')
      .eq('id', updatedPoint.id)
      .single();

    if (!error && data) {
      updatePoint(data as any);
    }
  };

  const updatePointStatus = async (
    pointId: string,
    status: RedPoint['status'],
    notes?: string
  ) => {
    try {
      const { data: user } = await supabase.auth.getUser();

      // Update ONLY the status field - current_user_id causes FK constraint issues
      const { error } = await supabase
        .from('red_points')
        .update({ status } as any)
        .eq('id', pointId);

      if (error) {
        console.error('Update error:', error);
        throw error;
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
