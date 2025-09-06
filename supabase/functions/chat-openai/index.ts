import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callOpenAI, isProviderAvailable, ProviderError, type ChatArgs } from "../_shared/providers.ts";
import { 
  corsHeaders, 
  setupChatRequest, 
  processCommonValidation, 
  rollbackWallet,
  createSuccessResponse,
  createErrorResponse,
  type ChatConfirmRequest
} from "../_shared/chat-common.ts";
import { logOpsEvent } from "../_shared/hardening.ts";

// OpenAI supported models
const OPENAI_MODELS = [
  'gpt-5-2025-08-07',
  'gpt-5-mini-2025-08-07',
  'gpt-5-nano-2025-08-07',
  'gpt-4o',
  'gpt-4o-mini'
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
    const reqData: ChatConfirmRequest = await req.json();
    
    // Process common validation
    const context = await processCommonValidation(
      supabaseClient, 
      userId, 
      corrId, 
      reqData, 
      OPENAI_MODELS
    );

    // Call OpenAI provider
    let callStartTime = Date.now();
    
    try {
      console.log(`[${corrId}] Calling OpenAI for model: ${context.request.model}`);
      
      // Prepare chat arguments with model-specific parameters
      const isGPT5Series = context.request.model.includes('gpt-5') || 
                          context.request.model.includes('o3-') || 
                          context.request.model.includes('o4-');
      
      const chatArgs: any = {
        model: context.request.model,
        messages: [
          { role: 'user', content: context.request.message }
        ]
      };
      
      // GPT-5 and newer models use different parameters
      if (isGPT5Series) {
        // GPT-5 models use max_completion_tokens and don't support temperature
        if (context.request.max_tokens) {
          chatArgs.max_completion_tokens = context.request.max_tokens;
        }
        // No temperature parameter for GPT-5 series
        console.log(`[${corrId}] Using GPT-5 series parameters (no temperature, max_completion_tokens)`);
      } else {
        // Legacy models (GPT-4, GPT-4o) use old parameters
        chatArgs.temperature = context.request.temperature ?? 0.7;
        if (context.request.max_tokens) {
          chatArgs.max_tokens = context.request.max_tokens;
        }
        console.log(`[${corrId}] Using legacy model parameters (temperature, max_tokens)`);
      }
      
      console.log(`[${corrId}] Chat args:`, JSON.stringify(chatArgs, null, 2));
      
      const providerResult = await callOpenAI(chatArgs);
      const callLatency = Date.now() - callStartTime;
      
      console.log(`[${corrId}] OpenAI call successful. Latency: ${callLatency}ms, Tokens: ${providerResult.tokensIn}→${providerResult.tokensOut}`);
      
      // Log successful provider call
      await logOpsEvent(supabaseClient, userId, corrId, 'info', 'PROVIDER_SUCCESS', 'OpenAI call completed successfully', {
        provider: 'openai',
        model: context.request.model,
        latencyMs: callLatency,
        tokensIn: providerResult.tokensIn,
        tokensOut: providerResult.tokensOut,
        finishReason: providerResult.finishReason
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
        errorType: providerError.constructor.name
      });
      
      // Rollback wallet deduction
      await rollbackWallet(context, providerError);
      
      // Determine error code from provider error
      let errorCode = 'SERVICE_UNAVAILABLE';
      let status = 503;
      let errorMessage = 'OpenAI service unavailable';
      
      if (providerError instanceof ProviderError) {
        errorCode = providerError.code;
        status = providerError.status;
        errorMessage = providerError.message;
      } else {
        errorMessage = providerError.message || 'OpenAI call failed';
      }
      
      throw new Error(`${errorCode}: ${errorMessage}`);
    }
    
  } catch (error) {
    return createErrorResponse(corrId, error);
  }
});