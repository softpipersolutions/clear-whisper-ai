import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AppendMessageRequest {
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokensIn?: number;
  tokensOut?: number;
}

interface AppendMessageResponse {
  id: string;
  createdAt: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Message append function called');

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user auth with anon client
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { 
      chatId, 
      role, 
      content, 
      tokensIn = 0, 
      tokensOut = 0 
    }: AppendMessageRequest = await req.json();

    // Validate input
    if (!chatId || !role || !content) {
      return new Response(JSON.stringify({ error: 'BAD_INPUT' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['user', 'assistant', 'system'].includes(role)) {
      return new Response(JSON.stringify({ error: 'BAD_INPUT' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (typeof content !== 'string' || content.length > 100000) {
      return new Response(JSON.stringify({ error: 'BAD_INPUT' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify chat belongs to user
    const { data: chat, error: chatError } = await supabaseClient
      .from('chats')
      .select('id')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .single();

    if (chatError || !chat) {
      if (chatError?.code === 'PGRST116') {
        return new Response(JSON.stringify({ error: 'NOT_FOUND' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'FORBIDDEN' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert message
    const { data: message, error: messageError } = await supabaseClient
      .from('messages')
      .insert({
        chat_id: chatId,
        user_id: user.id,
        role,
        content,
        tokens_in: tokensIn,
        tokens_out: tokensOut
      })
      .select('id, created_at')
      .single();

    if (messageError) {
      console.error('Message insert error:', messageError);
      return new Response(JSON.stringify({ error: 'BACKEND' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response: AppendMessageResponse = {
      id: message.id,
      createdAt: message.created_at
    };

    console.log(`Message appended: ${message.id} to chat: ${chatId} for user: ${user.id}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in message-append function:', error);
    return new Response(JSON.stringify({ error: 'BACKEND' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});