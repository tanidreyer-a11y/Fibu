// Fibu's AI proxy. The browser never holds a key: it posts OpenAI-style chat
// messages here and this forwards them to Groq (primary) or Gemini (fallback).
// The same `runAi` core is mounted by the Vite dev server (see vite.config.ts).

export interface AiEnv {
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

type Role = 'system' | 'user' | 'assistant' | 'tool';

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
  extra_content?: unknown;
}

interface ChatMessage {
  role: Role;
  content: unknown;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface AiRequest {
  messages: ChatMessage[];
  tools?: unknown[];
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export type AiResponse =
  | { ok: true; provider: 'groq' | 'gemini'; message: { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] } }
  | { ok: false; error: 'bad_request' | 'too_large' | 'rate_limited' | 'upstream' | 'not_configured'; detail?: string };

const LIMITS = {
  bodyBytes: 4_000_000, // Vercel caps function bodies at 4.5 MB
  messages: 60,
  tools: 24,
  images: 3, // Groq's vision models accept at most 3 images per request
  imageChars: 1_800_000, // ~1.3 MB JPEG once base64-encoded; client downscales to ~1024px first
  maxTokens: 2048,
};

const GROQ = {
  url: 'https://api.groq.com/openai/v1/chat/completions',
  model: 'qwen/qwen3.8-27b',
};
const GEMINI = {
  url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  model: 'gemini-3.6-flash',
};

// Gemini 3 requires a thought signature on every replayed tool call. Calls that
// came from Groq don't have one, so they get Google's documented bypass value.
const GEMINI_SIGNATURE_BYPASS = { google: { thought_signature: 'skip_thought_signature_validator' } };

function validate(body: unknown): { ok: true; req: AiRequest } | { ok: false; status: number; res: AiResponse } {
  const bad = (detail: string, status = 400): { ok: false; status: number; res: AiResponse } => ({
    ok: false,
    status,
    res: { ok: false, error: status === 413 ? 'too_large' : 'bad_request', detail },
  });
  if (!body || typeof body !== 'object') return bad('Body must be a JSON object');
  const req = body as AiRequest;
  if (!Array.isArray(req.messages) || req.messages.length === 0) return bad('messages is required');
  if (req.messages.length > LIMITS.messages) return bad('Too many messages', 413);
  if (req.tools !== undefined && (!Array.isArray(req.tools) || req.tools.length > LIMITS.tools)) return bad('Invalid tools');

  let images = 0;
  for (const m of req.messages) {
    if (!m || !['system', 'user', 'assistant', 'tool'].includes(m.role)) return bad('Invalid message role');
    if (Array.isArray(m.content)) {
      for (const part of m.content as { type?: string; image_url?: { url?: string } }[]) {
        if (part?.type !== 'image_url') continue;
        images++;
        const url = part.image_url?.url ?? '';
        if (!url.startsWith('data:image/')) return bad('Images must be data URLs');
        if (url.length > LIMITS.imageChars) return bad('Image too large', 413);
      }
    }
  }
  if (images > LIMITS.images) return bad('Too many images', 413);
  return { ok: true, req };
}

function providerBody(provider: 'groq' | 'gemini', req: AiRequest): Record<string, unknown> {
  const messages = req.messages.map((m) => {
    if (!m.tool_calls) return m;
    const tool_calls = m.tool_calls.map((tc) => {
      if (provider === 'groq') {
        const { extra_content: _drop, ...rest } = tc;
        return rest;
      }
      return tc.extra_content ? tc : { ...tc, extra_content: GEMINI_SIGNATURE_BYPASS };
    });
    return { ...m, tool_calls };
  });

  const body: Record<string, unknown> = { messages };
  if (req.tools?.length) {
    body.tools = req.tools;
    body.tool_choice = 'auto';
  }
  if (req.json) body.response_format = { type: 'json_object' };

  if (provider === 'groq') {
    body.model = GROQ.model;
    body.temperature = typeof req.temperature === 'number' ? Math.min(Math.max(req.temperature, 0), 1.5) : 0.6;
    body.max_completion_tokens = Math.min(req.maxTokens ?? 1024, LIMITS.maxTokens);
    // Qwen thinks by default; for logging and short coaching replies that only adds latency.
    body.reasoning_effort = 'none';
  } else {
    body.model = GEMINI.model;
    // Gemini 3 is tuned for its default temperature; lowering it can cause loops.
    body.reasoning_effort = 'low';
  }
  return body;
}

interface Attempt {
  ok: boolean;
  status: number;
  message?: { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] };
  detail?: string;
}

async function callProvider(provider: 'groq' | 'gemini', key: string, req: AiRequest): Promise<Attempt> {
  const target = provider === 'groq' ? GROQ : GEMINI;
  let res: Response;
  try {
    res = await fetch(target.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(providerBody(provider, req)),
      signal: AbortSignal.timeout(provider === 'groq' ? 25_000 : 40_000),
    });
  } catch (err) {
    return { ok: false, status: 0, detail: `${provider}: ${(err as Error).name}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, status: res.status, detail: `${provider} ${res.status}: ${text.slice(0, 300)}` };
  }

  const json = (await res.json().catch(() => null)) as { choices?: { message?: Attempt['message'] }[] } | null;
  const msg = json?.choices?.[0]?.message;
  if (!msg || (!msg.content && !msg.tool_calls?.length)) {
    return { ok: false, status: 502, detail: `${provider}: empty response` };
  }
  return {
    ok: true,
    status: 200,
    message: {
      role: 'assistant',
      content: typeof msg.content === 'string' ? msg.content : null,
      ...(msg.tool_calls?.length ? { tool_calls: msg.tool_calls } : {}),
    },
  };
}

export async function runAi(body: unknown, env: AiEnv): Promise<{ status: number; res: AiResponse }> {
  const checked = validate(body);
  if (!checked.ok) return { status: checked.status, res: checked.res };

  const providers = (
    [
      ['groq', env.GROQ_API_KEY?.trim()],
      ['gemini', env.GEMINI_API_KEY?.trim()],
    ] as const
  ).filter((p): p is readonly ['groq' | 'gemini', string] => Boolean(p[1]));

  if (providers.length === 0) return { status: 503, res: { ok: false, error: 'not_configured' } };

  const failures: Attempt[] = [];
  for (const [name, key] of providers) {
    const attempt = await callProvider(name, key, checked.req);
    if (attempt.ok && attempt.message) return { status: 200, res: { ok: true, provider: name, message: attempt.message } };
    failures.push(attempt);
    console.warn('[ai] provider failed', attempt.detail);
  }

  const rateLimited = failures.some((f) => f.status === 429);
  return {
    status: rateLimited ? 429 : 502,
    res: { ok: false, error: rateLimited ? 'rate_limited' : 'upstream' },
  };
}

export function aiStatus(env: AiEnv) {
  return { groq: Boolean(env.GROQ_API_KEY?.trim()), gemini: Boolean(env.GEMINI_API_KEY?.trim()) };
}

// Best-effort per-instance throttle so one leaked tab can't drain the daily quota.
const hits = new Map<string, number[]>();
function throttled(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) hits.clear();
  return recent.length > 30;
}

function isSameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const env: AiEnv = { GROQ_API_KEY: process.env.GROQ_API_KEY, GEMINI_API_KEY: process.env.GEMINI_API_KEY };

    if (request.method === 'GET') return Response.json(aiStatus(env));
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } });
    if (!isSameOrigin(request)) return Response.json({ ok: false, error: 'bad_request', detail: 'Cross-origin' }, { status: 403 });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (throttled(ip)) return Response.json({ ok: false, error: 'rate_limited' } satisfies AiResponse, { status: 429 });

    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > LIMITS.bodyBytes) return Response.json({ ok: false, error: 'too_large' } satisfies AiResponse, { status: 413 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ ok: false, error: 'bad_request', detail: 'Invalid JSON' } satisfies AiResponse, { status: 400 });
    }

    const { status, res } = await runAi(body, env);
    return Response.json(res, { status, headers: { 'Cache-Control': 'no-store' } });
  },
};
