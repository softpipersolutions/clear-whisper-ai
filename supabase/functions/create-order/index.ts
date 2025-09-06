import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { generateCorrId, logOpsEvent } from "../_shared/hardening.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateOrderRequest {
  amountInDisplay: number;
  currency: string;
}

interface CreateOrderResponse {
  order_id: string;
  amount_inr: number;
  currency: string;
  display_amount: number;
  display_currency: string;
}

serve(async (req) => {
  const corrId = generateCorrId();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[${corrId}] Create order function called`);
    
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Create Supabase client with anon key for auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { amountInDisplay, currency }: CreateOrderRequest = await req.json();
    
    if (!amountInDisplay || amountInDisplay <= 0) {
      throw new Error('Invalid amount');
    }
    
    if (!currency) {
      throw new Error('Currency is required');
    }

    console.log(`Creating order for user: ${user.id}, amount: ${amountInDisplay} ${currency}`);

    // Convert amount to INR if needed
    let amountINR = amountInDisplay;
    if (currency !== 'INR') {
      // Get latest FX rate (for now, use mock rate)
      // In production, this would fetch from fx_rates table
      const conversionRate = currency === 'USD' ? 83.0 : 1.0; // 1 USD = 83 INR (mock)
      amountINR = amountInDisplay * conversionRate;
    }

    console.log(`Converted amount: ${amountINR} INR`);

    // Get Razorpay mode and credentials
    const razorpayMode = Deno.env.get('RAZORPAY_MODE') || 'TEST';
    const liveOk = Deno.env.get('LIVE_OK');
    const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL');
    
    // Validate LIVE mode requirements
    if (razorpayMode === 'LIVE') {
      if (!liveOk || liveOk !== 'true') {
        throw new Error('LIVE mode not authorized - LIVE_OK flag required');
      }
      if (!appUrl || appUrl.includes('lovable.app')) {
        throw new Error('LIVE mode requires verified custom domain');
      }
    }
    
    console.log(`[${razorpayMode}] Creating order for user: ${user.id}, amount: ${amountInDisplay} ${currency}`);
    
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    
    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    // Create Razorpay order with receipt under 40 characters
    const shortUserId = user.id.substring(0, 8); // First 8 chars of UUID
    const shortTimestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
    const receipt = `rch_${shortUserId}_${shortTimestamp}`;
    
    // Validate receipt length (Razorpay limit is 40 characters)
    if (receipt.length > 40) {
      console.error(`Receipt too long: ${receipt.length} chars - ${receipt}`);
      throw new Error('Receipt generation failed - length exceeded');
    }
    
    const razorpayOrderData = {
      amount: Math.round(amountINR * 100), // Convert to paise
      currency: 'INR',
      receipt: receipt,
      notes: {
        user_id: user.id,
        display_amount: amountInDisplay.toString(),
        display_currency: currency
      }
    };

    console.log('Creating Razorpay order:', razorpayOrderData);

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(razorpayOrderData)
    });

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      console.error('Razorpay API error:', errorText);
      throw new Error('Failed to create Razorpay order');
    }

    const razorpayOrder = await razorpayResponse.json();
    
    const response: CreateOrderResponse = {
      order_id: razorpayOrder.id,
      amount_inr: amountINR,
      currency: 'INR',
      display_amount: amountInDisplay,
      display_currency: currency
    };

    // Log successful order creation
    await logOpsEvent(supabaseClient, user.id, corrId, 'info', 'ORDER_CREATED', `[${razorpayMode}] Order created successfully`, {
      orderId: razorpayOrder.id,
      amount: amountINR,
      mode: razorpayMode
    });

    console.log(`[${corrId}] Order created successfully:`, response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`[${corrId}] Error in create-order function:`, error);
    
    // Log error
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      await logOpsEvent(supabaseClient, null, corrId, 'error', 'ORDER_CREATE_ERROR', 'Failed to create order', { error: error.message });
    } catch (logError) {
      console.error(`[${corrId}] Failed to log error:`, logError);
    }
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      corrId 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});