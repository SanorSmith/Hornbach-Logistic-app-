import { create } from 'zustand';
import { PointAllowance, PointPallet } from '../types';

interface PalletsState {
  /** Pallets still on a point (picked_at is null). */
  pallets: PointPallet[];
  /** Active extra pallet privileges. */
  allowances: PointAllowance[];
  setData: (pallets: PointPallet[], allowances: PointAllowance[]) => void;
}

export const usePalletsStore = create<PalletsState>((set) => ({
  pallets: [],
  allowances: [],
  setData: (pallets, allowances) => set({ pallets, allowances }),
}));
