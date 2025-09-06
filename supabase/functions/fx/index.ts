import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FxResponse {
  base: string;
  rates: Record<string, number>;
  fetchedAt: string;
  stale?: boolean;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('FX function called');

    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Create Supabase client with service role for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const toParam = body.to || 'USD';
    const toCurrencies = toParam.split(',').map(c => c.trim().toUpperCase());
    
    console.log(`FX rates requested for: ${toCurrencies.join(', ')}`);

    // Check latest cached rate
    const { data: cachedData, error: cacheError } = await supabaseClient
      .from('fx_rates')
      .select('*')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (cacheError && cacheError.code !== 'PGRST116') {
      console.error('Cache fetch error:', cacheError);
    }

    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    
    let rates = {};
    let fetchedAt = '';
    let stale = false;

    // Check if cached data is fresh (≤6h old)
    if (cachedData && new Date(cachedData.fetched_at) > sixHoursAgo) {
      console.log('Using fresh cached rates');
      rates = cachedData.rates;
      fetchedAt = cachedData.fetched_at;
    } else {
      console.log('Cache stale or missing, fetching from API');
      
      try {
        // Fetch from ExchangeRate.host (free, no API key required)
        const apiResponse = await fetch('https://api.exchangerate.host/latest?base=INR');
        
        if (!apiResponse.ok) {
          throw new Error(`API response not OK: ${apiResponse.status}`);
        }
        
        const apiData = await apiResponse.json();
        
        if (!apiData.success || !apiData.rates) {
          throw new Error('Invalid API response format');
        }

        console.log('Successfully fetched rates from API');
        
        // Store new rates in database
        const { error: insertError } = await supabaseClient
          .from('fx_rates')
          .insert({
            base: 'INR',
            rates: apiData.rates,
            fetched_at: now.toISOString()
          });

        if (insertError) {
          console.error('Failed to cache rates:', insertError);
          // Continue with API data even if caching fails
        }

        rates = apiData.rates;
        fetchedAt = now.toISOString();
        
      } catch (apiError) {
        console.error('External API failed:', apiError);
        
        // Fallback to last cached data if available
        if (cachedData) {
          console.log('Using stale cached rates as fallback');
          rates = cachedData.rates;
          fetchedAt = cachedData.fetched_at;
          stale = true;
        } else {
          console.log('No cached data available');
          return new Response(JSON.stringify({ 
            error: 'FX_UNAVAILABLE',
            message: 'Exchange rates unavailable'
          }), {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Filter rates to requested currencies
    const filteredRates: Record<string, number> = {};
    for (const currency of toCurrencies) {
      if (rates[currency]) {
        filteredRates[currency] = rates[currency];
      }
    }

    const response: FxResponse = {
      base: 'INR',
      rates: filteredRates,
      fetchedAt,
      ...(stale && { stale: true })
    };

    console.log('FX response:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fx function:', error);
    return new Response(JSON.stringify({ 
      error: 'INTERNAL_ERROR',
      message: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});