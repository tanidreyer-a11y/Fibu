import { useLiveQuery } from 'dexie-react-hooks';
import { computeStreak, computeXp, levelFor, loadProgressData, xpToday } from './progress';

/** Live streak / XP / level from everything logged. Re-computes whenever any log changes. */
export function useProgress() {
  return useLiveQuery(async () => {
    const data = await loadProgressData();
    const xp = computeXp(data);
    return { data, streak: computeStreak(data), xp, xpToday: xpToday(data), level: levelFor(xp) };
  }, []);
}
