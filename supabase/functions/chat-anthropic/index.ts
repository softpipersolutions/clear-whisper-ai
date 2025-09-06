import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAnthropic, ProviderError } from "../_shared/providers.ts";
import { corsHeaders, setupChatRequest, processCommonValidation, rollbackWallet, createSuccessResponse, createErrorResponse } from "../_shared/chat-common.ts";
import { logOpsEvent } from "../_shared/hardening.ts";

// Correct Anthropic model names (as of current API)
const ANTHROPIC_MODELS = [
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022', 
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307'
];

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
    console.log(`[${corrId}] Anthropic chat request started`);

    // Check if Anthropic API key is available
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    console.log(`[${corrId}] Anthropic API key configured: ${!!anthropicKey}`);
    
    if (!anthropicKey) {
      console.error(`[${corrId}] Anthropic API key not found in environment`);
      throw new Error('NO_API_KEY: Anthropic API key not configured');
    }

    // Parse request
    const reqData = await req.json();

    // Process common validation
    const context = await processCommonValidation(supabaseClient, userId, corrId, reqData, ANTHROPIC_MODELS);

    // Call Anthropic provider
    let callStartTime = Date.now();
    
    try {
      console.log(`[${corrId}] Calling Anthropic for model: ${context.request.model}`);

      // Prepare chat arguments with proper Claude format
      const chatArgs: any = {
        model: context.request.model,
        max_tokens: context.request.max_tokens ?? 4096, // Claude typically needs higher token limits
        temperature: context.request.temperature ?? 0.7,
        messages: []
      };

      // Add system message if provided
      if (context.request.system) {
        chatArgs.system = context.request.system;
      }

      // Handle message format - support both string and array formats
      if (typeof context.request.message === 'string') {
        chatArgs.messages.push({
          role: 'user',
          content: context.request.message
        });
      } else if (Array.isArray(context.request.messages)) {
        // Support conversation history
        chatArgs.messages = context.request.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        }));
      } else {
        // Handle complex content (text + images, etc.)
        chatArgs.messages.push({
          role: 'user',
          content: context.request.message
        });
      }

      // Add optional Claude-specific parameters
      if (context.request.top_p !== undefined) {
        chatArgs.top_p = context.request.top_p;
      }

      if (context.request.top_k !== undefined) {
        chatArgs.top_k = context.request.top_k;
      }

      if (context.request.stop_sequences) {
        chatArgs.stop_sequences = context.request.stop_sequences;
      }

      // Add tool use support if tools are provided
      if (context.request.tools) {
        chatArgs.tools = context.request.tools;
        
        if (context.request.tool_choice) {
          chatArgs.tool_choice = context.request.tool_choice;
        }
      }

      // Stream support
      if (context.request.stream) {
        chatArgs.stream = context.request.stream;
      }

      const providerResult = await callAnthropic(chatArgs);
      const callLatency = Date.now() - callStartTime;
      
      console.log(`[${corrId}] Anthropic call successful. Latency: ${callLatency}ms, Tokens: ${providerResult.tokensIn}→${providerResult.tokensOut}`);

      // Log successful provider call
      await logOpsEvent(supabaseClient, userId, corrId, 'info', 'PROVIDER_SUCCESS', 'Anthropic call completed successfully', {
        provider: 'anthropic',
        model: context.request.model,
        latencyMs: callLatency,
        tokensIn: providerResult.tokensIn,
        tokensOut: providerResult.tokensOut,
        finishReason: providerResult.finishReason,
        toolsUsed: providerResult.toolsUsed || false
      });

      return createSuccessResponse(context, providerResult, 'anthropic');

    } catch (providerError) {
      const callLatency = Date.now() - callStartTime;
      console.error(`[${corrId}] Anthropic call failed:`, providerError);

      // Log provider failure with more detailed error info
      await logOpsEvent(supabaseClient, userId, corrId, 'error', 'PROVIDER_FAILED', 'Anthropic call failed', {
        provider: 'anthropic',
        model: context.request.model,
        latencyMs: callLatency,
        error: providerError.message,
        errorType: providerError.constructor.name,
        errorCode: providerError.code || 'UNKNOWN',
        statusCode: providerError.status || 500
      });

      // Rollback wallet deduction
      await rollbackWallet(context, providerError);

      // Handle specific Anthropic error codes
      let errorCode = 'SERVICE_UNAVAILABLE';
      let status = 503;
      let errorMessage = 'Anthropic service unavailable';

      if (providerError instanceof ProviderError) {
        errorCode = providerError.code;
        status = providerError.status;
        errorMessage = providerError.message;
      } else {
        // Map common Anthropic API errors
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
        } else if (errorMsg.includes('overloaded') || errorMsg.includes('529')) {
          errorCode = 'OVERLOADED';
          status = 529;
          errorMessage = 'Anthropic is temporarily overloaded';
        } else {
          errorMessage = providerError.message || 'Anthropic call failed';
        }
      }

      throw new Error(`${errorCode}: ${errorMessage}`);
    }

  } catch (error) {
    return createErrorResponse(corrId, error);
  }
});