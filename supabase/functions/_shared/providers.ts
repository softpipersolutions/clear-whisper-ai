// Real provider adapters for OpenAI, Anthropic, and Google Gemini
// Server-side only - never expose API keys to client

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatArgs {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface ChatOut {
  text: string;
  tokensIn: number;
  tokensOut: number;
  finishReason: string;
}

// Error code mapping for consistent responses
export function mapProviderError(error: any, provider: string): string {
  const message = error.message?.toLowerCase() || '';
  
  if (error.status === 401 || message.includes('unauthorized') || message.includes('invalid api key')) {
    return 'UNAUTHORIZED';
  }
  if (error.status === 400 || message.includes('bad request') || message.includes('invalid')) {
    return 'BAD_INPUT';
  }
  if (error.status === 429 || message.includes('rate limit') || message.includes('quota')) {
    return 'RATE_LIMITED';
  }
  if (error.status >= 500 || message.includes('service unavailable') || message.includes('timeout')) {
    return 'SERVICE_UNAVAILABLE';
  }
  
  return 'INTERNAL';
}

// Retry logic with timeout and backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  timeoutMs = 15000,
  maxRetries = 1
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const result = await operation();
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Backoff delay before retry
      await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  
  throw new Error(`${operationName} failed after ${maxRetries + 1} attempts`);
}

export async function callOpenAI(args: ChatArgs): Promise<ChatOut> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('NO_API_KEY: OpenAI API key not configured');
  }

  const operation = async () => {
    const controller = new AbortController();
    
    // Determine if this is a newer model that uses max_completion_tokens
    const isNewerModel = ['gpt-5', 'gpt-4.1', 'o3', 'o4'].some(prefix => 
      args.model.startsWith(prefix)
    );
    
    const requestBody: any = {
      model: args.model,
      messages: args.messages,
    };
    
    // Use appropriate token parameter based on model
    if (args.max_tokens) {
      if (isNewerModel) {
        requestBody.max_completion_tokens = args.max_tokens;
      } else {
        requestBody.max_tokens = args.max_tokens;
      }
    }
    
    // Only add temperature for older models
    if (args.temperature !== undefined && !isNewerModel) {
      requestBody.temperature = args.temperature;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      const error = new Error(`OpenAI API error: ${response.status}`);
      (error as any).status = response.status;
      throw error;
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid OpenAI response format');
    }

    return {
      text: data.choices[0].message.content || '',
      tokensIn: data.usage?.prompt_tokens || 0,
      tokensOut: data.usage?.completion_tokens || 0,
      finishReason: data.choices[0].finish_reason || 'unknown'
    };
  };

  try {
    return await withRetry(operation, 'OpenAI API call');
  } catch (error) {
    const errorCode = mapProviderError(error, 'openai');
    const enhancedError = new Error(`${errorCode}: ${error.message}`);
    (enhancedError as any).status = (error as any).status;
    throw enhancedError;
  }
}

export async function callAnthropic(args: ChatArgs): Promise<ChatOut> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('NO_API_KEY: Anthropic API key not configured');
  }

  const operation = async () => {
    const controller = new AbortController();
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: args.model,
        max_tokens: args.max_tokens || 1000,
        temperature: args.temperature,
        messages: args.messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      const error = new Error(`Anthropic API error: ${response.status}`);
      (error as any).status = response.status;
      throw error;
    }

    const data = await response.json();
    
    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('Invalid Anthropic response format');
    }

    return {
      text: data.content[0].text,
      tokensIn: data.usage?.input_tokens || 0,
      tokensOut: data.usage?.output_tokens || 0,
      finishReason: data.stop_reason || 'unknown'
    };
  };

  try {
    return await withRetry(operation, 'Anthropic API call');
  } catch (error) {
    const errorCode = mapProviderError(error, 'anthropic');
    const enhancedError = new Error(`${errorCode}: ${error.message}`);
    (enhancedError as any).status = (error as any).status;
    throw enhancedError;
  }
}

export async function callGemini(args: ChatArgs): Promise<ChatOut> {
  const apiKey = Deno.env.get('GOOGLE_API_KEY');
  if (!apiKey) {
    throw new Error('NO_API_KEY: Google API key not configured');
  }

  const operation = async () => {
    const controller = new AbortController();
    
    // Convert messages to Gemini format
    const contents = args.messages.map(message => ({
      role: message.role === 'assistant' ? 'model' : message.role,
      parts: [{ text: message.content }]
    }));

    const requestBody: any = {
      contents,
    };

    if (args.temperature !== undefined || args.max_tokens !== undefined) {
      requestBody.generationConfig = {};
      if (args.temperature !== undefined) {
        requestBody.generationConfig.temperature = args.temperature;
      }
      if (args.max_tokens !== undefined) {
        requestBody.generationConfig.maxOutputTokens = args.max_tokens;
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${args.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Gemini API error:', errorText);
      const error = new Error(`Google Gemini API error: ${response.status}`);
      (error as any).status = response.status;
      throw error;
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
      throw new Error('Invalid Google Gemini response format');
    }

    const text = data.candidates[0].content.parts[0]?.text || '';
    
    return {
      text,
      tokensIn: data.usageMetadata?.promptTokenCount || 0,
      tokensOut: data.usageMetadata?.candidatesTokenCount || 0,
      finishReason: data.candidates[0].finishReason || 'unknown'
    };
  };

  try {
    return await withRetry(operation, 'Google Gemini API call');
  } catch (error) {
    const errorCode = mapProviderError(error, 'google');
    const enhancedError = new Error(`${errorCode}: ${error.message}`);
    (enhancedError as any).status = (error as any).status;
    throw enhancedError;
  }
}