// Client for Fibu's AI proxy (/api/ai). Keys live on the server; the browser
// only ever sends OpenAI-style messages and gets an assistant message back.

export type AiContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export interface AiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
  /** Provider metadata (Gemini thought signature) — must be sent back untouched. */
  extra_content?: unknown;
}

export type AiMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | AiContentPart[] }
  | { role: 'assistant'; content: string | null; tool_calls?: AiToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type AiAssistantMessage = Extract<AiMessage, { role: 'assistant' }>;

export interface AiTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface AiChatRequest {
  messages: AiMessage[];
  tools?: AiTool[];
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export type AiResult<T> = { ok: true; data: T } | { ok: false; error: string };

const ERROR_TEXT: Record<string, string> = {
  rate_limited: "Fibu's AI is getting a lot of requests — give it a minute and try again.",
  too_large: 'That photo is too big to send — try again.',
  not_configured: "Fibu's AI isn't switched on yet.",
  upstream: "Fibu's AI had a hiccup — try again in a moment.",
  bad_request: "Fibu's AI couldn't read that request.",
};

export async function aiChat(request: AiChatRequest): Promise<AiResult<AiAssistantMessage>> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, error: "You're offline — Fibu's AI needs a connection." };
  }
  let res: Response;
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    return { ok: false, error: "Couldn't reach Fibu's AI — check your connection." };
  }

  const body = (await res.json().catch(() => null)) as
    | { ok: true; message: AiAssistantMessage }
    | { ok: false; error: string }
    | null;
  if (!body) return { ok: false, error: ERROR_TEXT.upstream };
  if (!body.ok) return { ok: false, error: ERROR_TEXT[body.error] ?? ERROR_TEXT.upstream };
  return { ok: true, data: body.message };
}

/** Pulls a JSON object out of a model reply, tolerating ```json fences or stray prose. */
export function parseJsonReply<T>(text: string | null): T | null {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export async function generateText(prompt: string, temperature?: number): Promise<AiResult<string>> {
  const result = await aiChat({ messages: [{ role: 'user', content: prompt }], temperature });
  if (!result.ok) return result;
  const text = result.data.content?.trim();
  return text ? { ok: true, data: text } : { ok: false, error: ERROR_TEXT.upstream };
}

export async function generateJSON<T>(prompt: string, temperature?: number): Promise<AiResult<T>> {
  const result = await aiChat({ messages: [{ role: 'user', content: prompt }], json: true, temperature });
  if (!result.ok) return result;
  const data = parseJsonReply<T>(result.data.content);
  return data ? { ok: true, data } : { ok: false, error: "Fibu's AI sent back something unreadable — try again." };
}

export async function generateFromImage(prompt: string, imageDataUrl: string, json = false): Promise<AiResult<string>> {
  const result = await aiChat({
    json,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ],
  });
  if (!result.ok) return result;
  const text = result.data.content?.trim();
  return text ? { ok: true, data: text } : { ok: false, error: ERROR_TEXT.upstream };
}

export async function getAiStatus(): Promise<{ groq: boolean; gemini: boolean } | null> {
  try {
    const res = await fetch('/api/ai', { method: 'GET', cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as { groq: boolean; gemini: boolean };
  } catch {
    return null;
  }
}
