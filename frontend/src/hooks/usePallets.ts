import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { fetchActiveAllowances, fetchOpenPallets } from '../lib/pallets';
import { usePalletsStore } from '../store/palletsStore';

export async function loadPallets() {
  try {
    const [pallets, allowances] = await Promise.all([fetchOpenPallets(), fetchActiveAllowances()]);
    usePalletsStore.getState().setData(pallets, allowances);
  } catch (error) {
    console.error('Error fetching pallets:', error);
    toast.error('Fel vid hämtning av pallar');
  }
}

/**
 * Loads the open pallets and active extra pallet privileges, and keeps them in
 * step with changes from other devices. Mount once per page.
 */
export function usePallets() {
  const pallets = usePalletsStore((state) => state.pallets);
  const allowances = usePalletsStore((state) => state.allowances);

  useEffect(() => {
    loadPallets();
    const channel = supabase
      .channel(`pallets-changes-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'point_pallets' }, () => loadPallets())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'point_allowances' }, () => loadPallets())
      .subscribe((status) => {
        // (Re)connected: reload so changes made while offline are not missed.
        if (status === 'SUBSCRIBED') loadPallets();
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { pallets, allowances, reload: loadPallets };
}
