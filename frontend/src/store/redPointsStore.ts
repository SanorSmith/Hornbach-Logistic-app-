import { create } from 'zustand';
import { RedPoint } from '../types';

interface RedPointsState {
  points: RedPoint[];
  isLoading: boolean;
  /** When the points last came from the server (load or realtime change). */
  lastSyncedAt: number | null;
  setPoints: (points: RedPoint[]) => void;
  updatePoint: (point: RedPoint) => void;
  addPoint: (point: RedPoint) => void;
  removePoint: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useRedPointsStore = create<RedPointsState>((set) => ({
  points: [],
  isLoading: true,
  lastSyncedAt: null,
  setPoints: (points) => set({ points, isLoading: false, lastSyncedAt: Date.now() }),
  updatePoint: (updatedPoint) =>
    set((state) => ({
      points: state.points.map((p) =>
        p.id === updatedPoint.id ? updatedPoint : p
      ),
      lastSyncedAt: Date.now(),
    })),
  addPoint: (point) =>
    set((state) => ({
      points: [...state.points, point].sort((a, b) => a.point_number - b.point_number),
      lastSyncedAt: Date.now(),
    })),
  removePoint: (id) =>
    set((state) => ({
      points: state.points.filter((p) => p.id !== id),
      lastSyncedAt: Date.now(),
    })),
  setLoading: (loading) => set({ isLoading: loading }),
}));
