import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Analyze function called');
    
    const { message, history = [] }: AnalyzeRequest = await req.json();
    
    if (!message || typeof message !== 'string') {
      throw new Error('Invalid message parameter');
    }

    console.log(`Analyzing message: ${message.substring(0, 100)}...`);

    const text = message.toLowerCase();
    const tags: string[] = [];
    
    // Simple keyword-based tag inference
    if (text.includes('code') || text.includes('programming') || text.includes('function')) {
      tags.push('coding');
    }
    if (text.includes('write') || text.includes('essay') || text.includes('article')) {
      tags.push('writing');
    }
    if (text.includes('analyze') || text.includes('data') || text.includes('research')) {
      tags.push('analysis');
    }
    if (text.includes('creative') || text.includes('story') || text.includes('poem')) {
      tags.push('creative');
    }
    if (text.includes('help') || text.includes('how') || text.includes('what') || text.includes('explain')) {
      tags.push('helpful');
    }
    
    // Default tag if no specific category found
    if (tags.length === 0) {
      tags.push('general');
    }

    // Generate model recommendations based on tags
    const recommended: ModelRecommendation[] = [];
    
    if (tags.includes('coding')) {
      recommended.push({
        model: 'claude-3-5-sonnet',
        why: 'Excellent for code generation and programming tasks',
        fitScore: 0.95
      });
    }
    
    if (tags.includes('creative')) {
      recommended.push({
        model: 'gpt-4o',
        why: 'Strong creative writing capabilities',
        fitScore: 0.90
      });
    }
    
    if (tags.includes('analysis')) {
      recommended.push({
        model: 'claude-3-5-sonnet',
        why: 'Superior reasoning and analysis skills',
        fitScore: 0.92
      });
    }
    
    // Always include GPT-4o as a general recommendation
    if (!recommended.find(r => r.model === 'gpt-4o')) {
      recommended.push({
        model: 'gpt-4o',
        why: 'Fast and versatile for general tasks',
        fitScore: 0.85
      });
    }
    
    // Add Llama as an open source option
    recommended.push({
      model: 'llama-3.1-405b',
      why: 'Open source alternative with good performance',
      fitScore: 0.80
    });

    const response: AnalyzeResponse = {
      tags,
      recommended: recommended.slice(0, 3) // Limit to top 3 recommendations
    };

    console.log('Analyze response:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});