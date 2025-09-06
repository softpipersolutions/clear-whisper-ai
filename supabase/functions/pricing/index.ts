import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PricingInfo {
  model: string;
  inputPer1k: number;
  outputPer1k: number;
  currency: string;
  lastUpdated: string;
  provider: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Pricing function called');

    if (req.method !== 'GET') {
      throw new Error('Method not allowed');
    }

    // Updated pricing with correct model names
    const pricing: PricingInfo[] = [
      {
        model: 'gpt-5-nano-2025-08-07',
        inputPer1k: 0.001,
        outputPer1k: 0.002,
        currency: 'INR',
        lastUpdated: new Date().toISOString(),
        provider: 'OpenAI'
      },
      {
        model: 'gpt-5-mini-2025-08-07',
        inputPer1k: 0.003,
        outputPer1k: 0.012,
        currency: 'INR',
        lastUpdated: new Date().toISOString(),
        provider: 'OpenAI'
      },
      {
        model: 'gpt-5-2025-08-07',
        inputPer1k: 0.015,
        outputPer1k: 0.060,
        currency: 'INR',
        lastUpdated: new Date().toISOString(),
        provider: 'OpenAI'
      },
      {
        model: 'gpt-4o',
        inputPer1k: 0.005,
        outputPer1k: 0.015,
        currency: 'INR',
        lastUpdated: new Date().toISOString(),
        provider: 'OpenAI'
      },
      {
        model: 'claude-3-5-sonnet-20241022',
        inputPer1k: 0.008,
        outputPer1k: 0.024,
        currency: 'INR',
        lastUpdated: new Date().toISOString(),
        provider: 'Anthropic'
      }
    ];

    const response = {
      pricing,
      defaultModel: 'gpt-5-nano-2025-08-07',
      timestamp: new Date().toISOString()
    };

    console.log('Returning pricing data for', pricing.length, 'models');

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in pricing function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});