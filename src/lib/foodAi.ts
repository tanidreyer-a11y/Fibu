import { aiChat, parseJsonReply, type AiResult } from './ai';
import type { MealType } from './db';
import { sumFood, type FoodDraft } from './food';

export interface MealItem {
  name: string;
  grams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface MealAnalysis {
  name: string;
  /** true when the photo was a nutrition label read exactly */
  label: boolean;
  confidence: 'low' | 'medium' | 'high';
  items: MealItem[];
  questions: MealQuestion[];
}

export interface MealContext {
  mealType: MealType;
  /** what the user says it is */
  hint?: string;
  /** things the camera can't see: oil, sauce, drink, portion */
  extras?: string[];
  answers?: { question: string; answer: string }[];
}

const SHAPE = `{"name": short meal name, "label": boolean, "confidence": "low"|"medium"|"high", "items": [{"name": string, "grams": number, "calories": number, "proteinG": number, "carbsG": number, "fatG": number}], "questions": [{"id": "q1", "question": string, "options": [string, ...]}]}`;

function contextLines(ctx: MealContext): string {
  const lines = [`Meal: ${ctx.mealType}.`];
  if (ctx.hint?.trim()) lines.push(`The user says it is: "${ctx.hint.trim().slice(0, 120)}". Trust this over your guess.`);
  if (ctx.extras?.length) lines.push(`The user added: ${ctx.extras.join('; ')}. Include these in the items.`);
  for (const a of ctx.answers ?? []) lines.push(`Q: ${a.question} A: ${a.answer}`);
  return lines.join('\n');
}

function normalize(raw: Partial<MealAnalysis> | null): MealAnalysis | null {
  if (!raw || !Array.isArray(raw.items) || raw.items.length === 0) return null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : Number(v) > 0 ? Number(v) : 0);
  const items = raw.items
    .filter((i) => i && typeof i.name === 'string')
    .slice(0, 12)
    .map((i) => ({
      name: String(i.name).slice(0, 60),
      grams: Math.round(num(i.grams)),
      calories: Math.round(num(i.calories)),
      proteinG: Math.round(num(i.proteinG) * 10) / 10,
      carbsG: Math.round(num(i.carbsG) * 10) / 10,
      fatG: Math.round(num(i.fatG) * 10) / 10,
    }));
  if (!items.length || items.every((i) => i.calories === 0)) return null;
  return {
    name: String(raw.name ?? items.map((i) => i.name).join(', ')).slice(0, 60),
    label: raw.label === true,
    confidence: raw.confidence === 'high' || raw.confidence === 'low' ? raw.confidence : 'medium',
    items,
    questions: (Array.isArray(raw.questions) ? raw.questions : [])
      .filter((q) => q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length >= 2)
      .slice(0, 2)
      .map((q, i) => ({ id: q.id ? String(q.id) : `q${i + 1}`, question: String(q.question).slice(0, 120), options: q.options.slice(0, 4).map((o) => String(o).slice(0, 40)) })),
  };
}

export function totals(a: MealAnalysis): FoodDraft {
  const t = sumFood(a.items);
  return { name: a.name, calories: Math.round(t.calories), proteinG: Math.round(t.proteinG * 10) / 10, carbsG: Math.round(t.carbsG * 10) / 10, fatG: Math.round(t.fatG * 10) / 10 };
}

const UNREADABLE = "Fibu couldn't make out a meal in that photo. Try again closer, in good light, or tell me what it is.";

export async function analyzeMealPhoto(imageDataUrl: string, ctx: MealContext): Promise<AiResult<MealAnalysis>> {
  const prompt = `You are a careful sports nutritionist estimating a meal from a phone photo.
If the photo shows a nutrition facts label or packaging with nutrition values, read them exactly for ONE serving, set "label": true and "confidence": "high", and ask no questions.
Otherwise identify each separate food on the plate with a realistic portion in grams (use the plate, cutlery and hands for scale) and estimate calories and macros per item. Account for typical cooking fat for fried or roasted food.
${contextLines(ctx)}
Then ask at most 2 short multiple-choice questions, only about things that would change the total by more than about 15% and that the photo can't show (cooking oil or butter, sauce or dressing, portion eaten, fatty vs lean cut, a drink). Each question gets 2 to 4 short options. Ask nothing if you are confident.
Reply with only JSON in exactly this shape: ${SHAPE}`;

  const result = await aiChat({
    json: true,
    temperature: 0.3,
    maxTokens: 1200,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageDataUrl } }] }],
  });
  if (!result.ok) return result;
  const data = normalize(parseJsonReply<Partial<MealAnalysis>>(result.data.content));
  return data ? { ok: true, data } : { ok: false, error: UNREADABLE };
}

/** Cheap text-only follow-up: re-estimate using the user's answers. Keeps the photo out of the second call. */
export async function refineMeal(previous: MealAnalysis, ctx: MealContext): Promise<AiResult<MealAnalysis>> {
  const prompt = `You estimated this meal from a photo:
${JSON.stringify({ name: previous.name, items: previous.items })}
The user has now told you more:
${contextLines(ctx)}
Update the items, portions and numbers to match what they said (add items for any extras like oil, sauce or drinks). Ask no more questions ("questions": []).
Reply with only JSON in exactly this shape: ${SHAPE}`;
  const result = await aiChat({ json: true, temperature: 0.2, maxTokens: 1000, messages: [{ role: 'user', content: prompt }] });
  if (!result.ok) return result;
  const data = normalize(parseJsonReply<Partial<MealAnalysis>>(result.data.content));
  return data ? { ok: true, data } : { ok: false, error: "Couldn't update the estimate. The first one is still here." };
}

/** "2 eggs and toast with butter" -> an estimate, for foods search can't find. */
export async function estimateFoodText(description: string, mealType: MealType): Promise<AiResult<MealAnalysis>> {
  const prompt = `Estimate the nutrition of this food as described by the user: "${description.trim().slice(0, 200)}". Meal: ${mealType}.
Split it into items with realistic portions in grams if no amounts are given. Ask no questions ("questions": []).
Reply with only JSON in exactly this shape: ${SHAPE}`;
  const result = await aiChat({ json: true, temperature: 0.2, maxTokens: 900, messages: [{ role: 'user', content: prompt }] });
  if (!result.ok) return result;
  const data = normalize(parseJsonReply<Partial<MealAnalysis>>(result.data.content));
  return data ? { ok: true, data } : { ok: false, error: "Couldn't estimate that. Try describing it a little differently." };
}
