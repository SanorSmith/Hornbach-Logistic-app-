import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRedPointsStore } from '../store/redPointsStore';
import { RedPoint } from '../types';
import toast from 'react-hot-toast';
import { RATE_LIMIT_MESSAGE, rateLimitSeconds } from '../lib/rateLimit';

// Store actions are stable, so these can live outside the hook and the
// effect below only runs once per mounted component.
async function fetchRedPoints() {
  const { setPoints, setLoading } = useRedPointsStore.getState();
  try {
    const { data, error } = await supabase
      .from('red_points')
      .select('*')
      .eq('is_active', true)
      .order('point_number', { ascending: true });

    if (error) throw error;

    setPoints((data ?? []) as RedPoint[]);
  } catch (error) {
    console.error('Error fetching red points:', error);
    toast.error('Fel vid hämtning av röda punkter');
    setLoading(false);
  }
}

// Keep the list in step with inserts, updates and deletes from other devices.
async function handleRealtimeChange(eventType: string, row: Partial<RedPoint>) {
  const { removePoint, updatePoint, addPoint } = useRedPointsStore.getState();
  if (!row.id) return;

  if (eventType === 'DELETE') {
    removePoint(row.id);
    return;
  }

  // Read the row through the API so RLS and the column set match fetchRedPoints.
  const { data, error } = await supabase.from('red_points').select('*').eq('id', row.id).maybeSingle();
  if (error) return;

  const point = data as RedPoint | null;
  const exists = useRedPointsStore.getState().points.some((p) => p.id === row.id);
  if (!point || !point.is_active) {
    if (exists) removePoint(row.id);
  } else if (exists) {
    updatePoint(point);
  } else {
    addPoint(point);
  }
}

export function useRedPoints() {
  const points = useRedPointsStore((state) => state.points);

  useEffect(() => {
    fetchRedPoints();

    // A unique channel name per mount: two components using this hook at the
    // same time must not share (and tear down) one channel.
    const channel = supabase
      .channel(`red-points-changes-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'red_points',
        },
        (payload) => {
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Partial<RedPoint>;
          handleRealtimeChange(payload.eventType, row);
        }
      )
      .subscribe((status) => {
        // (Re)connected: reload so changes made while offline are not missed.
        if (status === 'SUBSCRIBED') fetchRedPoints();
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updatePointStatus = async (
    pointId: string,
    status: RedPoint['status']
  ) => {
    try {
      // Update ONLY the status field - current_user_id causes FK constraint issues
      const { error } = await supabase
        .from('red_points')
        .update({ status })
        .eq('id', pointId);

      if (error) {
        console.error('Update error:', error);
        throw error;
      }

      // Refresh the points to get updated data
      await fetchRedPoints();

      toast.success('Status uppdaterad!');
      return true;
    } catch (error) {
      console.error('Error updating status:', error);
      const wait = rateLimitSeconds(error);
      if (wait !== null) {
        toast.error(`${RATE_LIMIT_MESSAGE} Försök igen om ${wait} s.`, { duration: 6000 });
      } else {
        toast.error('Fel vid uppdatering av status');
      }
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
