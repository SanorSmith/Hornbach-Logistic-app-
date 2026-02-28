import { create } from 'zustand';
import { RedPoint } from '../types';

interface RedPointsState {
  points: RedPoint[];
  isLoading: boolean;
  setPoints: (points: RedPoint[]) => void;
  updatePoint: (point: RedPoint) => void;
  addPoint: (point: RedPoint) => void;
  removePoint: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useRedPointsStore = create<RedPointsState>((set) => ({
  points: [],
  isLoading: true,
  setPoints: (points) => set({ points, isLoading: false }),
  updatePoint: (updatedPoint) =>
    set((state) => ({
      points: state.points.map((p) =>
        p.id === updatedPoint.id ? updatedPoint : p
      ),
    })),
  addPoint: (point) =>
    set((state) => ({ points: [...state.points, point] })),
  removePoint: (id) =>
    set((state) => ({
      points: state.points.filter((p) => p.id !== id),
    })),
  setLoading: (loading) => set({ isLoading: loading }),
}));
