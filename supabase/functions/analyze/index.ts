import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { generateCorrId, logOpsEvent, withTimeout } from "../_shared/hardening.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeRequest {
  message: string;
  history?: Array<{ role: string; content: string }>;
}

interface ModelRecommendation {
  model: string;
  why: string;
  fitScore: number;
}

interface AnalyzeResponse {
  tags: string[];
  recommended: ModelRecommendation[];
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

function analyzeMessageTags(message: string): string[] {
  const text = message.toLowerCase();
  const tags: string[] = [];
  
  // Deterministic keyword-based tag inference
  if (text.includes('code') || text.includes('programming') || text.includes('function') || 
      text.includes('bug') || text.includes('debug') || text.includes('script') ||
      text.includes('algorithm') || text.includes('syntax')) {
    tags.push('code');
  }
  
  if (text.includes('analyze') || text.includes('reason') || text.includes('think') || 
      text.includes('solve') || text.includes('problem') || text.includes('logic') ||
      text.includes('explain') || text.includes('understand') || text.includes('complex')) {
    tags.push('reasoning');
  }
  
  if (text.length < 100 || text.includes('quick') || text.includes('simple') || 
      text.includes('fast') || text.includes('brief') || text.includes('short')) {
    tags.push('quick');
  }
  
  // Default tag if no specific category found
  if (tags.length === 0) {
    tags.push('quick');
  }
  
  return tags;
}

function generateRecommendations(tags: string[]): ModelRecommendation[] {
  const recommended: ModelRecommendation[] = [];
  
  if (tags.includes('code')) {
    recommended.push({
      model: 'claude-3-5-sonnet-20241022',
      why: 'Excellent for code generation and programming tasks',
      fitScore: 0.95
    });
    recommended.push({
      model: 'gpt-5-2025-08-07',
      why: 'Strong coding capabilities and debugging',
      fitScore: 0.88
    });
  }
  
  if (tags.includes('reasoning')) {
    recommended.push({
      model: 'claude-3-5-sonnet-20241022',
      why: 'Superior reasoning and complex analysis',
      fitScore: 0.92
    });
    recommended.push({
      model: 'gpt-5-2025-08-07',
      why: 'Advanced reasoning capabilities',
      fitScore: 0.89
    });
  }
  
  if (tags.includes('quick')) {
    recommended.push({
      model: 'gpt-5-nano-2025-08-07',
      why: 'Fast and efficient for quick tasks',
      fitScore: 0.90
    });
    recommended.push({
      model: 'mistral-large',
      why: 'Quick responses with good quality',
      fitScore: 0.85
    });
  }
  
  // Remove duplicates and sort by fitScore
  const uniqueRecommended = recommended.reduce((acc, current) => {
    const existing = acc.find(item => item.model === current.model);
    if (!existing || existing.fitScore < current.fitScore) {
      return [...acc.filter(item => item.model !== current.model), current];
    }
    return acc;
  }, [] as ModelRecommendation[]);
  
  // Always include at least one fallback option
  if (!uniqueRecommended.find(r => r.model === 'gpt-5-2025-08-07')) {
    uniqueRecommended.push({
      model: 'gpt-5-2025-08-07',
      why: 'Versatile model for general tasks',
      fitScore: 0.80
    });
  }
  
  return uniqueRecommended
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 3); // Limit to top 3 recommendations
}

async function handleAnalyze(req: Request, corrId: string): Promise<Response> {
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
  
  const { message, history = [] }: AnalyzeRequest = await req.json();
  
  if (!message || typeof message !== 'string') {
    const error = createStructuredError('BAD_INPUT', 'Invalid message parameter', corrId, 400);
    return new Response(JSON.stringify(error), {
      status: error.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`[${corrId}] Analyzing message length: ${message.length}`);

  // Deterministic tag analysis
  const tags = analyzeMessageTags(message);
  
  // Generate model recommendations based on tags
  const recommended = generateRecommendations(tags);

  const response: AnalyzeResponse = {
    tags,
    recommended,
    corrId
  };

  // Log successful operation
  await logOpsEvent(supabaseClient, user.id, corrId, 'info', 'ANALYZE_SUCCESS', 'Message analysis completed', {
    tags,
    recommendedModels: recommended.map(r => r.model)
  });

  console.log(`[${corrId}] Analysis completed:`, response);

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
    console.log(`[${corrId}] Analyze function called`);

    // Apply 1500ms timeout
    const response = await withTimeout(
      handleAnalyze(req, corrId),
      1500,
      'analyze',
      corrId
    );

    return response;
  } catch (error) {
    console.error(`[${corrId}] Error in analyze function:`, error);
    
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