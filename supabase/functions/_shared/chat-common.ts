import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { 
  generateCorrId, 
  checkRateLimit, 
  logOpsEvent, 
  checkIdempotency,
  hashIdempotencyKey 
} from "./hardening.ts";
import { isSupportedModel, getModelById } from "./catalog.ts";
import { 
  isHttpUnsupportedModel,
  ProviderError,
  type ChatArgs, 
  type ChatOut 
} from "./providers.ts";

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface ChatConfirmRequest {
  message: string;
  model: string;
  estCostINR: number;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatConfirmResponse {
  ok: boolean;
  newBalanceINR?: number;
  assistantText?: string;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
  corrId: string;
}

export interface ChatContext {
  corrId: string;
  userId: string;
  supabaseClient: any;
  request: ChatConfirmRequest;
  currentBalance: number;
  deductedCostINR: number;
  rawCostINR: number;
}

// Common authentication and setup
export async function setupChatRequest(req: Request): Promise<{
  corrId: string;
  userId: string;
  supabaseClient: any;
}> {
  const corrId = generateCorrId();
  
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

  // Extract user ID from JWT
  const token = authHeader.replace('Bearer ', '');
  const payload = JSON.parse(atob(token.split('.')[1]));
  const userId = payload.sub;
  
  if (!userId) {
    throw new Error('UNAUTHORIZED: User not authenticated');
  }

  console.log(`[${corrId}] User authenticated: ${userId}`);
  return { corrId, userId, supabaseClient };
}

// Common request validation and processing
export async function processCommonValidation(
  supabaseClient: any,
  userId: string,
  corrId: string,
  reqData: ChatConfirmRequest,
  supportedModels: string[]
): Promise<ChatContext> {
  // Rate limiting check
  const rateLimitResult = await checkRateLimit(supabaseClient, userId, 'chat_confirm', 12, corrId);
  if (!rateLimitResult.allowed) {
    await logOpsEvent(supabaseClient, userId, corrId, 'warn', 'RATE_LIMITED', 'Chat confirm rate limit exceeded');
    throw new Error(`RATE_LIMITED: Too many requests. Please wait ${rateLimitResult.retryAfterSec} seconds.`);
  }

  const { message, model, estCostINR, temperature, max_tokens } = reqData;
  
  if (!message || !model || typeof estCostINR !== 'number') {
    throw new Error('BAD_INPUT: Missing required fields: message, model, estCostINR');
  }

  // Validate model is supported by this provider
  if (!supportedModels.includes(model)) {
    throw new Error(`BAD_INPUT: Model "${model}" not supported by this provider`);
  }

  // Validate model exists in catalog
  if (!isSupportedModel(model)) {
    throw new Error('BAD_INPUT: Unsupported model');
  }

  // Check if model is HTTP unsupported
  if (isHttpUnsupportedModel(model)) {
    throw new Error('BAD_INPUT: Use realtime channel for this model');
  }

  console.log(`[${corrId}] Processing chat confirm for user: ${userId}, model: ${model}, cost: ₹${estCostINR}`);

  // Idempotency check
  const idempotencyKey = hashIdempotencyKey(userId, message, model);
  const { isNew } = await checkIdempotency(supabaseClient, idempotencyKey, userId, corrId);
  
  if (!isNew) {
    console.log(`[${corrId}] Idempotent replay detected, returning success`);
    await logOpsEvent(supabaseClient, userId, corrId, 'info', 'IDEMPOTENT_REPLAY', 'Chat confirm idempotent replay');
    throw new Error('IDEMPOTENT_REPLAY');
  }

  // Fetch and validate wallet
  const { currentBalance, deductedCostINR, rawCostINR } = await validateAndDeductWallet(
    supabaseClient, userId, corrId, estCostINR
  );

  return {
    corrId,
    userId,
    supabaseClient,
    request: reqData,
    currentBalance,
    deductedCostINR,
    rawCostINR
  };
}

// Wallet validation and deduction
async function validateAndDeductWallet(
  supabaseClient: any,
  userId: string,
  corrId: string,
  estCostINR: number
): Promise<{ currentBalance: number; deductedCostINR: number; rawCostINR: number }> {
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
    throw new Error('INSUFFICIENT_FUNDS: Insufficient wallet balance');
  }

  // Calculate deducted cost (raw cost + 2% fee)
  const rawCostINR = estCostINR;
  const deductedCostINR = rawCostINR * 1.02;
  const currentBalance = walletData.balance_inr;

  console.log(`[${corrId}] Raw cost: ₹${rawCostINR}, Deducted cost: ₹${deductedCostINR}, Current balance: ₹${currentBalance}`);

  // Check if sufficient funds
  if (currentBalance < deductedCostINR) {
    console.log(`[${corrId}] Insufficient funds: required ₹${deductedCostINR}, available ₹${currentBalance}`);
    await logOpsEvent(supabaseClient, userId, corrId, 'warn', 'INSUFFICIENT_FUNDS', 'Transaction blocked due to insufficient funds', 
      { required: deductedCostINR, available: currentBalance });
    throw new Error('INSUFFICIENT_FUNDS: Insufficient wallet balance');
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
    console.warn(`[${corrId}] Failed to log transaction, but wallet was updated successfully`);
  }

  console.log(`[${corrId}] Wallet updated successfully. New balance: ₹${newBalance}`);
  
  return { currentBalance, deductedCostINR, rawCostINR };
}

// Wallet rollback in case of provider failure
export async function rollbackWallet(
  context: ChatContext,
  providerError: Error
): Promise<void> {
  const { corrId, userId, supabaseClient, currentBalance, deductedCostINR, rawCostINR } = context;
  
  console.log(`[${corrId}] Rolling back wallet deduction due to provider failure`);
  
  try {
    // Add refund transaction
    const { error: refundError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'recharge',
        amount_inr: deductedCostINR,
        amount_display: deductedCostINR,
        currency: 'INR',
        raw_cost_inr: rawCostINR,
        deducted_cost_inr: deductedCostINR
      });
      
    if (refundError) {
      console.error(`[${corrId}] Refund transaction failed:`, refundError);
    }
    
    // Update wallet balance back to original
    const { error: rollbackError } = await supabaseClient
      .from('wallets')
      .update({
        balance_inr: currentBalance,
        balance_display: currentBalance
      })
      .eq('user_id', userId);
      
    if (rollbackError) {
      console.error(`[${corrId}] Wallet rollback failed:`, rollbackError);
      await logOpsEvent(supabaseClient, userId, corrId, 'error', 'ROLLBACK_FAILED', 'Failed to rollback wallet after provider failure', { 
        error: rollbackError,
        originalBalance: currentBalance,
        deductedAmount: deductedCostINR
      });
    } else {
      console.log(`[${corrId}] Wallet rollback successful`);
      await logOpsEvent(supabaseClient, userId, corrId, 'info', 'ROLLBACK_SUCCESS', 'Wallet rollback completed', {
        originalBalance: currentBalance,
        deductedAmount: deductedCostINR
      });
    }
    
  } catch (rollbackError) {
    console.error(`[${corrId}] Rollback process failed:`, rollbackError);
    await logOpsEvent(supabaseClient, userId, corrId, 'error', 'ROLLBACK_ERROR', 'Rollback process encountered error', {
      error: rollbackError,
      originalBalance: currentBalance,
      deductedAmount: deductedCostINR
    });
  }
}

// Create success response
export function createSuccessResponse(
  context: ChatContext,
  providerResult: ChatOut,
  providerName: string
): Response {
  const { corrId, userId, supabaseClient, deductedCostINR, currentBalance } = context;
  const newBalance = currentBalance - deductedCostINR;

  // Log successful transaction (fire and forget)
  logOpsEvent(supabaseClient, userId, corrId, 'info', 'CHAT_CONFIRM_SUCCESS', 'Successfully processed chat confirmation with AI response', 
    { 
      model: context.request.model, 
      provider: providerName, 
      amountINR: deductedCostINR, 
      newBalance,
      tokensIn: providerResult.tokensIn,
      tokensOut: providerResult.tokensOut
    });

  const response: ChatConfirmResponse = {
    ok: true,
    newBalanceINR: Math.round(newBalance * 100) / 100,
    assistantText: providerResult.text,
    tokensIn: providerResult.tokensIn,
    tokensOut: providerResult.tokensOut,
    corrId
  };

  console.log(`[${corrId}] Chat confirm completed successfully with AI response`);

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Create error response
export function createErrorResponse(
  corrId: string,
  error: Error,
  context?: ChatContext
): Response {
  console.error(`[${corrId}] Error in chat function:`, error);
  
  const errorMessage = error instanceof Error ? error.message : 'Internal server error';
  let errorCode = 'INTERNAL';
  let status = 500;
  
  // Handle idempotent replay
  if (errorMessage.includes('IDEMPOTENT_REPLAY')) {
    return new Response(JSON.stringify({ 
      ok: true, 
      message: 'Request already processed',
      corrId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
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
  } else if (errorMessage.includes('NO_API_KEY:')) {
    errorCode = 'NO_API_KEY';
    status = 503;
  } else if (errorMessage.includes('RATE_LIMITED:')) {
    errorCode = 'RATE_LIMITED';
    status = 429;
  } else if (errorMessage.includes('SERVICE_UNAVAILABLE:')) {
    errorCode = 'SERVICE_UNAVAILABLE';
    status = 503;
  }

  // Enhanced error message for provider errors
  const finalMessage = errorCode === 'BAD_INPUT' 
    ? `Model validation failed: ${errorMessage.replace(/^[A-Z_]+:\s*/, '')}`
    : errorMessage.replace(/^[A-Z_]+:\s*/, '');
  
  return new Response(JSON.stringify({ 
    ok: false,
    error: errorCode,
    message: finalMessage,
    corrId
  }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}