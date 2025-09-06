import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { generateCorrId, logOpsEvent } from "../_shared/hardening.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RazorpayConfigResponse {
  mode: 'TEST' | 'LIVE';
  keyId: string;
  isTestMode: boolean;
}

serve(async (req) => {
  const corrId = generateCorrId();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[${corrId}] Razorpay config request`);

    if (req.method !== 'GET') {
      throw new Error('Method not allowed');
    }

    // Create Supabase client for auth
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

    // Get Razorpay mode and validate LIVE mode requirements
    const razorpayMode = (Deno.env.get('RAZORPAY_MODE') || 'TEST') as 'TEST' | 'LIVE';
    const liveOk = Deno.env.get('LIVE_OK');
    const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL');
    
    // Force TEST mode if LIVE requirements not met
    let actualMode = razorpayMode;
    if (razorpayMode === 'LIVE') {
      if (!liveOk || liveOk !== 'true') {
        console.log(`[${corrId}] Forcing TEST mode - LIVE_OK flag not set`);
        actualMode = 'TEST';
      } else if (!appUrl || appUrl.includes('lovable.app')) {
        console.log(`[${corrId}] Forcing TEST mode - custom domain not verified`);
        actualMode = 'TEST';
      }
    }

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    if (!razorpayKeyId) {
      throw new Error('Razorpay key ID not configured');
    }

    const response: RazorpayConfigResponse = {
      mode: actualMode,
      keyId: razorpayKeyId,
      isTestMode: actualMode === 'TEST'
    };

    // Log configuration request
    await logOpsEvent(supabaseClient, user.id, corrId, 'info', 'RAZORPAY_CONFIG', 'Razorpay configuration requested', {
      mode: actualMode,
      requestedMode: razorpayMode
    });

    console.log(`[${corrId}] Returning Razorpay config: ${actualMode} mode`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`[${corrId}] Error in razorpay-config function:`, error);
    
    // Create Supabase client for error logging
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      await logOpsEvent(supabaseClient, null, corrId, 'error', 'RAZORPAY_CONFIG_ERROR', 'Failed to get Razorpay config', { error: error.message });
    } catch (logError) {
      console.error(`[${corrId}] Failed to log error:`, logError);
    }
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});