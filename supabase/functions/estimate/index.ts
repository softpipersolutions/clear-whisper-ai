import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
  estCostDisplay: number;
  displayCurrency: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Estimate function called');

    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Create Supabase client for auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const { message, history = [] }: EstimateRequest = await req.json();
    
    if (!message || typeof message !== 'string') {
      throw new Error('Invalid message parameter');
    }

    console.log(`Estimating tokens for message: ${message.substring(0, 100)}...`);

    // Simple token estimation: ~4 characters per token
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
      estCostDisplay: estCostINR,
      displayCurrency: 'INR'
    };

    console.log('Estimate response:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in estimate function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});