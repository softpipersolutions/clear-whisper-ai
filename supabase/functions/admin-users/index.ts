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
    console.log('Admin users function called');
    
    if (req.method !== 'GET') {
      throw new Error('Method not allowed');
    }

    // Create Supabase client with service role for full access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Fetching users with wallet balances...');

    // Fetch profiles with wallet data
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select(`
        id,
        name,
        email,
        country,
        preferred_currency,
        created_at,
        wallets (
          balance_inr,
          balance_display,
          currency,
          updated_at
        )
      `)
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw new Error('Failed to fetch user profiles');
    }

    // Transform data to include wallet info at the top level
    const users = profiles?.map(profile => ({
      id: profile.id,
      name: profile.name || 'Unknown',
      email: profile.email || 'No email',
      country: profile.country || 'Unknown',
      preferred_currency: profile.preferred_currency || 'INR',
      created_at: profile.created_at,
      wallet_balance_inr: profile.wallets?.[0]?.balance_inr || 0,
      wallet_balance_display: profile.wallets?.[0]?.balance_display || 0,
      wallet_currency: profile.wallets?.[0]?.currency || 'INR',
      wallet_updated_at: profile.wallets?.[0]?.updated_at || null
    })) || [];

    console.log(`Returning ${users.length} users`);

    const response = {
      users,
      totalCount: users.length
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in admin-users function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});