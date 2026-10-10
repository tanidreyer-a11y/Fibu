import { addDays, localDate } from './dates';
import { db, type Plan, type Profile, type WorkoutSession } from './db';
import { defaultSchedule } from './plan';

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Monday-first display order. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function planSchedule(plan: Pick<Plan, 'schedule' | 'days'> | undefined, profile?: Pick<Profile, 'daysPerWeek'>): number[] {
  return plan?.schedule?.length ? plan.schedule : defaultSchedule(profile?.daysPerWeek ?? plan?.days.length ?? 3);
}

export function sortWeekdays(days: number[]): number[] {
  return [...new Set(days)].sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b));
}

export function describeDays(days: number[]): string {
  const names = sortWeekdays(days).map((d) => WEEKDAY_SHORT[d]);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? 'no days');
}

export interface MissedSession {
  /** the scheduled day that was skipped */
  missedDate: string;
  missedWeekday: number;
  /** the unscheduled day the user is training on instead */
  todayWeekday: number;
  /** what the schedule would become if they shift */
  shifted: number[];
}

/**
 * Training today on a day that isn't in the schedule, right after skipping a
 * scheduled day (no workout on it or since): that's a moved session. Looks back
 * up to 3 days so "missed Friday, training Saturday" and "missed Thursday,
 * training Saturday" both count, but last week's gaps don't.
 */
export function detectMovedSession(schedule: number[], sessions: Pick<WorkoutSession, 'date'>[], today = localDate()): MissedSession | null {
  const todayWeekday = weekdayOf(today);
  if (!schedule.length || schedule.includes(todayWeekday)) return null;
  if (sessions.some((s) => s.date === today)) return null;
  for (let back = 1; back <= 3; back++) {
    const date = addDays(today, -back);
    const wd = weekdayOf(date);
    if (!schedule.includes(wd)) continue;
    const trainedSince = sessions.some((s) => s.date >= date && s.date < today);
    if (trainedSince) return null;
    const shifted = sortWeekdays(schedule.map((d) => (d === wd ? todayWeekday : d)));
    return { missedDate: date, missedWeekday: wd, todayWeekday, shifted };
  }
  return null;
}

const ANSWER_KEY = (date: string) => `fibu:scheduleAnswer:${date}`;

/** The user already chose shift/keep for today: don't ask twice. */
export function scheduleQuestionAnswered(today = localDate()): boolean {
  try {
    return localStorage.getItem(ANSWER_KEY(today)) != null;
  } catch {
    return false;
  }
}

export function rememberScheduleAnswer(answer: 'shift' | 'keep', today = localDate()) {
  try {
    localStorage.setItem(ANSWER_KEY(today), answer);
  } catch {
    // worst case we ask again
  }
}

export async function saveSchedule(days: number[]): Promise<void> {
  const plan = await db.plan.get('active');
  if (!plan) return;
  await db.plan.put({ ...plan, schedule: sortWeekdays(days) });
}
