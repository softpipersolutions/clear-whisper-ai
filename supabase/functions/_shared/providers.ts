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

function mapHttpToCode(provider: 'openai' | 'anthropic' | 'google', status: number, message?: string): ProviderError {
  const errorMessage = message || `${provider}: HTTP ${status}`;
  if (status === 400) return new ProviderError('BAD_INPUT', errorMessage, 400);
  if (status === 401 || status === 403) return new ProviderError('UNAUTHORIZED', errorMessage, 401);
  if (status === 404) return new ProviderError('NOT_FOUND', errorMessage, 404);
  if (status === 409) return new ProviderError('CONFLICT', errorMessage, 409);
  if (status === 429) return new ProviderError('RATE_LIMITED', errorMessage, 429);
  if (status >= 500) return new ProviderError('SERVICE_UNAVAILABLE', errorMessage, 503);
  return new ProviderError('INTERNAL', errorMessage, status);
}

// NOTE: Realtime models (e.g., gpt-realtime) require WS/WebRTC channels, not this HTTP path.
export function isHttpUnsupportedModel(model: string): boolean {
  return model === 'gpt-realtime';
}

export function resolveProvider(model: string): 'openai' | 'anthropic' | 'google' | 'unknown' {
  if (model.startsWith('gpt-') || model.startsWith('o1-') || model.startsWith('o3-') || model.startsWith('o4-')) return 'openai';
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('models/gemini') || model.startsWith('gemini')) return 'google';
  return 'unknown';
}

export function isProviderAvailable(p: 'openai' | 'anthropic' | 'google'): boolean {
  if (p === 'openai') return !!Deno.env.get('OPENAI_API_KEY');
  if (p === 'anthropic') return !!Deno.env.get('ANTHROPIC_API_KEY');
  if (p === 'google') return !!Deno.env.get('GOOGLE_API_KEY');
  return false;
}

// ---------- OpenAI ----------

export async function callOpenAI(args: ChatArgs | any): Promise<ChatOut> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new ProviderError('NO_API_KEY', 'OpenAI key missing', 401);
  if (isHttpUnsupportedModel(args.model)) {
    throw new ProviderError('BAD_INPUT', 'gpt-realtime requires a realtime channel', 400);
  }

  const started = nowMs();
  
  // Build request body from args - support all possible OpenAI parameters
  const body: any = {
    model: args.model,
    messages: args.messages,
    stream: args.stream || false,
  };

  // Handle model-specific parameter requirements
  const isGPT5Series = args.model?.startsWith('gpt-5');
  const isGPT41Series = args.model?.startsWith('gpt-4.1');
  const isReasoningModel = args.model?.startsWith('o1') || args.model?.startsWith('o3') || args.model?.startsWith('o4');
  const isLegacyModel = args.model?.startsWith('gpt-4o') || args.model?.startsWith('gpt-4');

  // Temperature handling - only for models that support it
  if (args.temperature !== undefined && (isLegacyModel || isGPT41Series)) {
    body.temperature = args.temperature;
  }
  // GPT-5 and reasoning models don't support custom temperature (they use default 1.0)

  // Token limit handling (different parameter names for different model families)
  if (args.max_tokens !== undefined) {
    if (isGPT5Series || isReasoningModel) {
      body.max_completion_tokens = args.max_tokens;
    } else {
      body.max_tokens = args.max_tokens;
    }
  }

  // Direct max_completion_tokens support
  if (args.max_completion_tokens !== undefined) {
    body.max_completion_tokens = args.max_completion_tokens;
  }

  // Other parameters (not supported by reasoning models)
  if (!isReasoningModel) {
    if (args.top_p !== undefined) body.top_p = args.top_p;
    if (args.frequency_penalty !== undefined) body.frequency_penalty = args.frequency_penalty;
    if (args.presence_penalty !== undefined) body.presence_penalty = args.presence_penalty;
    if (args.stop) body.stop = args.stop;
    if (args.tools) {
      body.tools = args.tools;
      if (args.tool_choice) body.tool_choice = args.tool_choice;
    }
  }

  // GPT-5 specific parameters
  if (isGPT5Series) {
    if (args.reasoning_effort) body.reasoning_effort = args.reasoning_effort;
    if (args.verbosity) body.verbosity = args.verbosity;
  }

  // Set reasonable defaults if nothing specified
  if (body.max_tokens === undefined && body.max_completion_tokens === undefined) {
    if (isGPT5Series || isReasoningModel) {
      body.max_completion_tokens = 512;
    } else {
      body.max_tokens = 512;
    }
  }

  // Only set default temperature for models that support it
  if (body.temperature === undefined && (isLegacyModel || isGPT41Series)) {
    body.temperature = 0.3;
  }

  console.log('🚀 OpenAI API request body:', JSON.stringify(body, null, 2));

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

  if (!res.ok) {
    const errorText = await res.text();
    console.error('❌ OpenAI API error:', res.status, errorText);
    
    let errorMessage = `HTTP ${res.status}`;
    try {
      const error = JSON.parse(errorText);
      errorMessage = error.error?.message || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    throw mapHttpToCode('openai', res.status, errorMessage);
  }

  const json = await res.json();
  console.log('✅ OpenAI API success, tokens used:', json.usage);
  
  const choice = json?.choices?.[0];
  const text = choice?.message?.content ?? '';
  const usage = json?.usage || {};
  const out: ChatOut = {
    text,
    tokensIn: usage.prompt_tokens ?? 0,
    tokensOut: usage.completion_tokens ?? 0,
    finishReason: choice?.finish_reason ?? 'stop',
  };
  
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

export async function callGemini(args: any): Promise<ChatOut> {
  const key = Deno.env.get('GOOGLE_API_KEY');
  if (!key) throw new ProviderError('NO_API_KEY', 'Google Gemini key missing', 401);

  // Clean model name - remove models/ prefix if present for URL construction
  let modelName = args.model;
  if (modelName.startsWith('models/')) {
    modelName = modelName.substring(7); // Remove 'models/' prefix
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${key}`;
  
  // Build request body - support Gemini's native format
  const body: any = {};

  // Handle contents (Gemini's message format)
  if (args.contents) {
    body.contents = args.contents;
  } else if (args.messages) {
    // Convert ChatArgs messages to Gemini contents format
    body.contents = args.messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: m.content }],
    }));
  }

  // System instructions
  if (args.systemInstruction) {
    body.systemInstruction = args.systemInstruction;
  }

  // Generation configuration
  if (args.generationConfig || args.temperature !== undefined || args.max_tokens !== undefined) {
    body.generationConfig = args.generationConfig || {};
    
    if (args.temperature !== undefined && !body.generationConfig.temperature) {
      body.generationConfig.temperature = args.temperature;
    }
    
    if (args.max_tokens !== undefined && !body.generationConfig.maxOutputTokens) {
      body.generationConfig.maxOutputTokens = args.max_tokens;
    }

    // Apply defaults if nothing specified
    if (!body.generationConfig.temperature && !body.generationConfig.maxOutputTokens) {
      body.generationConfig.temperature = 0.3;
      body.generationConfig.maxOutputTokens = 512;
    }
  }

  // Safety settings
  if (args.safetySettings) {
    body.safetySettings = args.safetySettings;
  }

  // Tools (function calling)
  if (args.tools) {
    body.tools = args.tools;
  }

  console.log('🚀 Gemini API request body:', JSON.stringify(body, null, 2));

  const res = await fetchWithTimeoutRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 15000,
    retries: 1,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('❌ Gemini API error:', res.status, errorText);
    
    let errorMessage = `HTTP ${res.status}`;
    try {
      const error = JSON.parse(errorText);
      errorMessage = error.error?.message || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    throw mapHttpToCode('google', res.status, errorMessage);
  }

  const json = await res.json();
  console.log('✅ Gemini API success, usage:', json.usageMetadata);
  
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