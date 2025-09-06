// supabase/functions/_shared/providers.ts
// Unified provider adapters for OpenAI, Anthropic, Google Gemini.
// All calls are SERVER-SIDE ONLY. Never expose keys client-side.

type Role = 'user' | 'assistant' | 'system';

export type ChatArgs = {
  model: string;
  messages: Array<{ role: Role; content: string }>;
  temperature?: number;
  max_tokens?: number;
};

export type ChatOut = {
  text: string;
  tokensIn: number;
  tokensOut: number;
  finishReason: string;
};

// ---------- Small utilities ----------

export class ProviderError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function nowMs() { return Date.now(); }

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeoutRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number; retries?: number } = {},
): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? 15000;
  const retries = init.retries ?? 1;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ac.signal });
      clearTimeout(t);
      return res;
    } catch (err) {
      clearTimeout(t);
      if (attempt === retries) throw err;
      await delay(250);
    }
  }
  // Unreachable
  throw new Error('UNREACHABLE_FETCH');
}

function mapHttpToCode(provider: 'openai' | 'anthropic' | 'google', status: number): ProviderError {
  if (status === 400) return new ProviderError('BAD_INPUT', `${provider}: bad input`, 400);
  if (status === 401 || status === 403) return new ProviderError('UNAUTHORIZED', `${provider}: unauthorized`, 401);
  if (status === 404) return new ProviderError('NOT_FOUND', `${provider}: not found`, 404);
  if (status === 409) return new ProviderError('CONFLICT', `${provider}: conflict`, 409);
  if (status === 429) return new ProviderError('RATE_LIMITED', `${provider}: rate limited`, 429);
  if (status >= 500) return new ProviderError('SERVICE_UNAVAILABLE', `${provider}: upstream error`, 503);
  return new ProviderError('INTERNAL', `${provider}: unexpected ${status}`, status);
}

// NOTE: Realtime models (e.g., gpt-realtime) require WS/WebRTC channels, not this HTTP path.
export function isHttpUnsupportedModel(model: string): boolean {
  return model === 'gpt-realtime';
}

export function resolveProvider(model: string): 'openai' | 'anthropic' | 'google' | 'unknown' {
  if (model.startsWith('gpt-')) return 'openai';
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('models/gemini')) return 'google';
  return 'unknown';
}

export function isProviderAvailable(p: 'openai' | 'anthropic' | 'google'): boolean {
  if (p === 'openai') return !!Deno.env.get('OPENAI_API_KEY');
  if (p === 'anthropic') return !!Deno.env.get('ANTHROPIC_API_KEY');
  if (p === 'google') return !!Deno.env.get('GOOGLE_API_KEY');
  return false;
}

// ---------- OpenAI ----------

export async function callOpenAI(args: ChatArgs): Promise<ChatOut> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new ProviderError('NO_API_KEY', 'OpenAI key missing', 401);
  if (isHttpUnsupportedModel(args.model)) {
    throw new ProviderError('BAD_INPUT', 'gpt-realtime requires a realtime channel', 400);
  }

  const started = nowMs();
  const body = {
    model: args.model,
    messages: args.messages,
    temperature: args.temperature ?? 0.3,
    max_tokens: args.max_tokens ?? 512,
    stream: false,
  };

  const res = await fetchWithTimeoutRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    timeoutMs: 15000,
    retries: 1,
  });

  if (!res.ok) throw mapHttpToCode('openai', res.status);

  const json = await res.json();
  const choice = json?.choices?.[0];
  const text = choice?.message?.content ?? '';
  const usage = json?.usage || {};
  const out: ChatOut = {
    text,
    tokensIn: usage.prompt_tokens ?? 0,
    tokensOut: usage.completion_tokens ?? 0,
    finishReason: choice?.finish_reason ?? 'stop',
  };
  // you can log latency (nowMs() - started) in caller
  return out;
}

// ---------- Anthropic ----------

export async function callAnthropic(args: ChatArgs): Promise<ChatOut> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new ProviderError('NO_API_KEY', 'Anthropic key missing', 401);

  // Convert OpenAI-style messages -> Anthropic format (nearly identical roles)
  const messages = args.messages.map((m) => ({ role: m.role, content: m.content }));

  const res = await fetchWithTimeoutRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: args.max_tokens ?? 512,
      temperature: args.temperature ?? 0.3,
      messages,
    }),
    timeoutMs: 15000,
    retries: 1,
  });

  if (!res.ok) throw mapHttpToCode('anthropic', res.status);

  const json = await res.json();
  const text = json?.content?.[0]?.text ?? '';
  const usage = json?.usage || {};
  return {
    text,
    tokensIn: usage.input_tokens ?? 0,
    tokensOut: usage.output_tokens ?? 0,
    finishReason: json?.stop_reason ?? 'stop',
  };
}

// ---------- Google Gemini ----------

export async function callGemini(args: ChatArgs): Promise<ChatOut> {
  const key = Deno.env.get('GOOGLE_API_KEY');
  if (!key) throw new ProviderError('NO_API_KEY', 'Google Gemini key missing', 401);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent?key=${key}`;
  const contents = args.messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  const res = await fetchWithTimeoutRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: args.temperature ?? 0.3,
        maxOutputTokens: args.max_tokens ?? 512,
      },
    }),
    timeoutMs: 15000,
    retries: 1,
  });

  if (!res.ok) throw mapHttpToCode('google', res.status);

  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p: any) => p?.text ?? '').join('');

  // Gemini may omit usage; default to 0 when absent
  return {
    text,
    tokensIn: json?.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: json?.usageMetadata?.candidatesTokenCount ?? 0,
    finishReason: json?.candidates?.[0]?.finishReason ?? 'stop',
  };
}