import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { methodGuard } from "../_shared/http.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const guard = methodGuard(req, ['GET', 'POST']);
  if (guard) return guard;

  const corrId = crypto.randomUUID().slice(0, 8);

  try {
    console.log(`[${corrId}] Get wallet function called (${req.method})`);

    // Create Supabase client with service role key for RLS bypass
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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

    console.log(`Fetching wallet for user: ${user.id}`);

    // Fetch wallet data
    const { data: walletData, error: walletError } = await supabaseClient
      .from('wallets')
      .select('balance_inr, balance_display, currency, updated_at')
      .eq('user_id', user.id)
      .single();

    if (walletError && walletError.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Wallet fetch error:', walletError);
      throw new Error('Failed to fetch wallet data');
    }

    if (!walletData) {
      // Return default wallet if none exists
      const response = {
        balance_inr: 0,
        balance_display: 0,
        currency: 'INR',
        updated_at: new Date().toISOString()
      };

      console.log('No wallet found, returning default');
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Wallet found: ₹${walletData.balance_inr}`);

    return new Response(JSON.stringify(walletData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`[${corrId}] Error in get-wallet function:`, error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      corrId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});