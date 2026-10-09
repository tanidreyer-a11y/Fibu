import { addDays, localDate } from './dates';
import { db, type BodyEntry, type FoodEntry, type Profile, type WaterEntry, type WorkoutSession } from './db';
import { bestSetForExercise } from './training';

export interface ProgressData {
  sessions: WorkoutSession[];
  food: FoodEntry[];
  water: WaterEntry[];
  body: BodyEntry[];
  profile?: Profile;
  proteinTargetG?: number;
}

export async function loadProgressData(): Promise<ProgressData> {
  const [sessions, food, water, body, profile, settings] = await Promise.all([
    db.sessions.orderBy('date').toArray(),
    db.foodLog.toArray(),
    db.waterLog.toArray(),
    db.bodyLog.orderBy('date').toArray(),
    db.profile.get('me'),
    db.settings.get('app'),
  ]);
  return { sessions, food, water, body, profile, proteinTargetG: settings?.proteinTargetG };
}

/** Days with anything logged. A streak is consecutive such days, like Duolingo's. */
function activeDays(d: ProgressData): Set<string> {
  const days = new Set<string>();
  d.sessions.forEach((s) => days.add(s.date));
  d.food.forEach((f) => days.add(f.date));
  d.water.forEach((w) => days.add(w.date));
  d.body.forEach((b) => days.add(b.date));
  return days;
}

export interface Streak {
  days: number;
  /** today already counts; otherwise the streak is waiting on a log today */
  todayDone: boolean;
  best: number;
}

export function computeStreak(d: ProgressData, today = localDate()): Streak {
  const days = activeDays(d);
  const todayDone = days.has(today);
  let cursor = todayDone ? today : addDays(today, -1);
  let count = 0;
  while (days.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  // Longest run ever, for the "best" figure.
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const day of sorted) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return { days: count, todayDone, best: Math.max(best, count) };
}

/**
 * XP is derived from what's logged, never stored, so undoing an entry also
 * removes its XP. Training is worth the most; logging food and water keeps
 * the habit alive.
 */
export function computeXp(d: ProgressData): number {
  let xp = 0;
  for (const s of d.sessions) {
    const sets = s.exerciseEntries.reduce((n, e) => n + e.sets.length, 0);
    xp += 50 + Math.min(sets, 30) * 5;
  }
  const foodPerDay = new Map<string, number>();
  d.food.forEach((f) => foodPerDay.set(f.date, (foodPerDay.get(f.date) ?? 0) + 1));
  for (const n of foodPerDay.values()) xp += Math.min(n, 6) * 10;
  const waterPerDay = new Map<string, number>();
  d.water.forEach((w) => waterPerDay.set(w.date, (waterPerDay.get(w.date) ?? 0) + 1));
  for (const n of waterPerDay.values()) xp += Math.min(n, 8) * 2;
  xp += new Set(d.body.map((b) => b.date)).size * 10;
  return xp;
}

export function xpToday(d: ProgressData, today = localDate()): number {
  return computeXp({
    ...d,
    sessions: d.sessions.filter((s) => s.date === today),
    food: d.food.filter((f) => f.date === today),
    water: d.water.filter((w) => w.date === today),
    body: d.body.filter((b) => b.date === today),
  });
}

/** Each level asks a bit more than the last: 250, 350, 450… XP. */
export function levelFor(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let floor = 0;
  let step = 250;
  while (xp >= floor + step) {
    floor += step;
    level++;
    step += 100;
  }
  return { level, into: xp - floor, needed: step };
}

export interface AchievementDef {
  id: string;
  title: string;
  detail: string;
  test: (d: ProgressData, streak: Streak) => boolean;
}

function prCount(d: ProgressData): number {
  let prs = 0;
  for (let i = 0; i < d.sessions.length; i++) {
    const before = d.sessions.slice(0, i);
    for (const entry of d.sessions[i].exerciseEntries) {
      const prior = bestSetForExercise(before, entry.exerciseId);
      if (!prior) continue;
      if (entry.sets.some((s) => s.weightKg > prior.weightKg || (s.weightKg === prior.weightKg && s.reps > prior.reps))) prs++;
    }
  }
  return prs;
}

function proteinDays(d: ProgressData): number {
  if (!d.proteinTargetG) return 0;
  const perDay = new Map<string, number>();
  d.food.forEach((f) => perDay.set(f.date, (perDay.get(f.date) ?? 0) + f.proteinG));
  return [...perDay.values()].filter((p) => p >= d.proteinTargetG! * 0.95).length;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-workout', title: 'First rep', detail: 'Log your first workout', test: (d) => d.sessions.length >= 1 },
  { id: 'workouts-10', title: 'Ten strong', detail: 'Log 10 workouts', test: (d) => d.sessions.length >= 10 },
  { id: 'workouts-50', title: 'Half century', detail: 'Log 50 workouts', test: (d) => d.sessions.length >= 50 },
  { id: 'first-pr', title: 'New best', detail: 'Beat a previous best set', test: (d) => prCount(d) >= 1 },
  { id: 'prs-10', title: 'Record breaker', detail: 'Set 10 personal bests', test: (d) => prCount(d) >= 10 },
  { id: 'streak-3', title: 'On a roll', detail: '3-day streak', test: (_d, s) => s.best >= 3 },
  { id: 'streak-7', title: 'Week warrior', detail: '7-day streak', test: (_d, s) => s.best >= 7 },
  { id: 'streak-30', title: 'Unstoppable', detail: '30-day streak', test: (_d, s) => s.best >= 30 },
  { id: 'meals-10', title: 'Food tracker', detail: 'Log 10 foods', test: (d) => d.food.length >= 10 },
  { id: 'protein-3', title: 'Protein pro', detail: 'Hit your protein target on 3 days', test: (d) => proteinDays(d) >= 3 },
  { id: 'hydrated', title: 'Hydrated', detail: 'Log 2 litres of water in a day', test: (d) => [...groupSum(d.water)].some(([, ml]) => ml >= 2000) },
  {
    id: 'goal-1kg',
    title: 'On the move',
    detail: 'First kilo toward your goal weight',
    test: (d) => {
      const goal = d.profile?.goalWeightKg;
      if (!goal || d.body.length < 2) return false;
      const start = d.body[0].weightKg;
      const now = d.body[d.body.length - 1].weightKg;
      return goal < start ? start - now >= 1 : now - start >= 1;
    },
  },
];

function groupSum(water: WaterEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  water.forEach((w) => m.set(w.date, (m.get(w.date) ?? 0) + w.ml));
  return m;
}

/** Records newly earned achievements and returns them, so the UI can celebrate once. */
export async function syncAchievements(d: ProgressData): Promise<AchievementDef[]> {
  const streak = computeStreak(d);
  const have = new Set((await db.achievements.toArray()).map((a) => a.id));
  const fresh = ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.test(d, streak));
  if (fresh.length) await db.achievements.bulkPut(fresh.map((a) => ({ id: a.id, unlockedAt: new Date().toISOString() })));
  return fresh;
}

/** Trend from the weight log: kg per week over the last ~3 weeks (least squares). */
export function weightTrend(body: BodyEntry[], today = localDate()): number | null {
  const recent = body.filter((b) => b.date >= addDays(today, -21));
  if (recent.length < 3) return null;
  const xs = recent.map((b) => Date.parse(b.date) / 86_400_000);
  const ys = recent.map((b) => b.weightKg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return den ? (num / den) * 7 : null;
}
