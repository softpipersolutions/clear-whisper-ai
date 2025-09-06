import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminStats {
  totalUsers: number;
  totalWalletINR: number;
  totalRechargesINR: number;
  totalDeductionsINR: number;
  totalRawCostINR: number;
  totalDeductedCostINR: number;
  profitINR: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Admin stats function called');
    
    if (req.method !== 'GET') {
      throw new Error('Method not allowed');
    }

    // Create Supabase client with service role for full access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Fetching admin statistics...');

    // Get total users count
    const { count: totalUsers, error: usersError } = await supabaseClient
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (usersError) {
      console.error('Error fetching users count:', usersError);
      throw new Error('Failed to fetch users count');
    }

    // Get total wallet balance
    const { data: walletData, error: walletError } = await supabaseClient
      .from('wallets')
      .select('balance_inr');

    if (walletError) {
      console.error('Error fetching wallet data:', walletError);
      throw new Error('Failed to fetch wallet data');
    }

    const totalWalletINR = walletData?.reduce((sum, wallet) => sum + (wallet.balance_inr || 0), 0) || 0;

    // Get transaction statistics
    const { data: transactionData, error: transactionError } = await supabaseClient
      .from('transactions')
      .select('type, amount_inr, raw_cost_inr, deducted_cost_inr');

    if (transactionError) {
      console.error('Error fetching transaction data:', transactionError);
      throw new Error('Failed to fetch transaction data');
    }

    // Calculate statistics
    let totalRechargesINR = 0;
    let totalDeductionsINR = 0;
    let totalRawCostINR = 0;
    let totalDeductedCostINR = 0;

    transactionData?.forEach(transaction => {
      if (transaction.type === 'recharge') {
        totalRechargesINR += transaction.amount_inr || 0;
      } else if (transaction.type === 'deduction') {
        totalDeductionsINR += transaction.amount_inr || 0;
        totalRawCostINR += transaction.raw_cost_inr || 0;
        totalDeductedCostINR += transaction.deducted_cost_inr || 0;
      }
    });

    const profitINR = totalDeductedCostINR - totalRawCostINR;

    const stats: AdminStats = {
      totalUsers: totalUsers || 0,
      totalWalletINR: Math.round(totalWalletINR * 100) / 100,
      totalRechargesINR: Math.round(totalRechargesINR * 100) / 100,
      totalDeductionsINR: Math.round(totalDeductionsINR * 100) / 100,
      totalRawCostINR: Math.round(totalRawCostINR * 100) / 100,
      totalDeductedCostINR: Math.round(totalDeductedCostINR * 100) / 100,
      profitINR: Math.round(profitINR * 100) / 100
    };

    console.log('Admin stats calculated:', stats);

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in admin-stats function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});