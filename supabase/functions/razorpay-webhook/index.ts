import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RechargeWebhookRequest {
  amount: number;
  currency: string;
  userId?: string;
  paymentId?: string;
  signature?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Razorpay webhook called');
    
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Create Supabase client with service role for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: RechargeWebhookRequest = await req.json();
    
    // Mock recharge event for now
    const {
      amount = 1000, // ₹10.00 in paisa (100 paisa = 1 INR)
      currency = 'INR',
      userId = 'mock-user-id',
      paymentId = 'mock-payment-' + Date.now()
    } = body;

    console.log(`Processing recharge: ₹${amount/100} for user ${userId}`);

    // TODO: In production, validate Razorpay signature here
    // const isValidSignature = validateRazorpaySignature(req.headers, body);
    // if (!isValidSignature) {
    //   throw new Error('Invalid signature');
    // }

    const amountINR = amount / 100; // Convert paisa to INR

    // Check if user wallet exists
    const { data: walletData, error: walletError } = await supabaseClient
      .from('wallets')
      .select('balance_inr, balance_display')
      .eq('user_id', userId)
      .single();

    if (walletError && walletError.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Wallet fetch error:', walletError);
      throw new Error('Failed to fetch wallet data');
    }

    let newBalance: number;
    
    if (!walletData) {
      // Create new wallet if it doesn't exist
      newBalance = amountINR;
      const { error: createError } = await supabaseClient
        .from('wallets')
        .insert({
          user_id: userId,
          balance_inr: newBalance,
          balance_display: newBalance,
          currency: 'INR'
        });
      
      if (createError) {
        console.error('Wallet creation error:', createError);
        throw new Error('Failed to create wallet');
      }
    } else {
      // Update existing wallet
      newBalance = walletData.balance_inr + amountINR;
      const { error: updateError } = await supabaseClient
        .from('wallets')
        .update({
          balance_inr: newBalance,
          balance_display: newBalance
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Wallet update error:', updateError);
        throw new Error('Failed to update wallet balance');
      }
    }

    // Log recharge transaction
    const { error: transactionError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'recharge',
        amount_inr: amountINR,
        amount_display: amountINR,
        currency: 'INR',
        raw_cost_inr: null, // Not applicable for recharge
        deducted_cost_inr: null // Not applicable for recharge
      });

    if (transactionError) {
      console.error('Transaction log error:', transactionError);
      // Don't fail the whole operation for logging errors
      console.warn('Failed to log transaction, but wallet was updated successfully');
    }

    console.log(`Recharge successful. New balance: ₹${newBalance}`);

    return new Response(JSON.stringify({ 
      success: true,
      newBalance: newBalance,
      message: 'Recharge processed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in razorpay-webhook function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});