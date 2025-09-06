import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FxResponse {
  rate: number;
  lastUpdated: string;
  stale?: boolean;
  from: string;
  to: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('FX function called');

    if (req.method !== 'GET') {
      throw new Error('Method not allowed');
    }

    const url = new URL(req.url);
    const toCurrency = url.searchParams.get('to') || 'USD';
    
    console.log(`FX rate requested: INR to ${toCurrency}`);

    // Mock exchange rates - in real implementation this would fetch from a live API
    const mockRates: Record<string, number> = {
      'USD': 0.012, // 1 INR = 0.012 USD
      'EUR': 0.011, // 1 INR = 0.011 EUR
      'GBP': 0.0095, // 1 INR = 0.0095 GBP
      'INR': 1.0 // 1 INR = 1 INR
    };

    const rate = mockRates[toCurrency.toUpperCase()];
    
    if (!rate) {
      throw new Error(`Unsupported currency: ${toCurrency}`);
    }

    // Simulate data age - mark as stale if older than 1 hour
    const lastUpdated = new Date();
    lastUpdated.setMinutes(lastUpdated.getMinutes() - 30); // 30 minutes ago
    
    const response: FxResponse = {
      rate,
      lastUpdated: lastUpdated.toISOString(),
      stale: false, // 30 minutes old, not stale yet
      from: 'INR',
      to: toCurrency.toUpperCase()
    };

    console.log('FX response:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fx function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});