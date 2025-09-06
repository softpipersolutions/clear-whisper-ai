import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAnthropic, isProviderAvailable, ProviderError, type ChatArgs } from "../_shared/providers.ts";
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

// Anthropic supported models
const ANTHROPIC_MODELS = [
  'claude-4.1-opus',
  'claude-4-sonnet',
  'claude-3.5-haiku'
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
    
    console.log(`[${corrId}] Anthropic chat request started`);

    // Check if Anthropic API key is available
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    console.log(`[${corrId}] Anthropic API key configured: ${!!anthropicKey}`);
    if (!anthropicKey) {
      console.error(`[${corrId}] Anthropic API key not found in environment`);
      throw new Error('NO_API_KEY: Anthropic API key not configured');
    }

    // Parse request
    const reqData: ChatConfirmRequest = await req.json();
    
    // Process common validation
    const context = await processCommonValidation(
      supabaseClient, 
      userId, 
      corrId, 
      reqData, 
      ANTHROPIC_MODELS
    );

    // Call Anthropic provider
    let callStartTime = Date.now();
    
    try {
      console.log(`[${corrId}] Calling Anthropic for model: ${context.request.model}`);
      
      // Prepare chat arguments
      const chatArgs: ChatArgs = {
        model: context.request.model,
        messages: [
          { role: 'user', content: context.request.message }
        ],
        temperature: context.request.temperature ?? 0.7,
        max_tokens: context.request.max_tokens ?? 1000
      };
      
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
        finishReason: providerResult.finishReason
      });
      
      return createSuccessResponse(context, providerResult, 'anthropic');
      
    } catch (providerError) {
      const callLatency = Date.now() - callStartTime;
      console.error(`[${corrId}] Anthropic call failed:`, providerError);
      
      // Log provider failure
      await logOpsEvent(supabaseClient, userId, corrId, 'error', 'PROVIDER_FAILED', 'Anthropic call failed', {
        provider: 'anthropic',
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
      let errorMessage = 'Anthropic service unavailable';
      
      if (providerError instanceof ProviderError) {
        errorCode = providerError.code;
        status = providerError.status;
        errorMessage = providerError.message;
      } else {
        errorMessage = providerError.message || 'Anthropic call failed';
      }
      
      throw new Error(`${errorCode}: ${errorMessage}`);
    }
    
  } catch (error) {
    return createErrorResponse(corrId, error);
  }
});