import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MessageListResponse {
  items: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    tokensIn: number;
    tokensOut: number;
    createdAt: string;
    idx: number;
  }>;
  nextCursor?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Message list function called');

    if (req.method !== 'GET') {
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

    // Parse query parameters
    const url = new URL(req.url);
    const chatId = url.searchParams.get('chatId');
    const cursor = url.searchParams.get('cursor');
    const limitParam = url.searchParams.get('limit');
    const limit = Math.min(parseInt(limitParam || '50'), 100); // Max 100 items

    if (!chatId) {
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

    // Build query for messages
    let query = supabaseClient
      .from('messages')
      .select('id, role, content, tokens_in, tokens_out, created_at, idx')
      .eq('chat_id', chatId)
      .order('idx', { ascending: true })
      .limit(limit + 1); // Get one extra to check if there's a next page

    // Add cursor filter if provided (for pagination)
    if (cursor) {
      query = query.gt('idx', parseInt(cursor));
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      console.error('Message list error:', messagesError);
      return new Response(JSON.stringify({ error: 'BACKEND' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if there are more items
    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? items[items.length - 1].idx : undefined;

    const response: MessageListResponse = {
      items: items.map(message => ({
        id: message.id,
        role: message.role as 'user' | 'assistant' | 'system',
        content: message.content,
        tokensIn: message.tokens_in,
        tokensOut: message.tokens_out,
        createdAt: message.created_at,
        idx: message.idx
      })),
      nextCursor
    };

    console.log(`Message list returned ${items.length} items for chat: ${chatId}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in message-list function:', error);
    return new Response(JSON.stringify({ error: 'BACKEND' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});