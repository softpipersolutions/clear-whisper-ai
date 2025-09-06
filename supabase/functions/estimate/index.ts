import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { generateCorrId, logOpsEvent, withTimeout } from "../_shared/hardening.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EstimateRequest {
  message: string;
  history?: Array<{ role: string; content: string }>;
}

interface EstimateResponse {
  inputTokens: number;
  outputTokensEst: number;
  estCostINR: number;
  corrId: string;
}

function createStructuredError(code: string, message: string, corrId: string, status = 500) {
  return {
    error: code,
    message,
    corrId,
    status
  };
}

async function handleEstimate(req: Request, corrId: string): Promise<Response> {
  if (req.method !== 'POST') {
    const error = createStructuredError('BAD_INPUT', 'Method not allowed', corrId, 405);
    return new Response(JSON.stringify(error), {
      status: error.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Create Supabase client for auth
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  // Get user from auth header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    const error = createStructuredError('UNAUTHORIZED', 'No authorization header', corrId, 401);
    return new Response(JSON.stringify(error), {
      status: error.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
  
  if (userError || !user) {
    const error = createStructuredError('UNAUTHORIZED', 'User not authenticated', corrId, 401);
    return new Response(JSON.stringify(error), {
      status: error.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const { message, history = [] }: EstimateRequest = await req.json();
  
  if (!message || typeof message !== 'string') {
    const error = createStructuredError('BAD_INPUT', 'Invalid message parameter', corrId, 400);
    return new Response(JSON.stringify(error), {
      status: error.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`[${corrId}] Estimating tokens for message length: ${message.length}`);

  // Heuristic token estimation: ~4 characters per token
  const inputTokens = Math.ceil(message.length / 4);
  
  // Add history tokens
  const historyTokens = history.reduce((total, msg) => {
    return total + Math.ceil((msg.content || '').length / 4);
  }, 0);
  
  const totalInputTokens = inputTokens + historyTokens;
  const outputTokensEst = Math.ceil(totalInputTokens * 1.5); // Assume response is 1.5x input
  
  // Mock pricing: ₹0.001 per input token, ₹0.002 per output token
  const inputCost = totalInputTokens * 0.001;
  const outputCost = outputTokensEst * 0.002;
  const estCostINR = Math.round((inputCost + outputCost) * 100) / 100;

  const response: EstimateResponse = {
    inputTokens: totalInputTokens,
    outputTokensEst,
    estCostINR,
    corrId
  };

  // Log successful operation
  await logOpsEvent(supabaseClient, user.id, corrId, 'info', 'ESTIMATE_SUCCESS', 'Token estimation completed', {
    inputTokens: totalInputTokens,
    outputTokensEst,
    estCostINR
  });

  console.log(`[${corrId}] Estimate completed:`, response);

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  const corrId = generateCorrId();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[${corrId}] Estimate function called`);

    // Apply 1500ms timeout
    const response = await withTimeout(
      handleEstimate(req, corrId),
      1500,
      'estimate',
      corrId
    );

    return response;
  } catch (error) {
    console.error(`[${corrId}] Error in estimate function:`, error);
    
    let errorCode = 'INTERNAL';
    let status = 500;
    let message = 'Internal server error';
    
    if (error.message?.includes('TIMEOUT')) {
      errorCode = 'TIMEOUT';
      status = 504;
      message = 'Request timeout';
    } else if (error.message?.includes('BAD_INPUT')) {
      errorCode = 'BAD_INPUT';
      status = 400;
      message = error.message.replace('BAD_INPUT: ', '');
    } else if (error.message?.includes('UNAUTHORIZED')) {
      errorCode = 'UNAUTHORIZED';
      status = 401;
      message = error.message.replace('UNAUTHORIZED: ', '');
    }

    // Create Supabase client for error logging
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      await logOpsEvent(supabaseClient, null, corrId, 'error', errorCode, message);
    } catch (logError) {
      console.error(`[${corrId}] Failed to log error:`, logError);
    }
    
    return new Response(JSON.stringify(createStructuredError(errorCode, message, corrId, status)), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});