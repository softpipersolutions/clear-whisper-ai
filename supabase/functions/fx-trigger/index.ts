import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Triggering GPT-5 Nano FX rate update manually...');

    // Call the fx-gpt-updater function
    const { data, error } = await supabase.functions.invoke('fx-gpt-updater', {
      body: { manual_trigger: true }
    });

    if (error) {
      console.error('Error calling fx-gpt-updater:', error);
      throw new Error(`Failed to trigger FX update: ${error.message}`);
    }

    console.log('FX update triggered successfully:', data);

    return new Response(JSON.stringify({
      success: true,
      message: 'FX rates update triggered successfully',
      data: data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fx-trigger function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to trigger FX rates update',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});