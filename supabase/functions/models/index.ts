import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getModelCatalog, ModelInfo } from "../_shared/catalog.ts";
import { methodGuard } from "../_shared/http.ts";

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

interface ModelPricingResponse {
  inputPer1M: number;
  outputPer1M: number;
  cachedInputPer1M?: number;
  unit?: 'tokens' | 'audioTokens';
}

interface ModelsResponse {
  models: ModelInfo[];
  pricing: {
    currency: 'USD' | 'INR';
    rates: Record<string, ModelPricingResponse>;
  };
  fx?: {
    usdToInr: number;
    fetchedAt: string;
    stale: boolean;
  };
}

serve(async (req) => {
  const guard = methodGuard(req, ['GET', 'POST']);
  if (guard) return guard;

  const corrId = crypto.randomUUID().slice(0, 8);

  try {
    console.log(`[${corrId}] Models function called (${req.method})`);

    // Get model catalog with lock status
    const models = getModelCatalog();
    
    // Create Supabase client for FX lookup
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch FX rate (USD to INR)
    let fxData: { usdToInr: number; fetchedAt: string; stale: boolean } | undefined;
    
    try {
      const { data: fxResponse, error: fxError } = await supabaseClient.functions.invoke('fx', {
        body: { to: 'USD' }
      });

      if (!fxError && fxResponse && fxResponse.rates?.USD) {
        // Convert INR->USD to USD->INR
        const usdToInr = 1 / fxResponse.rates.USD;
        fxData = {
          usdToInr,
          fetchedAt: fxResponse.fetchedAt,
          stale: fxResponse.stale || false
        };
      }
    } catch (error) {
      console.warn('FX lookup failed:', error);
    }

    // Build pricing map
    const usdRates: Record<string, ModelPricingResponse> = {};
    const inrRates: Record<string, ModelPricingResponse> = {};

    models.forEach(model => {
      const { pricingUSD } = model;
      
      // USD rates
      usdRates[model.id] = {
        inputPer1M: pricingUSD.inputPer1M,
        outputPer1M: pricingUSD.outputPer1M,
        ...(pricingUSD.cachedInputPer1M && { cachedInputPer1M: pricingUSD.cachedInputPer1M }),
        ...(pricingUSD.unit && { unit: pricingUSD.unit })
      };

      // INR rates (if FX available)
      if (fxData) {
        inrRates[model.id] = {
          inputPer1M: pricingUSD.inputPer1M * fxData.usdToInr,
          outputPer1M: pricingUSD.outputPer1M * fxData.usdToInr,
          ...(pricingUSD.cachedInputPer1M && { 
            cachedInputPer1M: pricingUSD.cachedInputPer1M * fxData.usdToInr 
          }),
          ...(pricingUSD.unit && { unit: pricingUSD.unit })
        };
      }
    });

    const response: ModelsResponse = {
      models,
      pricing: {
        currency: fxData ? 'INR' : 'USD',
        rates: fxData ? inrRates : usdRates
      },
      ...(fxData && { fx: fxData })
    };

    console.log(`Returning ${models.length} models with pricing in ${response.pricing.currency}`);

    return new Response(JSON.stringify(response), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5 minutes cache
      },
    });
  } catch (error) {
    console.error(`[${corrId}] Error in models function:`, error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      corrId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});