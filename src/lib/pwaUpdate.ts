import { registerSW } from 'virtual:pwa-register';
import { create } from 'zustand';

interface UpdateState {
  ready: boolean;
  apply: () => void;
}

export const useAppUpdate = create<UpdateState>(() => ({ ready: false, apply: () => location.reload() }));

/**
 * An installed iPhone web app rarely checks for a new version by itself, so
 * check whenever it comes back to the foreground (and every 30 minutes), then
 * offer an "Update" button rather than reloading on its own mid-workout.
 */
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    useAppUpdate.setState({ ready: true, apply: () => void updateSW(true) });
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const check = () => {
      if (navigator.onLine !== false) registration.update().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    window.setInterval(check, 30 * 60 * 1000);
  },
});
