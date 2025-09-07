import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FxUpdateResponse {
  success: boolean;
  message: string;
  rates?: Record<string, number>;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting GPT-5 Nano FX rate update...');

    // Create intelligent prompt for GPT-5 Nano to get current exchange rates
    const prompt = `You are a financial data expert. Provide the current exchange rates from INR (Indian Rupee) to the following currencies: USD, EUR, GBP, JPY, AUD, CAD, CHF, CNY, SGD.

Return ONLY a valid JSON object in this exact format:
{
  "USD": 0.012,
  "EUR": 0.011,
  "GBP": 0.0095,
  "JPY": 1.78,
  "AUD": 0.018,
  "CAD": 0.016,
  "CHF": 0.011,
  "CNY": 0.085,
  "SGD": 0.016
}

The values should be the current exchange rates where 1 INR = X units of the target currency. Use today's market rates. Be accurate and provide realistic current values.`;

    // Call GPT-5 Nano for exchange rates
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          {
            role: 'system',
            content: 'You are a precise financial data API. Return only valid JSON with current exchange rates.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: 200,
        // Note: temperature not supported for GPT-5 models
      }),
    });

    if (!gptResponse.ok) {
      const error = await gptResponse.text();
      console.error('GPT API error:', error);
      throw new Error(`GPT API failed: ${gptResponse.status} - ${error}`);
    }

    const gptData = await gptResponse.json();
    const gptContent = gptData.choices[0].message.content;
    
    console.log('GPT-5 Nano response:', gptContent);

    // Parse the JSON response from GPT
    let rates: Record<string, number>;
    try {
      rates = JSON.parse(gptContent);
    } catch (parseError) {
      console.error('Failed to parse GPT response:', gptContent);
      throw new Error('Invalid JSON response from GPT');
    }

    // Validate that we have the expected currencies
    const expectedCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SGD'];
    const missingCurrencies = expectedCurrencies.filter(currency => !(currency in rates));
    
    if (missingCurrencies.length > 0) {
      console.warn('Missing currencies in GPT response:', missingCurrencies);
    }

    // Validate rate values are reasonable
    for (const [currency, rate] of Object.entries(rates)) {
      if (typeof rate !== 'number' || rate <= 0 || rate > 1000) {
        console.warn(`Suspicious rate for ${currency}:`, rate);
      }
    }

    // Store the updated rates in the database
    const { error: insertError } = await supabase
      .from('fx_rates')
      .insert({
        base: 'INR',
        rates: rates,
        fetched_at: new Date().toISOString(),
        source: 'gpt-5-nano',
        prompt_version: 'v1.0',
        confidence_score: 0.95
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error(`Failed to store rates: ${insertError.message}`);
    }

    // Clean up old records (keep last 30 entries)
    const { error: cleanupError } = await supabase
      .from('fx_rates')
      .delete()
      .not('id', 'in', 
        `(SELECT id FROM fx_rates ORDER BY fetched_at DESC LIMIT 30)`
      );

    if (cleanupError) {
      console.warn('Cleanup warning:', cleanupError);
    }

    console.log('Successfully updated FX rates via GPT-5 Nano:', rates);

    const response: FxUpdateResponse = {
      success: true,
      message: 'Exchange rates updated successfully',
      rates: rates
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fx-gpt-updater function:', error);
    
    const errorResponse: FxUpdateResponse = {
      success: false,
      message: 'Failed to update exchange rates',
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
