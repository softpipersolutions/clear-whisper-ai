import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGemini, isProviderAvailable, ProviderError, type ChatArgs } from "../_shared/providers.ts";
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

// Google Gemini supported models
const GOOGLE_MODELS = [
  'models/gemini-2.5-flash'
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
    
    console.log(`[${corrId}] Google Gemini chat request started`);

    // Check if Google API key is available
    const googleKey = Deno.env.get('GOOGLE_API_KEY');
    console.log(`[${corrId}] Google API key configured: ${!!googleKey}`);
    if (!googleKey) {
      console.error(`[${corrId}] Google API key not found in environment`);
      throw new Error('NO_API_KEY: Google API key not configured');
    }

    // Parse request
    const reqData: ChatConfirmRequest = await req.json();
    
    // Process common validation
    const context = await processCommonValidation(
      supabaseClient, 
      userId, 
      corrId, 
      reqData, 
      GOOGLE_MODELS
    );

    // Call Google Gemini provider
    let callStartTime = Date.now();
    
    try {
      console.log(`[${corrId}] Calling Google Gemini for model: ${context.request.model}`);
      
      // Prepare chat arguments with Gemini-specific model format
      const modelForAPI = context.request.model.startsWith('models/') 
        ? context.request.model 
        : `models/${context.request.model}`;
      
      const chatArgs: ChatArgs = {
        model: modelForAPI,
        messages: [
          { role: 'user', content: context.request.message }
        ],
        temperature: context.request.temperature ?? 0.7,
        max_tokens: context.request.max_tokens ?? 1000
      };
      
      const providerResult = await callGemini(chatArgs);
      const callLatency = Date.now() - callStartTime;
      
      console.log(`[${corrId}] Google Gemini call successful. Latency: ${callLatency}ms, Tokens: ${providerResult.tokensIn}→${providerResult.tokensOut}`);
      
      // Log successful provider call
      await logOpsEvent(supabaseClient, userId, corrId, 'info', 'PROVIDER_SUCCESS', 'Google Gemini call completed successfully', {
        provider: 'google',
        model: context.request.model,
        latencyMs: callLatency,
        tokensIn: providerResult.tokensIn,
        tokensOut: providerResult.tokensOut,
        finishReason: providerResult.finishReason
      });
      
      return createSuccessResponse(context, providerResult, 'google');
      
    } catch (providerError) {
      const callLatency = Date.now() - callStartTime;
      console.error(`[${corrId}] Google Gemini call failed:`, providerError);
      
      // Log provider failure
      await logOpsEvent(supabaseClient, userId, corrId, 'error', 'PROVIDER_FAILED', 'Google Gemini call failed', {
        provider: 'google',
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
      let errorMessage = 'Google Gemini service unavailable';
      
      if (providerError instanceof ProviderError) {
        errorCode = providerError.code;
        status = providerError.status;
        errorMessage = providerError.message;
      } else {
        errorMessage = providerError.message || 'Google Gemini call failed';
      }
      
      throw new Error(`${errorCode}: ${errorMessage}`);
    }
    
  } catch (error) {
    return createErrorResponse(corrId, error);
  }
});