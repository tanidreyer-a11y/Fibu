import { create } from 'zustand';

interface RestTimerState {
  endsAt: number | null;
  totalSeconds: number;
  start: (seconds: number) => void;
  adjust: (deltaSeconds: number) => void;
  dismiss: () => void;
}

export const useRestTimer = create<RestTimerState>((set, get) => ({
  endsAt: null,
  totalSeconds: 90,
  start: (seconds) => set({ endsAt: Date.now() + seconds * 1000, totalSeconds: seconds }),
  adjust: (delta) => {
    const current = get().endsAt;
    if (current == null) return;
    set({ endsAt: Math.max(Date.now(), current + delta * 1000) });
  },
  dismiss: () => set({ endsAt: null }),
}));
