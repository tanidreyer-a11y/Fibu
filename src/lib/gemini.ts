import { db } from './db';

const MODEL = 'gemini-3.6-flash'; // free-tier Flash model as of Sept 2026 — 2.5-flash was retired for new users
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export type GeminiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function getGeminiKey(): Promise<string | undefined> {
  const settings = await db.settings.get('app');
  return settings?.geminiApiKey?.trim() || undefined;
}

export async function hasGeminiKey(): Promise<boolean> {
  return (await getGeminiKey()) !== undefined;
}

interface GenerateOptions {
  /** Force a JSON response matching this shape hint (Gemini's structured-output mode). */
  json?: boolean;
  /** Inline image to send alongside the prompt (for vision calls — meal photos in Phase 3). */
  image?: { base64: string; mimeType: string };
  temperature?: number;
}

async function callGemini(prompt: string, opts: GenerateOptions = {}): Promise<GeminiResult<string>> {
  const key = await getGeminiKey();
  if (!key) return { ok: false, error: 'No Gemini API key set. Add one in Settings.' };

  const parts: unknown[] = [{ text: prompt }];
  if (opts.image) {
    parts.push({ inlineData: { mimeType: opts.image.mimeType, data: opts.image.base64 } });
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      ...(opts.json ? { responseMimeType: 'application/json' } : {}),
    },
  };

  let res: Response;
  try {
    // Newer "AQ."-prefixed auth keys 404 on the old ?key= query param — the
    // x-goog-api-key header works for both that format and the legacy AIza keys.
    res = await fetch(`${API_BASE}/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: 'Could not reach Gemini — check your connection.' };
  }

  if (res.status === 400 || res.status === 403) {
    return { ok: false, error: 'Gemini rejected that key. Double-check it in Settings.' };
  }
  if (res.status === 429) {
    return { ok: false, error: "You've hit Gemini's free-tier rate limit — try again in a minute." };
  }
  if (!res.ok) {
    return { ok: false, error: `Gemini error (${res.status}). Try again shortly.` };
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  if (!text) return { ok: false, error: 'Gemini returned an empty response.' };
  return { ok: true, data: text };
}

export async function generateText(prompt: string, temperature?: number): Promise<GeminiResult<string>> {
  return callGemini(prompt, { temperature });
}

export async function generateJSON<T>(prompt: string, temperature?: number): Promise<GeminiResult<T>> {
  const result = await callGemini(prompt, { json: true, temperature });
  if (!result.ok) return result;
  try {
    return { ok: true, data: JSON.parse(result.data) as T };
  } catch {
    return { ok: false, error: "Gemini's response wasn't valid JSON." };
  }
}

export async function generateFromImage(
  prompt: string,
  image: { base64: string; mimeType: string },
  json = false,
): Promise<GeminiResult<string>> {
  return callGemini(prompt, { image, json });
}
