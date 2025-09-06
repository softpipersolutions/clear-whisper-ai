import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Admin transactions function called');
    
    if (req.method !== 'GET') {
      throw new Error('Method not allowed');
    }

    // Create Supabase client with service role for full access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse query parameters
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const type = url.searchParams.get('type'); // 'recharge' or 'deduction'

    console.log(`Fetching transactions with limit: ${limit}, offset: ${offset}, type: ${type}`);

    // Build query
    let query = supabaseClient
      .from('transactions')
      .select(`
        id,
        user_id,
        type,
        amount_inr,
        currency,
        raw_cost_inr,
        deducted_cost_inr,
        created_at
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Add type filter if specified
    if (type && (type === 'recharge' || type === 'deduction')) {
      query = query.eq('type', type);
    }

    const { data: transactions, error: transactionError } = await query;

    if (transactionError) {
      console.error('Error fetching transactions:', transactionError);
      throw new Error('Failed to fetch transactions');
    }

    // Get total count for pagination
    let countQuery = supabaseClient
      .from('transactions')
      .select('*', { count: 'exact', head: true });
    
    if (type && (type === 'recharge' || type === 'deduction')) {
      countQuery = countQuery.eq('type', type);
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      console.error('Error fetching transaction count:', countError);
      throw new Error('Failed to fetch transaction count');
    }

    const response = {
      transactions: transactions || [],
      totalCount: totalCount || 0,
      limit,
      offset,
      hasMore: (offset + limit) < (totalCount || 0)
    };

    console.log(`Returning ${transactions?.length || 0} transactions out of ${totalCount} total`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in admin-transactions function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});