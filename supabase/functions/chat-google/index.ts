import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGemini, ProviderError } from "../_shared/providers.ts";
import { corsHeaders, setupChatRequest, processCommonValidation, rollbackWallet, createSuccessResponse, createErrorResponse } from "../_shared/chat-common.ts";
import { logOpsEvent } from "../_shared/hardening.ts";

// Google Gemini supported models (current as of 2025)
const GOOGLE_MODELS = [
  // Gemini 2.5 series (newest)
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  
  // Gemini 2.0 series
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  
  // Gemini 1.5 series (legacy but still supported)
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  
  // Experimental models
  'gemini-exp-1121',
  'gemini-exp-1114'
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

    // Simple model name mapping - strip models/ prefix if present
    if (reqData.model && reqData.model.startsWith('models/')) {
      reqData.model = reqData.model.replace('models/', '');
      console.log(`[${corrId}] Stripped models/ prefix, using: ${reqData.model}`);
    }

    // Process common validation
    const context = await processCommonValidation(supabaseClient, userId, corrId, reqData, GOOGLE_MODELS);

    // Call Google Gemini provider
    let callStartTime = Date.now();
    
    try {
      console.log(`[${corrId}] Calling Google Gemini for model: ${context.request.model}`);

      // Prepare chat arguments with Gemini format
      const modelForAPI = `models/${context.request.model}`;
      
      const chatArgs: any = {
        model: modelForAPI
      };

      // Handle message format - convert to Gemini contents format
      if (typeof context.request.message === 'string') {
        chatArgs.contents = [{
          role: 'user',
          parts: [{ text: context.request.message }]
        }];
      } else if (Array.isArray(context.request.messages)) {
        // Convert conversation history to Gemini format
        chatArgs.contents = context.request.messages.map((msg: any) => ({
          role: msg.role === 'assistant' ? 'model' : msg.role,
          parts: [{ text: msg.content || msg.text || '' }]
        }));
      } else {
        chatArgs.contents = [{
          role: 'user',
          parts: [{ text: String(context.request.message || '') }]
        }];
      }

      // Generation configuration
      chatArgs.generationConfig = {
        temperature: context.request.temperature || 0.7,
        maxOutputTokens: context.request.max_tokens || 1000
      };

      // Add system instruction if provided
      if (context.request.system) {
        chatArgs.systemInstruction = {
          parts: [{ text: context.request.system }]
        };
      }

      // Add safety settings (optional - use defaults)
      chatArgs.safetySettings = [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH", 
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ];

      console.log(`[${corrId}] Gemini chat args:`, JSON.stringify(chatArgs, null, 2));

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
        errorType: providerError.constructor.name,
        errorCode: providerError.code || 'UNKNOWN',
        statusCode: providerError.status || 500
      });

      // Rollback wallet deduction
      await rollbackWallet(context, providerError);

      // Handle specific Google AI/Gemini error codes
      let errorCode = 'SERVICE_UNAVAILABLE';
      let status = 503;
      let errorMessage = 'Google Gemini service unavailable';

      if (providerError instanceof ProviderError) {
        errorCode = providerError.code;
        status = providerError.status;
        errorMessage = providerError.message;
      } else {
        // Map common Gemini API errors
        const errorMsg = providerError.message?.toLowerCase() || '';
        
        if (errorMsg.includes('quota') || errorMsg.includes('429')) {
          errorCode = 'RATE_LIMITED';
          status = 429;
          errorMessage = 'API quota exceeded or rate limited';
        } else if (errorMsg.includes('invalid') || errorMsg.includes('400')) {
          errorCode = 'BAD_REQUEST';
          status = 400;
          errorMessage = 'Invalid request format';
        } else if (errorMsg.includes('unauthorized') || errorMsg.includes('401')) {
          errorCode = 'UNAUTHORIZED';
          status = 401;
          errorMessage = 'Invalid API key';
        } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
          errorCode = 'MODEL_NOT_FOUND';
          status = 404;
          errorMessage = 'Model not found or not accessible';
        } else if (errorMsg.includes('safety') || errorMsg.includes('blocked')) {
          errorCode = 'CONTENT_BLOCKED';
          status = 400;
          errorMessage = 'Content blocked by safety filters';
        } else {
          errorMessage = providerError.message || 'Google Gemini call failed';
        }
      }

      throw new Error(`${errorCode}: ${errorMessage}`);
    }

  } catch (error) {
    return createErrorResponse(corrId, error);
  }
});