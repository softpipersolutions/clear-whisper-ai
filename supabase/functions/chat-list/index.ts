import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatListResponse {
  items: Array<{
    id: string;
    title: string;
    updatedAt: string;
  }>;
  nextCursor?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Chat list function called');

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
    const cursor = url.searchParams.get('cursor');
    const limitParam = url.searchParams.get('limit');
    const limit = Math.min(parseInt(limitParam || '20'), 100); // Max 100 items

    // Build query
    let query = supabaseClient
      .from('chats')
      .select('id, title, updated_at')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .limit(limit + 1); // Get one extra to check if there's a next page

    // Add cursor filter if provided
    if (cursor) {
      const { data: cursorChat } = await supabaseClient
        .from('chats')
        .select('updated_at')
        .eq('id', cursor)
        .eq('user_id', user.id)
        .single();

      if (cursorChat) {
        query = query.lt('updated_at', cursorChat.updated_at);
      }
    }

    const { data: chats, error: chatsError } = await query;

    if (chatsError) {
      console.error('Chat list error:', chatsError);
      return new Response(JSON.stringify({ error: 'BACKEND' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if there are more items
    const hasMore = chats.length > limit;
    const items = hasMore ? chats.slice(0, limit) : chats;
    const nextCursor = hasMore ? items[items.length - 1].id : undefined;

    const response: ChatListResponse = {
      items: items.map(chat => ({
        id: chat.id,
        title: chat.title,
        updatedAt: chat.updated_at
      })),
      nextCursor
    };

    console.log(`Chat list returned ${items.length} items for user: ${user.id}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in chat-list function:', error);
    return new Response(JSON.stringify({ error: 'BACKEND' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});