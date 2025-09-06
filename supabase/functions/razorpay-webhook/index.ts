import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { generateCorrId, logOpsEvent } from "../_shared/hardening.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
};

serve(async (req) => {
  const corrId = generateCorrId();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[${corrId}] Razorpay webhook received`);
  
  // Get Razorpay mode for logging
  const razorpayMode = Deno.env.get('RAZORPAY_MODE') || 'TEST';

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Create Supabase client with service role for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const event = await req.json();
    const eventId = event.payload?.payment?.entity?.id || event.payload?.order?.entity?.id || `unknown_${Date.now()}`;
    
    console.log(`[${corrId}] Processing webhook event: ${event.event}, ID: ${eventId}`);

    // Idempotency check - prevent duplicate webhook processing
    const { error: insertError } = await supabaseClient
      .from('webhook_events')
      .insert({
        provider: 'razorpay',
        event_id: eventId,
        payload: event
      });

    if (insertError && insertError.code === '23505') { // Unique constraint violation
      console.log(`[${corrId}] Duplicate webhook event ignored: ${eventId}`);
      await logOpsEvent(supabaseClient, null, corrId, 'info', 'WEBHOOK_DUPLICATE', 'Duplicate webhook event ignored', { eventId });
      return new Response('OK', { status: 200 });
    }

    if (insertError) {
      console.error(`[${corrId}] Failed to log webhook event:`, insertError);
      throw new Error('Failed to process webhook');
    }

    // Handle payment.captured event
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;
      const amountPaid = payment.amount / 100; // Convert from paise to rupees
      
      console.log(`[${corrId}] Payment captured: Order ${orderId}, Amount: ₹${amountPaid}`);

      // Extract user_id from order notes (set during order creation)
      const userId = payment.notes?.user_id;
      if (!userId) {
        console.error(`[${corrId}] No user_id found in payment notes`);
        await logOpsEvent(supabaseClient, null, corrId, 'error', 'WEBHOOK_MISSING_USER', 'Payment missing user_id in notes', { orderId, paymentId: payment.id });
        return new Response('Missing user data', { status: 400 });
      }

      console.log(`[${corrId}] Crediting wallet for user: ${userId}`);
      
      // Credit user's wallet
      const { data: walletData, error: walletError } = await supabaseClient
        .from('wallets')
        .select('balance_inr, balance_display, currency')
        .eq('user_id', userId)
        .single();

      if (walletError) {
        console.error(`[${corrId}] Wallet fetch error:`, walletError);
        await logOpsEvent(supabaseClient, userId, corrId, 'error', 'WALLET_FETCH_ERROR', 'Failed to fetch wallet for credit', { error: walletError });
        throw new Error('Failed to fetch wallet');
      }

      if (!walletData) {
        console.log(`[${corrId}] Creating wallet for user: ${userId}`);
        const { error: createError } = await supabaseClient
          .from('wallets')
          .insert({
            user_id: userId,
            balance_inr: amountPaid,
            balance_display: amountPaid,
            currency: 'INR'
          });

        if (createError) {
          console.error(`[${corrId}] Wallet creation error:`, createError);
          await logOpsEvent(supabaseClient, userId, corrId, 'error', 'WALLET_CREATE_ERROR', 'Failed to create wallet during credit', { error: createError });
          throw new Error('Failed to create wallet');
        }
      } else {
        // Update existing wallet
        const newBalance = walletData.balance_inr + amountPaid;
        
        const { error: updateError } = await supabaseClient
          .from('wallets')
          .update({
            balance_inr: newBalance,
            balance_display: newBalance
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error(`[${corrId}] Wallet update error:`, updateError);
          await logOpsEvent(supabaseClient, userId, corrId, 'error', 'WALLET_UPDATE_ERROR', 'Failed to credit wallet', { error: updateError });
          throw new Error('Failed to update wallet');
        }

        console.log(`[${corrId}] Wallet credited successfully. New balance: ₹${newBalance}`);
      }

      // Log recharge transaction
      const { error: transactionError } = await supabaseClient
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'recharge',
          amount_inr: amountPaid,
          amount_display: amountPaid,
          currency: 'INR'
        });

      if (transactionError) {
        console.error(`[${corrId}] Transaction log error:`, transactionError);
        // Don't fail the webhook for transaction logging errors
      }

      await logOpsEvent(supabaseClient, userId, corrId, 'info', 'PAYMENT_CREDITED', `[${razorpayMode}] Successfully credited payment to wallet`, 
        { orderId, paymentId: payment.id, amount: amountPaid, mode: razorpayMode });
      
      console.log(`[${corrId}] Payment processing completed successfully`);
    } else {
      console.log(`[${corrId}] Unhandled webhook event: ${event.event}`);
      await logOpsEvent(supabaseClient, null, corrId, 'info', 'WEBHOOK_UNHANDLED', 'Unhandled webhook event', { event: event.event });
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error(`[${corrId}] Webhook processing error:`, error);
    
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      await logOpsEvent(supabaseClient, null, corrId, 'error', 'WEBHOOK_ERROR', 'Webhook processing failed', { error: error.message });
    } catch (logError) {
      console.error(`[${corrId}] Failed to log webhook error:`, logError);
    }
    
    return new Response(JSON.stringify({ 
      error: 'INTERNAL',
      message: 'Webhook processing failed',
      corrId 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});