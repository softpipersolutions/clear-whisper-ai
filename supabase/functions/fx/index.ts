import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { generateCorrId, checkRateLimit, logOpsEvent, withTimeout, circuitBreakers } from "../_shared/hardening.ts";

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
  const corrId = generateCorrId();
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[${corrId}] FX function called`);

    if (req.method !== 'POST') {
      throw new Error('BAD_INPUT: Method not allowed');
    }

    // Extract and validate user for rate limiting (optional auth)
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub;
      } catch (error) {
        console.warn(`[${corrId}] Failed to parse auth token:`, error);
      }
    }

    // Create Supabase client with service role for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Rate limiting (if user authenticated)
    if (userId) {
      const rateLimitResult = await checkRateLimit(supabaseClient, userId, 'fx', 30, corrId);
      if (!rateLimitResult.allowed) {
        await logOpsEvent(supabaseClient, userId, corrId, 'warn', 'RATE_LIMITED', 'FX rate limit exceeded');
        return new Response(JSON.stringify({ 
          error: 'RATE_LIMITED', 
          message: 'Too many FX requests. Please wait before trying again.',
          retryAfterSec: rateLimitResult.retryAfterSec,
          corrId 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const body = await req.json();
    const toParam = body.to || 'USD';
    const toCurrencies = toParam.split(',').map(c => c.trim().toUpperCase());
    
    console.log(`[${corrId}] FX rates requested for: ${toCurrencies.join(', ')}`);

    // Check latest cached rate
    const { data: cachedData, error: cacheError } = await supabaseClient
      .from('fx_rates')
      .select('*')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (cacheError && cacheError.code !== 'PGRST116') {
      console.error(`[${corrId}] Cache fetch error:`, cacheError);
    }

    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    
    let rates = {};
    let fetchedAt = '';
    let stale = false;

    // Check if cached data is fresh (≤6h old)
    if (cachedData && new Date(cachedData.fetched_at) > sixHoursAgo) {
      console.log(`[${corrId}] Using fresh cached rates`);
      rates = cachedData.rates;
      fetchedAt = cachedData.fetched_at;
    } else {
      console.log(`[${corrId}] Cache stale or missing, fetching from API`);
      
      try {
        // Fetch from ExchangeRate.host with circuit breaker and timeout
        const fetchOperation = () => withTimeout(
          fetch('https://api.exchangerate.host/latest?base=INR'),
          1500,
          'ExchangeRate.host API',
          corrId
        );

        const apiResponse = await circuitBreakers.fx.execute(fetchOperation, 'fx_api', corrId);
        
        if (!apiResponse.ok) {
          throw new Error(`API response not OK: ${apiResponse.status}`);
        }
        
        const apiData = await apiResponse.json();
        
        if (!apiData.success || !apiData.rates) {
          throw new Error('Invalid API response format');
        }

        console.log(`[${corrId}] Successfully fetched rates from API`);
        
        // Store new rates in database
        const { error: insertError } = await supabaseClient
          .from('fx_rates')
          .insert({
            base: 'INR',
            rates: apiData.rates,
            fetched_at: now.toISOString()
          });

        if (insertError) {
          console.error(`[${corrId}] Failed to cache rates:`, insertError);
          // Continue with API data even if caching fails
        }

        rates = apiData.rates;
        fetchedAt = now.toISOString();
        
        await logOpsEvent(supabaseClient, userId, corrId, 'info', 'FX_API_SUCCESS', 'Successfully fetched fresh FX rates');
        
      } catch (apiError) {
        console.error(`[${corrId}] External API failed:`, apiError);
        
        // Fallback to last cached data if available
        if (cachedData) {
          console.log(`[${corrId}] Using stale cached rates as fallback`);
          rates = cachedData.rates;
          fetchedAt = cachedData.fetched_at;
          stale = true;
          
          await logOpsEvent(supabaseClient, userId, corrId, 'warn', 'FX_STALE_FALLBACK', 'Using stale FX rates due to API failure', { error: apiError.message });
        } else {
          console.log(`[${corrId}] No cached data available`);
          await logOpsEvent(supabaseClient, userId, corrId, 'error', 'FX_UNAVAILABLE', 'FX rates completely unavailable', { error: apiError.message });
          
          return new Response(JSON.stringify({ 
            error: 'FX_UNAVAILABLE',
            message: 'Exchange rates unavailable',
            corrId
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

    console.log(`[${corrId}] FX response:`, response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`[${corrId}] Error in fx function:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    let errorCode = 'INTERNAL';
    let status = 500;
    
    if (errorMessage.includes('BAD_INPUT:')) {
      errorCode = 'BAD_INPUT';
      status = 400;
    }
    
    // Log error
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      await logOpsEvent(supabaseClient, null, corrId, 'error', errorCode, errorMessage);
    } catch (logError) {
      console.error(`[${corrId}] Failed to log error:`, logError);
    }
    
    return new Response(JSON.stringify({ 
      error: errorCode,
      message: errorMessage.replace(/^[A-Z_]+:\s*/, ''),
      corrId
    }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});