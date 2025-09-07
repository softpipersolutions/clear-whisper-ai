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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting ExchangeRate-API FX rate update...');

    // Fetch rates from ExchangeRate-API
    const apiResponse = await fetch('https://api.exchangerate-api.com/v4/latest/INR');
    
    if (!apiResponse.ok) {
      throw new Error(`ExchangeRate-API failed: ${apiResponse.status} - ${apiResponse.statusText}`);
    }

    const apiData = await apiResponse.json();
    
    if (!apiData.rates) {
      throw new Error('Invalid response from ExchangeRate-API: missing rates');
    }

    console.log('ExchangeRate-API response received:', Object.keys(apiData.rates).length, 'currencies');

    // Extract required currencies
    const rates: Record<string, number> = {};
    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SGD'];
    
    currencies.forEach(currency => {
      if (apiData.rates[currency]) {
        rates[currency] = apiData.rates[currency];
      }
    });

    // Validate that we have some rates
    if (Object.keys(rates).length === 0) {
      throw new Error('No valid exchange rates found');
    }

    // Validate rate values are reasonable
    for (const [currency, rate] of Object.entries(rates)) {
      if (typeof rate !== 'number' || rate <= 0 || rate > 1000) {
        console.warn(`Suspicious rate for ${currency}:`, rate);
      }
    }

    console.log('Extracted rates:', rates);

    // Store the updated rates in the database
    const { error: insertError } = await supabase
      .from('fx_rates')
      .insert({
        base: 'INR',
        rates: rates,
        fetched_at: new Date().toISOString(),
        source: 'exchangerate-api',
        prompt_version: null,
        confidence_score: 0.99
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

    console.log('Successfully updated FX rates via ExchangeRate-API:', rates);

    const response: FxUpdateResponse = {
      success: true,
      message: 'Exchange rates updated successfully',
      rates: rates
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fx-updater function:', error);
    
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
