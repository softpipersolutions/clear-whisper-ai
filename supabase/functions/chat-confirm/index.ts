import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { 
  generateCorrId, 
  checkRateLimit, 
  logOpsEvent, 
  checkIdempotency,
  hashIdempotencyKey 
} from "../_shared/hardening.ts";
import { isSupportedModel } from "../_shared/catalog.ts";

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
  corrId: string;
}

serve(async (req) => {
  const corrId = generateCorrId();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[${corrId}] Chat confirm request started`);

  try {
    if (req.method !== 'POST') {
      throw new Error('BAD_INPUT: Method not allowed');
    }
    
    // Create Supabase client with service role for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('UNAUTHORIZED: No authorization header');
    }

    // Extract user ID from JWT (service role bypasses auth.uid() so we need to decode manually)
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.sub;
    
    if (!userId) {
      throw new Error('UNAUTHORIZED: User not authenticated');
    }

    console.log(`[${corrId}] User authenticated: ${userId}`);

    // Rate limiting check
    const rateLimitResult = await checkRateLimit(supabaseClient, userId, 'chat_confirm', 12, corrId);
    if (!rateLimitResult.allowed) {
      await logOpsEvent(supabaseClient, userId, corrId, 'warn', 'RATE_LIMITED', 'Chat confirm rate limit exceeded');
      return new Response(JSON.stringify({ 
        error: 'RATE_LIMITED', 
        message: 'Too many requests. Please wait before trying again.',
        retryAfterSec: rateLimitResult.retryAfterSec,
        corrId 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { message, model, estCostINR }: ChatConfirmRequest = await req.json();
    
    if (!message || !model || typeof estCostINR !== 'number') {
      throw new Error('BAD_INPUT: Missing required fields: message, model, estCostINR');
    }

    // Validate model
    if (!isSupportedModel(model)) {
      throw new Error('BAD_INPUT: Unsupported model');
    }

    console.log(`[${corrId}] Processing chat confirm for user: ${userId}, model: ${model}, cost: ₹${estCostINR}`);

    // Idempotency check
    const idempotencyKey = hashIdempotencyKey(userId, message, model);
    const { isNew } = await checkIdempotency(supabaseClient, idempotencyKey, userId, corrId);
    
    if (!isNew) {
      console.log(`[${corrId}] Idempotent replay detected, returning success`);
      await logOpsEvent(supabaseClient, userId, corrId, 'info', 'IDEMPOTENT_REPLAY', 'Chat confirm idempotent replay');
      
      return new Response(JSON.stringify({ 
        ok: true, 
        message: 'Request already processed',
        corrId 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch wallet data
    const { data: walletData, error: walletError } = await supabaseClient
      .from('wallets')
      .select('balance_inr, currency')
      .eq('user_id', userId)
      .single();

    if (walletError && walletError.code !== 'PGRST116') {
      console.error(`[${corrId}] Wallet fetch error:`, walletError);
      await logOpsEvent(supabaseClient, userId, corrId, 'error', 'WALLET_FETCH_ERROR', 'Failed to fetch wallet', { error: walletError });
      throw new Error('INTERNAL: Failed to fetch wallet data');
    }

    if (!walletData) {
      console.log(`[${corrId}] No wallet found, creating one...`);
      const { error: createError } = await supabaseClient
        .from('wallets')
        .insert({
          user_id: userId,
          balance_inr: 0,
          balance_display: 0,
          currency: 'INR'
        });
      
      if (createError) {
        await logOpsEvent(supabaseClient, userId, corrId, 'error', 'WALLET_CREATE_ERROR', 'Failed to create wallet', { error: createError });
        throw new Error('INTERNAL: Failed to create wallet');
      }
      
      await logOpsEvent(supabaseClient, userId, corrId, 'warn', 'INSUFFICIENT_FUNDS', 'New wallet has zero balance');
      return new Response(JSON.stringify({
        error: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient wallet balance',
        corrId
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate deducted cost (raw cost + 2% fee, but don't expose fee to client)
    const rawCostINR = estCostINR;
    const deductedCostINR = rawCostINR * 1.02; // 2% fee applied internally
    const currentBalance = walletData.balance_inr;

    console.log(`[${corrId}] Raw cost: ₹${rawCostINR}, Deducted cost: ₹${deductedCostINR}, Current balance: ₹${currentBalance}`);

    // Check if sufficient funds
    if (currentBalance < deductedCostINR) {
      console.log(`[${corrId}] Insufficient funds: required ₹${deductedCostINR}, available ₹${currentBalance}`);
      await logOpsEvent(supabaseClient, userId, corrId, 'warn', 'INSUFFICIENT_FUNDS', 'Transaction blocked due to insufficient funds', 
        { required: deductedCostINR, available: currentBalance });
      
      return new Response(JSON.stringify({ 
        error: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient wallet balance',
        corrId
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Atomic deduction transaction
    const newBalance = currentBalance - deductedCostINR;

    // Update wallet balance
    const { error: updateError } = await supabaseClient
      .from('wallets')
      .update({
        balance_inr: newBalance,
        balance_display: newBalance
      })
      .eq('user_id', userId)
      .eq('balance_inr', currentBalance); // Optimistic concurrency control

    if (updateError) {
      console.error(`[${corrId}] Wallet update failed:`, updateError);
      await logOpsEvent(supabaseClient, userId, corrId, 'error', 'WALLET_UPDATE_ERROR', 'Failed to deduct from wallet', 
        { error: updateError, amount: deductedCostINR });
      throw new Error('INTERNAL: Failed to process payment');
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
      console.error(`[${corrId}] Transaction log error:`, transactionError);
      // Don't fail the whole operation for logging errors
      console.warn(`[${corrId}] Failed to log transaction, but wallet was updated successfully`);
    }

    console.log(`[${corrId}] Wallet updated successfully. New balance: ₹${newBalance}`);

    // Log successful transaction
    await logOpsEvent(supabaseClient, userId, corrId, 'info', 'CHAT_CONFIRM_SUCCESS', 'Successfully processed chat confirmation', 
      { model, amountINR: deductedCostINR, newBalance });

    const response: ChatConfirmResponse = {
      ok: true,
      newBalanceINR: Math.round(newBalance * 100) / 100,
      corrId
    };

    console.log(`[${corrId}] Chat confirm completed successfully`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`[${corrId}] Error in chat-confirm function:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    let errorCode = 'INTERNAL';
    let status = 500;
    
    // Parse structured error codes
    if (errorMessage.includes('BAD_INPUT:')) {
      errorCode = 'BAD_INPUT';
      status = 400;
    } else if (errorMessage.includes('UNAUTHORIZED:')) {
      errorCode = 'UNAUTHORIZED';
      status = 401;
    } else if (errorMessage.includes('INSUFFICIENT_FUNDS:')) {
      errorCode = 'INSUFFICIENT_FUNDS';
      status = 402;
    } else if (errorMessage.includes('INTERNAL:')) {
      errorCode = 'INTERNAL';
      status = 500;
    }
    
    // Create Supabase client for error logging
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
      message: errorMessage.replace(/^[A-Z_]+:\s*/, ''), // Remove error code prefix
      corrId
    }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});