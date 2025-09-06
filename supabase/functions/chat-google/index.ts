import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGemini, ProviderError } from "../_shared/providers.ts";
import { corsHeaders, setupChatRequest, processCommonValidation, rollbackWallet, createSuccessResponse, createErrorResponse } from "../_shared/chat-common.ts";
import { logOpsEvent } from "../_shared/hardening.ts";

// Google Gemini supported models - matches catalog exactly
const GOOGLE_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash', 
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash'
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
    console.log(`[${corrId}] Google Gemini chat request started`);

    // Check if Google API key is available
    const googleKey = Deno.env.get('GOOGLE_API_KEY');
    console.log(`[${corrId}] Google API key configured: ${!!googleKey}`);
    
    if (!googleKey) {
      console.error(`[${corrId}] Google API key not found in environment`);
      throw new Error('NO_API_KEY: Google API key not configured');
    }

    // Parse request
    const reqData = await req.json();
    console.log(`[${corrId}] Raw request data:`, JSON.stringify(reqData));

    // Process common validation
    const context = await processCommonValidation(supabaseClient, userId, corrId, reqData, GOOGLE_MODELS);

    // Call Google Gemini provider
    let callStartTime = Date.now();
    
    try {
      console.log(`[${corrId}] Calling Google Gemini for model: ${context.request.model}`);

      // Ensure model has the models/ prefix for the API
      const modelForAPI = context.request.model.startsWith('models/') 
        ? context.request.model 
        : `models/${context.request.model}`;

      // Use the exact same format as your OpenAI implementation but adapted for Gemini
      const chatArgs = {
        model: modelForAPI,
        messages: [
          {
            role: 'user',
            content: context.request.message
          }
        ],
        temperature: context.request.temperature ?? 0.7,
        max_tokens: context.request.max_tokens ?? 1000
      };

      console.log(`[${corrId}] Calling callGemini with args:`, JSON.stringify(chatArgs));

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
      console.error(`[${corrId}] Provider error details:`, {
        message: providerError.message,
        name: providerError.name,
        stack: providerError.stack,
        code: providerError.code,
        status: providerError.status
      });

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
    console.error(`[${corrId}] Final error:`, error);
    return createErrorResponse(corrId, error);
  }
});