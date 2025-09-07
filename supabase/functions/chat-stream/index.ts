import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { 
  corsHeaders,
  setupChatRequest,
  processCommonValidation,
  createErrorResponse,
  type ChatContext,
  type ChatConfirmRequest
} from "../_shared/chat-common.ts";
import { 
  callOpenAI,
  callAnthropic, 
  callGemini,
  resolveProvider,
  isProviderAvailable
} from "../_shared/providers.ts";

interface StreamEvent {
  type: 'delta' | 'done' | 'error' | 'cost';
  data?: any;
  delta?: string;
  cost?: number;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default async function handler(req: Request): Promise<Response> {
  console.log('🚀 Chat stream request received');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Setup request context
    const { corrId, userId, supabaseClient } = await setupChatRequest(req);
    console.log(`📋 Request setup completed - corrId: ${corrId}, userId: ${userId}`);

    const requestData: ChatConfirmRequest = await req.json();
    console.log('📥 Request data:', { ...requestData, message: requestData.message?.substring(0, 100) + '...' });

    // Process validation and wallet deduction
    const supportedModels = ['gpt-4o', 'gpt-4o-mini', 'claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    const context: ChatContext = await processCommonValidation(
      supabaseClient,
      userId,
      corrId,
      requestData,
      supportedModels
    );
    console.log('✅ Validation completed, proceeding with streaming');

    // Determine provider
    const provider = resolveProvider(requestData.model);
    console.log(`🔧 Using provider: ${provider} for model: ${requestData.model}`);

    if (!isProviderAvailable(provider)) {
      throw new Error(`Provider ${provider} is not available - API key not configured`);
    }

    // Create Server-Sent Events response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const sendEvent = (event: StreamEvent) => {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        };

        try {
          console.log('🎯 Starting streaming response');
          
          // Prepare chat arguments
          const chatArgs = {
            model: requestData.model,
            messages: [
              { role: 'user', content: requestData.message }
            ],
            temperature: requestData.temperature || 0.8,
            max_tokens: requestData.max_tokens || 2048,
            stream: true
          };

          let fullResponse = '';
          let tokensIn = 0;
          let tokensOut = 0;

          // Call appropriate provider with streaming
          if (provider === 'openai') {
            await streamOpenAI(chatArgs, sendEvent, (response, tIn, tOut) => {
              fullResponse = response;
              tokensIn = tIn;
              tokensOut = tOut;
            });
          } else if (provider === 'anthropic') {
            await streamAnthropic(chatArgs, sendEvent, (response, tIn, tOut) => {
              fullResponse = response;
              tokensIn = tIn;
              tokensOut = tOut;
            });
          } else if (provider === 'google') {
            await streamGemini(chatArgs, sendEvent, (response, tIn, tOut) => {
              fullResponse = response;
              tokensIn = tIn;
              tokensOut = tOut;
            });
          }

          console.log(`✅ Streaming completed - tokensIn: ${tokensIn}, tokensOut: ${tokensOut}`);

          // Send final cost update
          sendEvent({
            type: 'cost',
            tokensIn,
            tokensOut,
            cost: context.deductedCostINR
          });

          // Send completion event
          sendEvent({
            type: 'done',
            data: {
              response: fullResponse,
              tokensIn,
              tokensOut,
              cost: context.deductedCostINR
            }
          });

          controller.close();

        } catch (error) {
          console.error('❌ Streaming error:', error);
          sendEvent({
            type: 'error',
            error: error instanceof Error ? error.message : 'Streaming failed'
          });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
      },
    });

  } catch (error) {
    console.error('❌ Chat stream setup failed:', error);
    return createErrorResponse("", error);
  }
}

// OpenAI Streaming Implementation
async function streamOpenAI(
  chatArgs: any,
  sendEvent: (event: StreamEvent) => void,
  onComplete: (response: string, tokensIn: number, tokensOut: number) => void
) {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  console.log('🔄 Starting OpenAI streaming...');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...chatArgs,
      stream: true
    }),
  });

  if (!response.body) {
    throw new Error('No response body from OpenAI');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let tokensIn = 0;
  let tokensOut = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));

      for (const line of lines) {
        const data = line.replace('data: ', '');
        if (data === '[DONE]') {
          onComplete(fullText, tokensIn, tokensOut);
          return;
        }

        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0]?.delta?.content) {
            const delta = parsed.choices[0].delta.content;
            fullText += delta;
            tokensOut++;

            sendEvent({
              type: 'delta',
              delta
            });
          }

          if (parsed.usage) {
            tokensIn = parsed.usage.prompt_tokens || 0;
            tokensOut = parsed.usage.completion_tokens || 0;
          }
        } catch (e) {
          // Skip invalid JSON chunks
          continue;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  onComplete(fullText, tokensIn, tokensOut);
}

// Anthropic Streaming Implementation  
async function streamAnthropic(
  chatArgs: any,
  sendEvent: (event: StreamEvent) => void,
  onComplete: (response: string, tokensIn: number, tokensOut: number) => void
) {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  console.log('🔄 Starting Anthropic streaming...');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: chatArgs.model,
      max_tokens: chatArgs.max_tokens,
      messages: chatArgs.messages,
      stream: true
    }),
  });

  if (!response.body) {
    throw new Error('No response body from Anthropic');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let tokensIn = 0;
  let tokensOut = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));

      for (const line of lines) {
        const data = line.replace('data: ', '');
        
        try {
          const parsed = JSON.parse(data);
          
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            const delta = parsed.delta.text;
            fullText += delta;
            tokensOut++;

            sendEvent({
              type: 'delta',
              delta
            });
          }

          if (parsed.type === 'message_stop') {
            onComplete(fullText, tokensIn, tokensOut);
            return;
          }

          if (parsed.usage) {
            tokensIn = parsed.usage.input_tokens || 0;
            tokensOut = parsed.usage.output_tokens || 0;
          }
        } catch (e) {
          // Skip invalid JSON chunks
          continue;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  onComplete(fullText, tokensIn, tokensOut);
}

// Google Gemini Streaming Implementation
async function streamGemini(
  chatArgs: any,
  sendEvent: (event: StreamEvent) => void,
  onComplete: (response: string, tokensIn: number, tokensOut: number) => void
) {
  const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
  if (!googleApiKey) {
    throw new Error('GOOGLE_API_KEY not configured');
  }

  console.log('🔄 Starting Gemini streaming...');

  // For now, use non-streaming for Gemini and simulate streaming
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${chatArgs.model}:generateContent?key=${googleApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: chatArgs.messages[0].content }]
      }],
      generationConfig: {
        temperature: chatArgs.temperature,
        maxOutputTokens: chatArgs.max_tokens,
      }
    }),
  });

  const data = await response.json();
  const fullText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // Simulate streaming by sending chunks
  const words = fullText.split(' ');
  for (let i = 0; i < words.length; i++) {
    const word = (i === 0 ? '' : ' ') + words[i];
    sendEvent({
      type: 'delta',
      delta: word
    });
    // Small delay to simulate real streaming
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  onComplete(fullText, words.length, words.length);
}