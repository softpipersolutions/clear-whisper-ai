import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callOpenAI, ProviderError } from "../_shared/providers.ts";
import { corsHeaders, setupChatRequest, processCommonValidation, rollbackWallet, createSuccessResponse, createErrorResponse } from "../_shared/chat-common.ts";
import { logOpsEvent } from "../_shared/hardening.ts";

// Correct OpenAI model names (as of current API)
const OPENAI_MODELS = [
  // GPT-5 series (newest)
  'gpt-5-2025-08-07',
  'gpt-5-mini-2025-08-07',
  'gpt-5-nano-2025-08-07',
  
  // GPT-4.1 series
  'gpt-4.1-2025-01-29',
  'gpt-4.1-mini-2025-01-29',
  'gpt-4.1-nano-2025-01-29',
  
  // GPT-4o series (legacy but still supported)
  'gpt-4o-2024-08-06',
  'gpt-4o-mini-2024-07-18',
  'gpt-4o-2024-05-13',
  
  // o1 reasoning models
  'o1-2024-12-17',
  'o1-mini-2024-09-12',
  'o1-preview-2024-09-12'
];

// Legacy model name mapping for backward compatibility
const MODEL_MAPPING: Record<string, string> = {
  'gpt-5-2025-08-07': 'gpt-5-2025-08-07',
  'gpt-5-mini-2025-08-07': 'gpt-5-mini-2025-08-07', 
  'gpt-5-nano-2025-08-07': 'gpt-5-nano-2025-08-07',
  'gpt-4o': 'gpt-4o-2024-08-06',
  'gpt-4o-mini': 'gpt-4o-mini-2024-07-18',
  'gpt-4.1': 'gpt-4.1-2025-01-29',
  'gpt-4.1-mini': 'gpt-4.1-mini-2025-01-29',
  // Add other legacy mappings as needed
};

function mapModelName(requestedModel: string): string {
  return MODEL_MAPPING[requestedModel] || requestedModel;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  let corrId = '';

  try {
    // Setup common request handling
    const { corrId: _corrId, userId, supabaseClient } = await setupChatRequest(req);
    corrId = _corrId;
    console.log(`[${corrId}] OpenAI chat request started`);

    // Check if OpenAI API key is available
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    console.log(`[${corrId}] OpenAI API key configured: ${!!openaiKey}`);
    
    if (!openaiKey) {
      console.error(`[${corrId}] OpenAI API key not found in environment`);
      throw new Error('NO_API_KEY: OpenAI API key not configured');
    }

    // Parse request
    const reqData = await req.json();

    // Map legacy model names to current ones
    if (reqData.model) {
      reqData.model = mapModelName(reqData.model);
      console.log(`[${corrId}] Mapped model to: ${reqData.model}`);
    }

    // Process common validation
    const context = await processCommonValidation(supabaseClient, userId, corrId, reqData, OPENAI_MODELS);

    // Call OpenAI provider
    let callStartTime = Date.now();
    
    try {
      console.log(`[${corrId}] Calling OpenAI for model: ${context.request.model}`);

      // Determine model category for parameter handling
      const isGPT5Series = context.request.model.startsWith('gpt-5');
      const isGPT41Series = context.request.model.startsWith('gpt-4.1');
      const isReasoningModel = context.request.model.startsWith('o1') || context.request.model.startsWith('o3');
      const isGPT4oSeries = context.request.model.startsWith('gpt-4o');

      // Prepare base chat arguments
      const chatArgs: any = {
        model: context.request.model,
        messages: []
      };

      // Handle message format - support both string and conversation array
      if (typeof context.request.message === 'string') {
        chatArgs.messages.push({
          role: 'user',
          content: context.request.message
        });
      } else if (Array.isArray(context.request.messages)) {
        // Support conversation history
        chatArgs.messages = context.request.messages;
      } else {
        // Handle complex content format
        chatArgs.messages.push({
          role: 'user',
          content: context.request.message
        });
      }

      // Add system message if provided (not supported by o1 models)
      if (context.request.system && !isReasoningModel) {
        chatArgs.messages.unshift({
          role: 'system',
          content: context.request.system
        });
      }

      // Apply model-specific parameters
      if (isGPT5Series) {
        // GPT-5 models support both max_tokens and max_completion_tokens
        if (context.request.max_tokens) {
          chatArgs.max_completion_tokens = context.request.max_tokens;
        }
        
        // GPT-5 supports temperature
        if (context.request.temperature !== undefined) {
          chatArgs.temperature = context.request.temperature;
        }
        
        // GPT-5 specific parameters
        if (context.request.reasoning_effort) {
          chatArgs.reasoning_effort = context.request.reasoning_effort;
        }
        
        if (context.request.verbosity) {
          chatArgs.verbosity = context.request.verbosity;
        }
        
        console.log(`[${corrId}] Using GPT-5 series parameters`);
      } 
      else if (isGPT41Series) {
        // GPT-4.1 models
        if (context.request.max_tokens) {
          chatArgs.max_tokens = context.request.max_tokens;
        }
        
        if (context.request.temperature !== undefined) {
          chatArgs.temperature = context.request.temperature;
        }
        
        console.log(`[${corrId}] Using GPT-4.1 series parameters`);
      }
      else if (isReasoningModel) {
        // o1 models have specific constraints
        if (context.request.max_tokens) {
          chatArgs.max_completion_tokens = context.request.max_tokens;
        }
        
        // o1 models don't support temperature, top_p, or system messages
        console.log(`[${corrId}] Using o1 reasoning model parameters (no temperature/system)`);
      } 
      else {
        // Legacy models (GPT-4o, GPT-4, etc.)
        if (context.request.max_tokens) {
          chatArgs.max_tokens = context.request.max_tokens;
        }
        
        if (context.request.temperature !== undefined) {
          chatArgs.temperature = context.request.temperature;
        }
        
        console.log(`[${corrId}] Using legacy model parameters`);
      }

      // Add common optional parameters (where supported)
      if (context.request.top_p !== undefined && !isReasoningModel) {
        chatArgs.top_p = context.request.top_p;
      }

      if (context.request.frequency_penalty !== undefined && !isReasoningModel) {
        chatArgs.frequency_penalty = context.request.frequency_penalty;
      }

      if (context.request.presence_penalty !== undefined && !isReasoningModel) {
        chatArgs.presence_penalty = context.request.presence_penalty;
      }

      if (context.request.stop && !isReasoningModel) {
        chatArgs.stop = context.request.stop;
      }

      // Add tool support if provided (not supported by o1 models)
      if (context.request.tools && !isReasoningModel) {
        chatArgs.tools = context.request.tools;
        
        if (context.request.tool_choice) {
          chatArgs.tool_choice = context.request.tool_choice;
        }
      }

      // Stream support
      if (context.request.stream) {
        chatArgs.stream = context.request.stream;
      }

      console.log(`[${corrId}] Chat args:`, JSON.stringify(chatArgs, null, 2));

      const providerResult = await callOpenAI(chatArgs);
      const callLatency = Date.now() - callStartTime;
      
      console.log(`[${corrId}] OpenAI call successful. Latency: ${callLatency}ms, Tokens: ${providerResult.tokensIn}→${providerResult.tokensOut}`);

      // Log successful provider call
      await logOpsEvent(supabaseClient, userId, corrId, 'info', 'PROVIDER_SUCCESS', 'OpenAI call completed successfully', {
        provider: 'openai',
        model: context.request.model,
        modelCategory: isGPT5Series ? 'gpt-5' : isGPT41Series ? 'gpt-4.1' : isReasoningModel ? 'reasoning' : 'legacy',
        latencyMs: callLatency,
        tokensIn: providerResult.tokensIn,
        tokensOut: providerResult.tokensOut,
        finishReason: providerResult.finishReason,
        toolsUsed: providerResult.toolsUsed || false
      });

      return createSuccessResponse(context, providerResult, 'openai');

    } catch (providerError) {
      const callLatency = Date.now() - callStartTime;
      console.error(`[${corrId}] OpenAI call failed:`, providerError);

      // Log provider failure
      await logOpsEvent(supabaseClient, userId, corrId, 'error', 'PROVIDER_FAILED', 'OpenAI call failed', {
        provider: 'openai',
        model: context.request.model,
        latencyMs: callLatency,
        error: providerError.message,
        errorType: providerError.constructor.name,
        errorCode: providerError.code || 'UNKNOWN',
        statusCode: providerError.status || 500
      });

      // Rollback wallet deduction
      await rollbackWallet(context, providerError);

      // Handle specific OpenAI error codes
      let errorCode = 'SERVICE_UNAVAILABLE';
      let status = 503;
      let errorMessage = 'OpenAI service unavailable';

      if (providerError instanceof ProviderError) {
        errorCode = providerError.code;
        status = providerError.status;
        errorMessage = providerError.message;
      } else {
        // Map common OpenAI API errors
        const errorMsg = providerError.message?.toLowerCase() || '';
        
        if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
          errorCode = 'RATE_LIMITED';
          status = 429;
          errorMessage = 'Rate limit exceeded';
        } else if (errorMsg.includes('invalid') || errorMsg.includes('400')) {
          errorCode = 'BAD_REQUEST';
          status = 400;
          errorMessage = 'Invalid request format';
        } else if (errorMsg.includes('unauthorized') || errorMsg.includes('401')) {
          errorCode = 'UNAUTHORIZED';
          status = 401;
          errorMessage = 'Invalid API key';
        } else if (errorMsg.includes('insufficient_quota') || errorMsg.includes('quota')) {
          errorCode = 'QUOTA_EXCEEDED';
          status = 429;
          errorMessage = 'API quota exceeded';
        } else if (errorMsg.includes('model_not_found') || errorMsg.includes('404')) {
          errorCode = 'MODEL_NOT_FOUND';
          status = 404;
          errorMessage = 'Model not found or not accessible';
        } else {
          errorMessage = providerError.message || 'OpenAI call failed';
        }
      }

      throw new Error(`${errorCode}: ${errorMessage}`);
    }

  } catch (error) {
    return createErrorResponse(corrId, error);
  }
});