import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ModelInfo {
  id: string;
  name: string;
  badges: string[];
  latencyMs: number;
  context: number;
  provider: string;
  costPer1kInput: number;
  costPer1kOutput: number;
}

const MODELS_CATALOG: ModelInfo[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    badges: ['Fast', 'Multimodal'],
    latencyMs: 1200,
    context: 128000,
    provider: 'OpenAI',
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    badges: ['Reasoning', 'Coding'],
    latencyMs: 1800,
    context: 200000,
    provider: 'Anthropic',
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015
  },
  {
    id: 'llama-3.1-405b',
    name: 'Llama 3.1 405B',
    badges: ['Open Source', 'Large'],
    latencyMs: 2500,
    context: 128000,
    provider: 'Meta',
    costPer1kInput: 0.001,
    costPer1kOutput: 0.002
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    badges: ['Google', 'Multimodal'],
    latencyMs: 1500,
    context: 1000000,
    provider: 'Google',
    costPer1kInput: 0.0035,
    costPer1kOutput: 0.0105
  },
  {
    id: 'mistral-large',
    name: 'Mistral Large',
    badges: ['European', 'Fast'],
    latencyMs: 1000,
    context: 32000,
    provider: 'Mistral',
    costPer1kInput: 0.004,
    costPer1kOutput: 0.012
  }
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Models function called');

    if (req.method !== 'GET') {
      throw new Error('Method not allowed');
    }

    const response = {
      models: MODELS_CATALOG,
      lastUpdated: new Date().toISOString(),
      count: MODELS_CATALOG.length
    };

    console.log(`Returning ${MODELS_CATALOG.length} models`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in models function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});