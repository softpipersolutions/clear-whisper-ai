import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGemini, ProviderError } from "../_shared/providers.ts";
import { corsHeaders, setupChatRequest, processCommonValidation, rollbackWallet, createSuccessResponse, createErrorResponse } from "../_shared/chat-common.ts";
import { logOpsEvent } from "../_shared/hardening.ts";

// Google Gemini supported models (current as of 2025)
const GOOGLE_MODELS = [
  // Gemini 2.5 series (newest with thinking capabilities)
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash-image',
  
  // Gemini 2.0 series
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-live',
  
  // Gemini 1.5 series (legacy but still supported)
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-flash-002',
  'gemini-1.5-pro-002',
  
  // Experimental models
  'gemini-exp-1121',
  'gemini-exp-1114'
];

// Legacy model name mapping for backward compatibility
const MODEL_MAPPING: Record<string, string> = {
  // Current model names - use exact API names from Google docs
  'gemini-2.5-pro': 'gemini-2.5-pro',
  'gemini-2.5-flash': 'gemini-2.5-flash', 
  'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
  'gemini-2.0-flash': 'gemini-2.0-flash',
  'gemini-1.5-pro': 'gemini-1.5-pro',
  'gemini-1.5-flash': 'gemini-1.5-flash',
  
  // Handle models/ prefixed versions
  'models/gemini-2.5-pro': 'gemini-2.5-pro',
  'models/gemini-2.5-flash': 'gemini-2.5-flash',
  'models/gemini-2.0-flash': 'gemini-2.0-flash',
  'models/gemini-1.5-pro': 'gemini-1.5-pro',
  'models/gemini-1.5-flash': 'gemini-1.5-flash'
};

function mapModelName(requestedModel: string): string {
  return MODEL_MAPPING[requestedModel] || requestedModel;
}

// Legacy model name mapping for backward compatibility
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

    // Map legacy model names to current ones
    if (reqData.model) {
      reqData.model = mapModelName(reqData.model);
      console.log(`[${corrId}] Mapped model to: ${reqData.model}`);
    }

    // Process common validation
    const context = await processCommonValidation(supabaseClient, userId, corrId, reqData, GOOGLE_MODELS);

    // Call Google Gemini provider
    let callStartTime = Date.now();
    
    try {
      console.log(`[${corrId}] Calling Google Gemini for model: ${context.request.model}`);

      // Determine model capabilities
      const isThinkingModel = context.request.model.includes('2.5');
      const isImageModel = context.request.model.includes('image');
      const isLiveModel = context.request.model.includes('live');

      // Prepare chat arguments with Gemini-specific format  
      // Don't add models/ prefix here - let the provider handle it
      const chatArgs: any = {
        model: context.request.model // Use raw model name
      };

      // Handle system message (system instructions in Gemini)
      if (context.request.system) {
        chatArgs.systemInstruction = {
          parts: [{ text: context.request.system }]
        };
      }

      // Handle message format - Gemini uses 'contents' with 'parts'
      if (typeof context.request.message === 'string') {
        chatArgs.contents = [{
          role: 'user',
          parts: [{ text: context.request.message }]
        }];
      } else if (Array.isArray(context.request.messages)) {
        // Convert conversation history to Gemini format
        chatArgs.contents = context.request.messages.map((msg: any) => ({
          role: msg.role === 'assistant' ? 'model' : msg.role,
          parts: typeof msg.content === 'string' 
            ? [{ text: msg.content }]
            : Array.isArray(msg.content)
              ? msg.content.map((part: any) => {
                  if (part.type === 'text') return { text: part.text };
                  if (part.type === 'image_url') return { 
                    inlineData: { 
                      mimeType: part.image_url.mime_type || 'image/jpeg',
                      data: part.image_url.url.split(',')[1] // Remove data:image/jpeg;base64, prefix
                    }
                  };
                  return part;
                })
              : [{ text: String(msg.content) }]
        }));
      } else if (Array.isArray(context.request.message)) {
        // Handle multi-modal content (text + images)
        const parts = context.request.message.map((part: any) => {
          if (part.type === 'text') return { text: part.text };
          if (part.type === 'image_url') return { 
            inlineData: { 
              mimeType: part.image_url.mime_type || 'image/jpeg',
              data: part.image_url.url.split(',')[1]
            }
          };
          return part;
        });
        
        chatArgs.contents = [{
          role: 'user',
          parts: parts
        }];
      } else {
        chatArgs.contents = [{
          role: 'user',
          parts: [{ text: String(context.request.message) }]
        }];
      }

      // Pass parameters to provider for proper handling
      if (context.request.temperature !== undefined) {
        chatArgs.temperature = context.request.temperature;
      }

      if (context.request.max_tokens) {
        chatArgs.max_tokens = context.request.max_tokens;
      }

      // Gemini-specific parameters
      if (context.request.top_p !== undefined) {
        chatArgs.top_p = context.request.top_p;
      }

      if (context.request.top_k !== undefined) {
        chatArgs.top_k = context.request.top_k;
      }

      if (context.request.stop_sequences) {
        chatArgs.stop_sequences = context.request.stop_sequences;
      }

      if (context.request.safety_settings) {
        chatArgs.safetySettings = context.request.safety_settings;
      }

      if (context.request.tools) {
        chatArgs.tools = context.request.tools.map((tool: any) => ({
          functionDeclarations: Array.isArray(tool.functions) ? tool.functions : [tool.function]
        }));
      }

      // Thinking capabilities for 2.5 models
      if (isThinkingModel && context.request.show_thinking) {
        chatArgs.show_thinking = true;
      }

      console.log(`[${corrId}] Using ${isThinkingModel ? 'thinking' : isImageModel ? 'image' : isLiveModel ? 'live' : 'standard'} model capabilities`);

      console.log(`[${corrId}] Gemini chat args:`, JSON.stringify(chatArgs, null, 2));

      const providerResult = await callGemini(chatArgs);
      const callLatency = Date.now() - callStartTime;
      
      console.log(`[${corrId}] Google Gemini call successful. Latency: ${callLatency}ms, Tokens: ${providerResult.tokensIn}→${providerResult.tokensOut}`);

      // Log successful provider call
      await logOpsEvent(supabaseClient, userId, corrId, 'info', 'PROVIDER_SUCCESS', 'Google Gemini call completed successfully', {
        provider: 'google',
        model: context.request.model,
        modelType: isThinkingModel ? 'thinking' : isImageModel ? 'image' : isLiveModel ? 'live' : 'standard',
        latencyMs: callLatency,
        tokensIn: providerResult.tokensIn,
        tokensOut: providerResult.tokensOut,
        finishReason: providerResult.finishReason,
        toolsUsed: providerResult.toolsUsed || false,
        multiModal: providerResult.multiModal || false
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
        } else if (errorMsg.includes('overloaded') || errorMsg.includes('503')) {
          errorCode = 'OVERLOADED';
          status = 503;
          errorMessage = 'Service temporarily overloaded';
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