import { EXERCISE_LIBRARY } from './exercises';
import type { Profile, WorkoutSession } from './db';
import { generateFromImage, generateJSON, generateText } from './gemini';
import { DAILY_QUOTES } from './quotes';
import { lbToKg } from './units';

const CACHE_PREFIX = 'fibu:aiQuote:';

function todayKey(date: Date): string {
  return `${CACHE_PREFIX}${date.toISOString().slice(0, 10)}`;
}

/**
 * Upgrades the curated quote-of-the-day to an AI-generated one, cached in
 * localStorage so it's one Gemini call per day, not one per page visit.
 * Falls back to the curated bank silently on any failure — the home screen
 * never shows a broken state because of this.
 */
export async function getAiDailyMessage(dayName: string, fallback: string, date: Date = new Date()): Promise<string> {
  const key = todayKey(date);
  try {
    const cached = localStorage.getItem(key);
    if (cached) return cached;
  } catch {
    // localStorage unavailable (private mode etc.) — fall through to a live call
  }

  const examples = [...DAILY_QUOTES].sort(() => Math.random() - 0.5).slice(0, 4).join('\n');
  const prompt = `You are Fibu, a direct and encouraging training buddy inside a workout-logging app. Write exactly one short motivational line (under 18 words) for ${dayName}. No fitness-influencer clichés, no emoji, no quotation marks around it. Match this voice, these are real examples already in the app:\n${examples}\n\nReply with only the line, nothing else.`;

  const result = await generateText(prompt, 0.9);
  if (!result.ok) return fallback;
  const text = result.data.trim().replace(/^["']|["']$/g, '');
  if (!text || text.length > 140) return fallback;

  try {
    localStorage.setItem(key, text);
  } catch {
    // best-effort cache only
  }
  return text;
}

export interface VoiceParsedSet {
  reps: number;
  weightKg: number;
}

export interface VoiceParseResult {
  exerciseId: string | null;
  exerciseNameHeard: string;
  sets: VoiceParsedSet[];
}

interface RawVoiceSet {
  reps: number;
  weight: number;
  unit: 'kg' | 'lb';
}
interface RawVoiceParse {
  exerciseId: string | null;
  exerciseNameHeard: string;
  sets: RawVoiceSet[];
}

/** Parses a spoken workout-log sentence ("bench press, three sets of eight at eighty kilos") into structured sets. */
export async function parseVoiceLog(transcript: string): Promise<{ ok: true; data: VoiceParseResult } | { ok: false; error: string }> {
  const knownExercises = EXERCISE_LIBRARY.map((e) => `${e.id}: ${e.name}`).join('\n');
  const prompt = `Extract a logged gym exercise from this spoken transcript. Match it to the closest id from the known exercise list below if there's a reasonable match (synonyms and casual phrasing count, e.g. "bench" -> barbell-bench-press); otherwise use null and just report what was heard.

Known exercises:
${knownExercises}

Transcript: "${transcript}"

Reply with only JSON matching exactly this shape:
{"exerciseId": string | null, "exerciseNameHeard": string, "sets": [{"reps": number, "weight": number, "unit": "kg" | "lb"}]}

If the speaker mentions doing the same reps/weight for N sets (e.g. "three sets of eight at 80kg"), expand that into N separate set objects.`;

  const result = await generateJSON<RawVoiceParse>(prompt, 0.2);
  if (!result.ok) return result;

  const data = result.data;
  if (!Array.isArray(data.sets)) return { ok: false, error: "Couldn't make sense of that — try again." };

  return {
    ok: true,
    data: {
      exerciseId: data.exerciseId ?? null,
      exerciseNameHeard: data.exerciseNameHeard ?? transcript,
      sets: data.sets.map((s) => ({
        reps: Math.round(s.reps),
        weightKg: Math.round((s.unit === 'lb' ? lbToKg(s.weight) : s.weight) * 2) / 2,
      })),
    },
  };
}

export interface MealEstimate {
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/**
 * Photo-based calorie estimation is inherently approximate — no vision model
 * gets this precise without a scale. Callers must label it "estimate" and
 * let the user edit before saving (see WorkoutSummary-equivalent for food).
 */
export async function estimateMealFromPhoto(base64: string, mimeType: string): Promise<{ ok: true; data: MealEstimate } | { ok: false; error: string }> {
  const prompt = `Look at this photo of a meal and estimate its nutrition. Be a reasonable, experienced dietitian making a fast visual estimate — you won't be exact, just give your best call for the whole plate/portion shown.

Reply with only JSON matching exactly this shape:
{"name": string (short description of the meal), "calories": number, "proteinG": number, "carbsG": number, "fatG": number}`;

  const result = await generateFromImage(prompt, { base64, mimeType }, true);
  if (!result.ok) return result;
  try {
    const data = JSON.parse(result.data) as MealEstimate;
    if (typeof data.calories !== 'number') throw new Error('bad shape');
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Couldn't read that photo — try again with better lighting." };
  }
}

export function buildChatContext(profile: Profile | undefined, recentSessions: WorkoutSession[]): string {
  const lines: string[] = [];
  if (profile) {
    lines.push(
      `Profile: ${profile.goal.replace('_', ' ')}, ${profile.experience} experience, trains ${profile.daysPerWeek}x/week, ${profile.weightKg}kg bodyweight.`,
    );
  }
  if (recentSessions.length === 0) {
    lines.push('No workouts logged yet.');
  } else {
    lines.push('Recent sessions:');
    for (const s of recentSessions.slice(0, 8)) {
      const exerciseSummary = s.exerciseEntries
        .map((e) => `${e.exerciseId} (${e.sets.map((set) => `${set.weightKg}kg×${set.reps}`).join(', ')})`)
        .join('; ');
      lines.push(`- ${s.date} ${s.dayLabel}: ${exerciseSummary || 'no sets logged'}`);
    }
  }
  return lines.join('\n');
}
