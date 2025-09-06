import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Create order function called');
    
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

    // Get Razorpay credentials
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    
    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    // Create Razorpay order
    const razorpayOrderData = {
      amount: Math.round(amountINR * 100), // Convert to paise
      currency: 'INR',
      receipt: `recharge_${user.id}_${Date.now()}`,
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

    console.log('Order created successfully:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in create-order function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});