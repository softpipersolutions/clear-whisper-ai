import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatConfirmRequest {
  message: string;
  model: string;
  estCostINR: number;
}

interface ChatConfirmResponse {
  ok: boolean;
  newBalanceINR?: number;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Chat-confirm function called');
    
    const { message, model, estCostINR }: ChatConfirmRequest = await req.json();
    
    if (!message || typeof message !== 'string') {
      throw new Error('Invalid message parameter');
    }
    
    if (!model || typeof model !== 'string') {
      throw new Error('Invalid model parameter');
    }
    
    if (typeof estCostINR !== 'number' || estCostINR < 0) {
      throw new Error('Invalid estCostINR parameter');
    }

    console.log(`Chat confirm for model: ${model}, cost: ₹${estCostINR}`);

    // Mock wallet balance - in real implementation this would check user's actual balance
    const mockWalletBalance = 100.00; // ₹100
    
    if (estCostINR > mockWalletBalance) {
      console.log('Insufficient funds');
      const response: ChatConfirmResponse = {
        ok: false,
        error: 'INSUFFICIENT_FUNDS'
      };
      
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Simulate successful confirmation
    const newBalance = mockWalletBalance - estCostINR;
    const response: ChatConfirmResponse = {
      ok: true,
      newBalanceINR: Math.round(newBalance * 100) / 100
    };

    console.log('Chat confirmed, new balance:', response.newBalanceINR);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in chat-confirm function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});