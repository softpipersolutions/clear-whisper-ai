import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getModelCatalog, type ModelInfo } from '../_shared/catalog.ts';
import { methodGuard, createStructuredError } from '../_shared/hardening.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CostEstimateRequest {
  message: string;
  history?: Array<{ role: string; content: string }>;
  models?: string[];
}

interface TokenEstimate {
  input: number;
  output: number;
  confidence: 'high' | 'medium' | 'low';
  method: 'gpt-based' | 'heuristic-fallback';
}

interface ModelCost {
  modelId: string;
  provider: string;
  costUSD: number;
  costINR: number;
  breakdown: {
    inputCost: number;
    outputCost: number;
  };
}

interface CostEstimateResponse {
  corrId: string;
  tokenEstimate: TokenEstimate;
  costs: ModelCost[];
  fx: {
    usdToInr: number;
    fetchedAt: string;
    stale: boolean;
  };
}

async function estimateTokensWithGPT(message: string, history?: Array<{ role: string; content: string }>): Promise<TokenEstimate> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Combine message with history for context
  const fullContext = history ? 
    history.map(h => `${h.role}: ${h.content}`).join('\n') + `\nuser: ${message}` :
    `user: ${message}`;

  const tokenAnalysisPrompt = `Analyze this conversation and predict token usage for an AI response:

Context:
${fullContext}

Respond with ONLY a JSON object:
{
  "inputTokens": <estimated input tokens including full context>,
  "outputTokens": <estimated output tokens for typical AI response>,
  "confidence": "high|medium|low",
  "reasoning": "brief explanation"
}

Consider:
- Input includes system prompt, conversation history, and current message
- Output depends on query complexity (simple questions: 50-200, complex: 200-1000, coding: 500-2000)
- High confidence for typical patterns, medium for complex, low for ambiguous`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          { role: 'user', content: tokenAnalysisPrompt }
        ],
        max_completion_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    try {
      const parsed = JSON.parse(content);
      return {
        input: Math.max(1, Math.round(parsed.inputTokens)),
        output: Math.max(1, Math.round(parsed.outputTokens)),
        confidence: parsed.confidence || 'medium',
        method: 'gpt-based'
      };
    } catch {
      throw new Error('Invalid JSON response from GPT');
    }
  } catch (error) {
    console.warn('GPT estimation failed, falling back to heuristics:', error);
    return estimateTokensHeuristic(message, history);
  }
}

function estimateTokensHeuristic(message: string, history?: Array<{ role: string; content: string }>): TokenEstimate {
  const text = message.toLowerCase();
  
  // Enhanced content-type detection
  let charsPerToken = 4;
  let outputMultiplier = 1.5;
  let confidence: 'high' | 'medium' | 'low' = 'medium';

  if (text.includes('code') || text.includes('function') || text.includes('programming') || text.includes('debug')) {
    charsPerToken = 3; // Code is denser
    outputMultiplier = 3; // Code responses are longer
    confidence = 'high';
  } else if (text.includes('write') || text.includes('creative') || text.includes('story') || text.includes('essay')) {
    charsPerToken = 4;
    outputMultiplier = 4; // Creative content is longer
    confidence = 'high';
  } else if (text.includes('explain') || text.includes('how') || text.includes('what') || text.includes('why')) {
    charsPerToken = 4;
    outputMultiplier = 2; // Explanations are moderately long
    confidence = 'high';
  } else if (text.length < 20) {
    charsPerToken = 4;
    outputMultiplier = 1.2; // Short questions get short answers
    confidence = 'medium';
  }

  // Calculate input tokens (including history)
  let totalInput = message.length;
  if (history) {
    totalInput += history.reduce((sum, h) => sum + h.content.length, 0);
  }
  totalInput += 100; // System prompt overhead

  const inputTokens = Math.ceil(totalInput / charsPerToken);
  const outputTokens = Math.ceil(inputTokens * outputMultiplier);

  return {
    input: Math.max(1, inputTokens),
    output: Math.max(1, outputTokens),
    confidence,
    method: 'heuristic-fallback'
  };
}

async function getFxRate(supabase: any): Promise<{ usdToInr: number; fetchedAt: string; stale: boolean }> {
  try {
    const { data, error } = await supabase
      .from('fx_rates')
      .select('rates, fetched_at')
      .eq('base', 'INR')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.warn('FX rate not found, using fallback');
      return {
        usdToInr: 83.0, // Fallback rate
        fetchedAt: new Date().toISOString(),
        stale: true
      };
    }

    const usdRate = data.rates?.USD;
    if (!usdRate) {
      throw new Error('USD rate not found in FX data');
    }

    const fetchedAt = new Date(data.fetched_at);
    const now = new Date();
    const hoursOld = (now.getTime() - fetchedAt.getTime()) / (1000 * 60 * 60);
    const stale = hoursOld > 24;

    return {
      usdToInr: usdRate,
      fetchedAt: data.fetched_at,
      stale
    };
  } catch (error) {
    console.error('Error fetching FX rate:', error);
    return {
      usdToInr: 83.0, // Fallback rate
      fetchedAt: new Date().toISOString(),
      stale: true
    };
  }
}

function calculateModelCosts(
  models: ModelInfo[], 
  tokens: TokenEstimate, 
  fx: { usdToInr: number }, 
  requestedModels?: string[]
): ModelCost[] {
  const filteredModels = requestedModels ? 
    models.filter(m => requestedModels.includes(m.id)) : 
    models;

  return filteredModels.map(model => {
    const inputCostUSD = (tokens.input / 1_000_000) * model.pricing.input;
    const outputCostUSD = (tokens.output / 1_000_000) * model.pricing.output;
    const totalCostUSD = inputCostUSD + outputCostUSD;
    const totalCostINR = totalCostUSD * fx.usdToInr;

    return {
      modelId: model.id,
      provider: model.provider,
      costUSD: Math.round(totalCostUSD * 100000) / 100000, // 5 decimal places
      costINR: Math.round(totalCostINR * 100) / 100, // 2 decimal places
      breakdown: {
        inputCost: Math.round(inputCostUSD * 100000) / 100000,
        outputCost: Math.round(outputCostUSD * 100000) / 100000,
      }
    };
  });
}

async function handleCostEstimate(req: Request, corrId: string): Promise<Response> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body = await req.json();
    const { message, history, models: requestedModels }: CostEstimateRequest = body;

    if (!message || typeof message !== 'string') {
      return createStructuredError('INVALID_INPUT', 'Message is required and must be a string', corrId, 400);
    }

    // Run token estimation and FX rate fetching in parallel
    const [tokenEstimate, fx] = await Promise.all([
      estimateTokensWithGPT(message, history),
      getFxRate(supabase)
    ]);

    // Get model catalog and calculate costs
    const modelCatalog = getModelCatalog();
    const costs = calculateModelCosts(modelCatalog, tokenEstimate, fx, requestedModels);

    const response: CostEstimateResponse = {
      corrId,
      tokenEstimate,
      costs,
      fx: {
        usdToInr: fx.usdToInr,
        fetchedAt: fx.fetchedAt,
        stale: fx.stale
      }
    };

    // Log for monitoring
    await supabase.from('ops_logs').insert({
      user_id: null, // This is a utility function
      corr_id: corrId,
      level: 'info',
      code: 'COST_ESTIMATE_SUCCESS',
      msg: `Estimated costs for ${costs.length} models`,
      meta: {
        tokenEstimate,
        modelsCount: costs.length,
        method: tokenEstimate.method,
        confidence: tokenEstimate.confidence
      }
    });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in cost estimate:', error);
    
    await supabase.from('ops_logs').insert({
      user_id: null,
      corr_id: corrId,
      level: 'error',
      code: 'COST_ESTIMATE_ERROR',
      msg: error.message,
      meta: { error: error.toString() }
    });

    return createStructuredError('ESTIMATION_FAILED', error.message, corrId, 500);
  }
}

serve(async (req) => {
  const corrId = crypto.randomUUID();

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const guardResponse = methodGuard(req, ['POST'], corsHeaders);
  if (guardResponse) return guardResponse;

  try {
    return await Promise.race([
      handleCostEstimate(req, corrId),
      new Promise<Response>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 2000)
      )
    ]);
  } catch (error) {
    console.error('Request timeout or error:', error);
    return createStructuredError('TIMEOUT', 'Request timed out', corrId, 408);
  }
});