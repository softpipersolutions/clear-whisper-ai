import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    
    // Create Supabase client with service role for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Extract user ID from JWT (service role bypasses auth.uid() so we need to decode manually)
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.sub;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

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

    console.log(`Chat confirm for user: ${userId}, model: ${model}, cost: ₹${estCostINR}`);

    // Begin transaction
    const { data: walletData, error: walletError } = await supabaseClient
      .from('wallets')
      .select('balance_inr, currency')
      .eq('user_id', userId)
      .single();

    if (walletError) {
      console.error('Wallet fetch error:', walletError);
      throw new Error('Failed to fetch wallet data');
    }

    if (!walletData) {
      console.log('No wallet found, creating one...');
      // Create wallet if it doesn't exist
      const { error: createError } = await supabaseClient
        .from('wallets')
        .insert({
          user_id: userId,
          balance_inr: 0,
          balance_display: 0,
          currency: 'INR'
        });
      
      if (createError) {
        throw new Error('Failed to create wallet');
      }
      
      // Return insufficient funds since new wallet has 0 balance
      const response: ChatConfirmResponse = {
        ok: false,
        error: 'INSUFFICIENT_FUNDS'
      };
      
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate deducted cost (raw cost + 2% fee, but don't expose fee to client)
    const rawCostINR = estCostINR;
    const deductedCostINR = rawCostINR * 1.02; // 2% fee applied internally

    console.log(`Raw cost: ₹${rawCostINR}, Deducted cost: ₹${deductedCostINR}, Current balance: ₹${walletData.balance_inr}`);

    // Check if sufficient funds
    if (walletData.balance_inr < deductedCostINR) {
      console.log('Insufficient funds');
      const response: ChatConfirmResponse = {
        ok: false,
        error: 'INSUFFICIENT_FUNDS'
      };
      
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Perform atomic transaction: deduct from wallet and log transaction
    const newBalance = walletData.balance_inr - deductedCostINR;

    // Update wallet balance
    const { error: updateError } = await supabaseClient
      .from('wallets')
      .update({
        balance_inr: newBalance,
        balance_display: newBalance // For now, display = INR balance
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Wallet update error:', updateError);
      throw new Error('Failed to update wallet balance');
    }

    // Log transaction
    const { error: transactionError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'deduction',
        amount_inr: deductedCostINR,
        amount_display: deductedCostINR,
        currency: 'INR',
        raw_cost_inr: rawCostINR,
        deducted_cost_inr: deductedCostINR
      });

    if (transactionError) {
      console.error('Transaction log error:', transactionError);
      // Don't fail the whole operation for logging errors, but log it
      console.warn('Failed to log transaction, but wallet was updated successfully');
    }

    const response: ChatConfirmResponse = {
      ok: true,
      newBalanceINR: Math.round(newBalance * 100) / 100 // Round to 2 decimals
    };

    console.log('Chat confirmed successfully, new balance:', response.newBalanceINR);

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