import type { AiTool } from './ai';
import { addDays, friendlyDate, localDate } from './dates';
import { describeDays, planSchedule, rememberScheduleAnswer, saveSchedule, weekdayOf } from './schedule';
import { suggestProgressiveOverload } from './training';
import { db, type Exercise, type Goal, type MealType, type SetEntry } from './db';
import { compact } from './exerciseFilters';
import { addFood, currentMeal, logWater, sumFood } from './food';
import { generatePlan, nextPlanDay, planInputFromProfile, STAPLES } from './plan';
import { computeTargets } from './nutrition';

// ─── What the model may call. Every write returns an undo so nothing the AI does is permanent by accident.

export const AGENT_TOOLS: AiTool[] = [
  {
    type: 'function',
    function: {
      name: 'log_meal',
      description:
        'Log food the user ate. Use for meals described in text or seen in a photo, once details are clear enough. Numbers are for the whole portion eaten.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short meal name, e.g. "Chicken stir-fry with rice"' },
          calories: { type: 'number' },
          proteinG: { type: 'number' },
          carbsG: { type: 'number' },
          fatG: { type: 'number' },
          mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
          estimate: { type: 'boolean', description: 'true when numbers are your estimate, false when read from a label or given by the user' },
          date: { type: 'string', description: 'YYYY-MM-DD, only when it was eaten on an earlier day (e.g. "yesterday"). Omit for today.' },
        },
        required: ['name', 'calories', 'proteinG', 'carbsG', 'fatG'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_workout',
      description: 'Log exercises the user says they did. Weights in kg (convert from lb). Bodyweight moves use weightKg 0. Timed holds use seconds instead of reps.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Session name, e.g. "Push day" or "Home workout"' },
          date: { type: 'string', description: 'YYYY-MM-DD, only when the workout was on an earlier day (e.g. "yesterday", "on Friday"). Omit for today.' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Exercise name including the equipment they used, e.g. "incline dumbbell press", "dumbbell bicep curl"' },
                sets: { type: 'number' },
                reps: { type: 'number', description: 'Reps per set (or seconds for holds)' },
                weightKg: { type: 'number' },
              },
              required: ['name', 'sets', 'reps'],
            },
          },
        },
        required: ['exercises'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_weight',
      description: "Log the user's bodyweight for today (kg).",
      parameters: { type: 'object', properties: { weightKg: { type: 'number' } }, required: ['weightKg'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_water',
      description: 'Log water the user drank, in millilitres (a glass is about 250 ml, a bottle 500 ml).',
      parameters: { type: 'object', properties: { ml: { type: 'number' } }, required: ['ml'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_today',
      description: "Today's food totals vs targets, water, workouts done, and the next planned workout.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_history',
      description: 'Look up past data. Use before answering any question about progress, records or past days.',
      parameters: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['workouts', 'food', 'weight'] },
          days: { type: 'number', description: 'How many days back (default 14, max 90)' },
          exercise: { type: 'string', description: 'Optional: only this exercise (workouts only)' },
        },
        required: ['kind'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_goal',
      description: "Change the user's goal, goal weight, training days or nutrition targets. Only call after the user clearly agreed to the change.",
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', enum: ['muscle_gain', 'fat_loss', 'strength', 'general_fitness'] },
          goalWeightKg: { type: 'number' },
          daysPerWeek: { type: 'number' },
          calorieTarget: { type: 'number' },
          proteinTargetG: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_schedule',
      description: "Set which weekdays the user trains, e.g. after they choose to shift a missed Friday to Saturday. Only call after they've agreed.",
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'array', items: { type: 'string', enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] } },
        },
        required: ['days'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_workout',
      description: "Open the workout screen ready to train. Omit dayLabel to start the plan's next day.",
      parameters: { type: 'object', properties: { dayLabel: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Open a screen in the app.',
      parameters: { type: 'object', properties: { screen: { type: 'string', enum: ['home', 'train', 'food', 'body', 'settings'] } }, required: ['screen'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description:
        'Ask the user one short question with tap-to-answer options, e.g. portion size or cooking oil before logging a photographed meal. The conversation pauses until they answer.',
      parameters: {
        type: 'object',
        properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } },
        required: ['question', 'options'],
      },
    },
  },
];

// ─── Results shown in the chat

export interface ActionCard {
  id: string;
  kind: 'meal' | 'workout' | 'weight' | 'water' | 'goal' | 'nav' | 'schedule';
  title: string;
  detail?: string;
  undone?: boolean;
}

export interface ToolContext {
  navigate: (path: string) => void;
}

export interface ToolOutcome {
  /** JSON sent back to the model */
  result: unknown;
  card?: ActionCard;
  undo?: () => Promise<void>;
  /** quick replies to render; the loop stops and waits for the user */
  ask?: { question: string; options: string[] };
}

/**
 * Accept the model's date as YYYY-MM-DD, "yesterday", or a weekday name (the most
 * recent one before today). Anything in the future or older than 30 days falls back to today.
 */
function pickDate(raw: unknown, today: string): string {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s || s === 'today') return today;
  if (s === 'yesterday') return addDays(today, -1);
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const wd = weekdays.findIndex((w) => s === w || s === w.slice(0, 3));
  if (wd >= 0) {
    for (let back = 1; back <= 7; back++) {
      const d = addDays(today, -back);
      if (weekdayOf(d) === wd) return d;
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s > today || s < addDays(today, -30)) return today;
  return s;
}

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || fallback);
const cardId = () => Math.random().toString(36).slice(2, 10);
const MEAL_LABEL: Record<MealType, string> = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'snacks' };

const EQUIPMENT_WORDS: Record<string, string[]> = {
  dumbbell: ['dumbbell', 'db'],
  barbell: ['barbell', 'bb'],
  machine: ['machine'],
  cable: ['cable'],
  smith: ['smith'],
  kettlebell: ['kettlebell', 'kb'],
  band: ['band'],
};
const STOP_WORDS = new Set(['with', 'the', 'and', 'kg', 'lb', 'lbs', 'reps', 'sets', 'set', 'of', 'on', 'my']);
/** Gym shorthand → words our exercise names use. */
const ALIASES: [RegExp, string][] = [
  [/\brdls?\b/g, 'romanian deadlift'],
  [/\bsldls?\b/g, 'stiff legged deadlift'],
  [/\bohp\b/g, 'overhead press'],
  [/\bdb\b/g, 'dumbbell'],
  [/\bbb\b/g, 'barbell'],
  [/\bkb\b/g, 'kettlebell'],
  [/\bbench\b(?! press| dip)/g, 'bench press'],
  [/\bfarmers?'? (walk|carr(y|ies))\b/g, 'farmer carry'],
  [/\bcable (flys?|flies|flyes)\b/g, 'cable crossover'],
  [/\bbiceps?\b/g, ''],
  [/\btriceps?\b/g, 'triceps'],
  [/\bflys?\b|\bflies\b/g, 'flyes'],
];
function stem(w: string): string {
  if (w.endsWith('sses') || w.endsWith('ches') || w.endsWith('shes')) return w.slice(0, -2);
  if (w.endsWith('ss') || w.length <= 3) return w;
  return w.replace(/s$/, '');
}

/**
 * Best library match for a spoken exercise name. Scores shared words, prefers
 * Fibu's own moves, rewards the equipment the user said (and penalises
 * equipment they didn't), so "bicep curls with dumbbells" lands on Dumbbell Curl,
 * not Machine Bicep Curl.
 */
export function matchExercise(name: string, all: Exercise[]): Exercise | null {
  const q = compact(name).replace(/s$/, '');
  if (!q) return null;
  const exact = all.find((e) => compact(e.name).replace(/s$/, '') === q && e.source !== 'fedb') ?? all.find((e) => compact(e.name).replace(/s$/, '') === q);
  if (exact) return exact;

  let spoken = name.toLowerCase().replace(/push[- ]?ups?/g, 'push up').replace(/pull[- ]?ups?/g, 'pull up').replace(/chin[- ]?ups?/g, 'chin up');
  for (const [re, to] of ALIASES) spoken = spoken.replace(re, to);
  const words = spoken
    .split(/[^a-z]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map(stem);
  if (!words.length) return null;
  const saidEquipment = Object.entries(EQUIPMENT_WORDS).filter(([, ws]) => ws.some((w) => spoken.split(/[^a-z]+/).includes(w))).map(([k]) => k);

  // A bare generic word means the everyday version of the move.
  const generic = words.length === 1 ? GENERIC[words[0]] : undefined;
  if (generic) {
    const hit = all.find((e) => e.id === generic);
    if (hit) return hit;
  }

  let best: { e: Exercise; score: number } | null = null;
  for (const e of all) {
    const nameWords = e.name.toLowerCase().replace(/push-up/g, 'push up').replace(/pull-up/g, 'pull up').split(/[^a-z]+/).filter((w) => w.length > 1).map(stem);
    if (!nameWords.length) continue;
    const shared = words.filter((w) => nameWords.some((n) => n === w || (w.length > 3 && n.length > 3 && (n.startsWith(w) || w.startsWith(n))))).length;
    if (!shared) continue;
    // Covering what the user said matters most; covering the library name a little.
    let score = 0.7 * (shared / words.length) + 0.3 * (shared / nameWords.length);
    if (e.source === 'fibu') score += 0.25;
    if (STAPLES.has(e.id)) score += 0.1;
    if (e.isCustom) score += 0.15;
    if (saidEquipment.length) {
      if (saidEquipment.includes(String(e.equipment))) score += 0.3;
      else if (Object.values(EQUIPMENT_WORDS).some((ws) => ws.some((w) => nameWords.includes(w)))) score -= 0.3;
    }
    if (score > (best?.score ?? 0.55)) best = { e, score };
  }
  return best?.e ?? null;
}

const GENERIC: Record<string, string> = {
  curl: 'dumbbell-curl',
  row: 'dumbbell-row',
  squat: 'back-squat',
  deadlift: 'deadlift',
  lunge: 'walking-lunge',
  flyes: 'dumbbell-flyes',
  pushdown: 'triceps-pushdown',
  shrug: 'dumbbell-shrug',
  crunch: 'crunch',
  dip: 'dips',
};

export async function runTool(name: string, rawArgs: string, ctx: ToolContext): Promise<ToolOutcome> {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { result: { ok: false, error: 'Arguments were not valid JSON' } };
  }
  const today = localDate();

  switch (name) {
    case 'log_meal': {
      const mealType = (['breakfast', 'lunch', 'dinner', 'snack'] as const).includes(args.mealType as MealType) ? (args.mealType as MealType) : currentMeal();
      const draft = { name: String(args.name ?? 'Meal'), calories: num(args.calories), proteinG: num(args.proteinG), carbsG: num(args.carbsG), fatG: num(args.fatG) };
      if (draft.calories <= 0) return { result: { ok: false, error: 'calories must be above 0' } };
      const date = pickDate(args.date, today);
      const id = await addFood(draft, { source: 'chat', confidence: args.estimate === false ? 'exact' : 'estimate', mealType, date });
      const totals = sumFood(await db.foodLog.where('date').equals(date).toArray());
      return {
        result: { ok: true, logged: draft, mealType, date, dayTotalCalories: Math.round(totals.calories), dayProteinG: Math.round(totals.proteinG) },
        card: {
          id: cardId(),
          kind: 'meal',
          title: `Logged ${draft.name}`,
          detail: `${Math.round(draft.calories)} kcal · ${Math.round(draft.proteinG)} g protein · ${MEAL_LABEL[mealType]}${date !== today ? ` · ${friendlyDate(date, today)}` : ''}`,
        },
        undo: async () => {
          await db.foodLog.delete(id);
        },
      };
    }

    case 'log_workout': {
      const list = Array.isArray(args.exercises) ? (args.exercises as Record<string, unknown>[]) : [];
      if (!list.length) return { result: { ok: false, error: 'No exercises given' } };
      const all = await db.exercises.toArray();
      const created: string[] = [];
      const entries = [];
      for (const item of list.slice(0, 15)) {
        const spoken = String(item.name ?? '').trim();
        if (!spoken) continue;
        let ex = matchExercise(spoken, all);
        if (!ex) {
          // Unknown move: save it as the user's own so history stays complete.
          ex = { id: `custom-${compact(spoken).slice(0, 30)}-${Date.now().toString(36)}`, name: spoken.replace(/\b\w/g, (c) => c.toUpperCase()), muscleGroups: ['abs'], equipment: 'other', isCustom: true, source: 'custom' };
          await db.exercises.put(ex);
          all.push(ex);
          created.push(ex.id);
        }
        const sets = Math.min(20, Math.max(1, Math.round(num(item.sets, 1))));
        const set: SetEntry = { reps: Math.max(0, Math.round(num(item.reps))), weightKg: Math.max(0, Math.round(num(item.weightKg) * 4) / 4) };
        entries.push({ exerciseId: ex.id, name: ex.name, sets: Array.from({ length: sets }, () => ({ ...set })) });
      }
      if (!entries.length) return { result: { ok: false, error: 'Could not read any exercise names' } };
      const date = pickDate(args.date, today);
      const now = new Date().toISOString();
      const id = (await db.sessions.add({
        date,
        dayLabel: String(args.title ?? 'Logged with Fibu').slice(0, 40),
        startedAt: now,
        completedAt: now,
        exerciseEntries: entries.map(({ exerciseId, sets }) => ({ exerciseId, sets })),
        source: 'chat',
      })) as number;
      const summary = entries.map((e) => `${e.name} ${e.sets.length}×${e.sets[0].reps}${e.sets[0].weightKg ? ` @ ${e.sets[0].weightKg} kg` : ''}`);
      // Next-time advice comes from the app's own progression rules, so the coach never improvises
      // (and never suggests an easier variation as "progress").
      const units = (await db.settings.get('app'))?.units ?? 'kg';
      const nextTime = entries.map((e) => {
        const ex = all.find((x) => x.id === e.exerciseId);
        const s = suggestProgressiveOverload(e.sets[0], units, { exercise: ex });
        const harder = s.nextExerciseId ? all.find((x) => x.id === s.nextExerciseId)?.name : undefined;
        return `${e.name}: ${harder ? `ready for ${harder} next time` : s.message}`;
      });
      return {
        result: { ok: true, sessionId: id, date, logged: summary, nextTime, newCustomExercises: created.length },
        card: { id: cardId(), kind: 'workout', title: date === today ? 'Workout logged' : `Workout logged for ${friendlyDate(date, today)}`, detail: summary.join(' · ') },
        undo: async () => {
          await db.sessions.delete(id);
          if (created.length) await db.exercises.bulkDelete(created);
        },
      };
    }

    case 'log_weight': {
      const weightKg = num(args.weightKg);
      if (weightKg < 25 || weightKg > 350) return { result: { ok: false, error: 'That weight looks wrong; ask the user to confirm the number and unit' } };
      const existing = await db.bodyLog.where('date').equals(today).first();
      const profile = await db.profile.get('me');
      const previousProfileWeight = profile?.weightKg;
      if (existing?.id != null) await db.bodyLog.update(existing.id, { weightKg });
      const newId = existing?.id == null ? ((await db.bodyLog.add({ date: today, weightKg, createdAt: new Date().toISOString() })) as number) : undefined;
      if (profile) await db.profile.put({ ...profile, weightKg, updatedAt: new Date().toISOString() });
      return {
        result: { ok: true, weightKg },
        card: { id: cardId(), kind: 'weight', title: 'Weight logged', detail: `${Math.round(weightKg * 10) / 10} kg today` },
        undo: async () => {
          if (newId != null) await db.bodyLog.delete(newId);
          else if (existing?.id != null) await db.bodyLog.update(existing.id, { weightKg: existing.weightKg });
          const p = await db.profile.get('me');
          if (p && previousProfileWeight) await db.profile.put({ ...p, weightKg: previousProfileWeight });
        },
      };
    }

    case 'log_water': {
      const ml = Math.round(num(args.ml));
      if (ml <= 0 || ml > 5000) return { result: { ok: false, error: 'ml must be between 1 and 5000' } };
      await logWater(today, ml);
      const last = await db.waterLog.where('date').equals(today).last();
      const total = (await db.waterLog.where('date').equals(today).toArray()).reduce((s, w) => s + w.ml, 0);
      return {
        result: { ok: true, ml, todayTotalMl: total },
        card: { id: cardId(), kind: 'water', title: `${ml} ml water`, detail: `${(total / 1000).toFixed(2).replace(/0$/, '')} L today` },
        undo: async () => {
          if (last?.id != null) await db.waterLog.delete(last.id);
        },
      };
    }

    case 'get_today': {
      const [food, water, sessions, settings, plan, lastSession] = await Promise.all([
        db.foodLog.where('date').equals(today).toArray(),
        db.waterLog.where('date').equals(today).toArray(),
        db.sessions.where('date').equals(today).toArray(),
        db.settings.get('app'),
        db.plan.get('active'),
        db.sessions.orderBy('date').last(),
      ]);
      const t = sumFood(food);
      return {
        result: {
          date: today,
          eaten: { calories: Math.round(t.calories), proteinG: Math.round(t.proteinG), carbsG: Math.round(t.carbsG), fatG: Math.round(t.fatG) },
          targets: { calories: settings?.calorieTarget, proteinG: settings?.proteinTargetG, carbsG: settings?.carbsTargetG, fatG: settings?.fatTargetG, waterMl: settings?.waterTargetMl },
          meals: food.map((f) => `${f.mealType}: ${f.name} ${f.calories} kcal`),
          waterMl: water.reduce((s, w) => s + w.ml, 0),
          workoutsToday: sessions.map((s) => s.dayLabel),
          nextPlannedWorkout: plan ? nextPlanDay(plan.days, lastSession?.dayLabel)?.label : null,
        },
      };
    }

    case 'get_history': {
      const days = Math.min(90, Math.max(1, Math.round(num(args.days, 14))));
      const from = addDays(today, -days);
      if (args.kind === 'food') {
        const rows = await db.foodLog.where('date').aboveOrEqual(from).toArray();
        const byDay = new Map<string, number[]>();
        for (const r of rows) byDay.set(r.date, [...(byDay.get(r.date) ?? [0, 0]).map((v, i) => v + (i === 0 ? r.calories : r.proteinG))]);
        return { result: { days: [...byDay.entries()].map(([d, [kcal, p]]) => ({ date: d, calories: Math.round(kcal), proteinG: Math.round(p) })) } };
      }
      if (args.kind === 'weight') {
        const rows = await db.bodyLog.where('date').aboveOrEqual(from).sortBy('date');
        return { result: { entries: rows.map((r) => ({ date: r.date, weightKg: r.weightKg })) } };
      }
      const [sessions, all] = await Promise.all([db.sessions.where('date').aboveOrEqual(from).sortBy('date'), db.exercises.toArray()]);
      const byId = new Map(all.map((e) => [e.id, e.name]));
      const only = args.exercise ? matchExercise(String(args.exercise), all)?.id : undefined;
      return {
        result: {
          sessions: sessions.slice(-30).map((s) => ({
            date: s.date,
            day: s.dayLabel,
            exercises: s.exerciseEntries
              .filter((e) => !only || e.exerciseId === only)
              .map((e) => `${byId.get(e.exerciseId) ?? e.exerciseId}: ${e.sets.map((x) => (x.weightKg ? `${x.weightKg}kg×${x.reps}` : `${x.reps}`)).join(', ')}`),
          })).filter((s) => s.exercises.length),
        },
      };
    }

    case 'update_goal': {
      const [profile, settings, plan] = await Promise.all([db.profile.get('me'), db.settings.get('app'), db.plan.get('active')]);
      if (!profile || !settings) return { result: { ok: false, error: 'No profile yet' } };
      const next = { ...profile, updatedAt: new Date().toISOString() };
      const changes: string[] = [];
      if (args.goal && ['muscle_gain', 'fat_loss', 'strength', 'general_fitness'].includes(String(args.goal))) {
        next.goal = args.goal as Goal;
        changes.push(`goal → ${String(args.goal).replace('_', ' ')}`);
      }
      if (num(args.goalWeightKg) > 25) {
        next.goalWeightKg = num(args.goalWeightKg);
        changes.push(`goal weight → ${next.goalWeightKg} kg`);
      }
      if (num(args.daysPerWeek) >= 1 && num(args.daysPerWeek) <= 7) {
        next.daysPerWeek = Math.round(num(args.daysPerWeek));
        changes.push(`${next.daysPerWeek} days a week`);
      }
      const targets = next.birthYear ? computeTargets(next) : null;
      const nextSettings = { ...settings };
      if (num(args.calorieTarget) > 800) {
        nextSettings.calorieTarget = Math.round(num(args.calorieTarget));
        changes.push(`${nextSettings.calorieTarget} kcal a day`);
      } else if (targets && (next.goal !== profile.goal || next.daysPerWeek !== profile.daysPerWeek)) {
        Object.assign(nextSettings, { calorieTarget: targets.calories, proteinTargetG: targets.proteinG, carbsTargetG: targets.carbsG, fatTargetG: targets.fatG });
        changes.push(`targets recalculated to ${targets.calories} kcal`);
      }
      if (num(args.proteinTargetG) > 30) {
        nextSettings.proteinTargetG = Math.round(num(args.proteinTargetG));
        changes.push(`${nextSettings.proteinTargetG} g protein`);
      }
      if (!changes.length) return { result: { ok: false, error: 'Nothing to change' } };
      const replan = next.goal !== profile.goal || next.daysPerWeek !== profile.daysPerWeek;
      const newPlan = replan && plan ? generatePlan(planInputFromProfile(next)) : null;
      await db.transaction('rw', db.profile, db.settings, db.plan, async () => {
        await db.profile.put(next);
        await db.settings.put(nextSettings);
        if (newPlan && plan) await db.plan.put({ ...plan, days: newPlan.days, reasons: newPlan.reasons, splitName: newPlan.splitName, createdAt: new Date().toISOString() });
      });
      return {
        result: { ok: true, changes, newPlan: newPlan?.splitName },
        card: { id: cardId(), kind: 'goal', title: 'Goal updated', detail: changes.join(' · ') + (newPlan ? ` · new plan: ${newPlan.splitName}` : '') },
        undo: async () => {
          await db.transaction('rw', db.profile, db.settings, db.plan, async () => {
            await db.profile.put(profile);
            await db.settings.put(settings);
            if (plan) await db.plan.put(plan);
          });
        },
      };
    }

    case 'update_schedule': {
      const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const days = (Array.isArray(args.days) ? args.days : []).map((d) => names.indexOf(String(d).toLowerCase())).filter((d) => d >= 0);
      if (!days.length) return { result: { ok: false, error: 'No valid weekdays given' } };
      const [plan, profile] = await Promise.all([db.plan.get('active'), db.profile.get('me')]);
      if (!plan) return { result: { ok: false, error: 'No plan yet' } };
      const before = planSchedule(plan, profile);
      await saveSchedule(days);
      rememberScheduleAnswer('shift', today);
      return {
        result: { ok: true, trainingDays: describeDays(days) },
        card: { id: cardId(), kind: 'schedule', title: 'Training days updated', detail: describeDays(days) },
        undo: async () => {
          await saveSchedule(before);
        },
      };
    }

    case 'start_workout': {
      const plan = await db.plan.get('active');
      const last = await db.sessions.orderBy('date').last();
      const day = args.dayLabel ? plan?.days.find((d) => d.label.toLowerCase() === String(args.dayLabel).toLowerCase()) : plan ? nextPlanDay(plan.days, last?.dayLabel) : undefined;
      try {
        sessionStorage.setItem('fibu:startDay', day?.label ?? 'Freeform');
      } catch {
        // the train screen will just show the day picker
      }
      ctx.navigate('/train');
      return { result: { ok: true, opened: day?.label ?? 'Freeform' }, card: { id: cardId(), kind: 'nav', title: `Opening ${day?.label ?? 'a freeform workout'}` } };
    }

    case 'navigate': {
      const paths: Record<string, string> = { home: '/', train: '/train', food: '/food', body: '/body', settings: '/settings' };
      const path = paths[String(args.screen)] ?? '/';
      ctx.navigate(path);
      return { result: { ok: true, opened: args.screen }, card: { id: cardId(), kind: 'nav', title: `Opening ${String(args.screen)}` } };
    }

    case 'ask_user': {
      const options = (Array.isArray(args.options) ? args.options : []).map(String).filter(Boolean).slice(0, 5);
      return { result: { ok: true, shown: true }, ask: { question: String(args.question ?? ''), options } };
    }

    default:
      return { result: { ok: false, error: `Unknown tool ${name}` } };
  }
}
