import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface StreamEvent {
  type: 'delta' | 'done' | 'error' | 'cost';
  data?: any;
  delta?: string;
  cost?: number;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
}

interface StreamCallbacks {
  onDelta: (delta: string) => void;
  onCost?: (tokensIn: number, tokensOut: number, cost: number) => void;
  onDone: (data: any) => void;
  onError: (error: string) => void;
}

export async function startRealTimeStream(
  model: string,
  message: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  console.log('🚀 Starting real-time stream for model:', model);

  try {
    // Get current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Not authenticated');
    }

    console.log('📡 Making streaming request to chat-stream endpoint');

    // Call the streaming edge function
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/chat-stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          model,
          message,
          estCostINR: 0.1, // Will be calculated properly by the backend
          temperature: 0.8,
          max_tokens: 2048
        }),
        signal,
      }
    );

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ HTTP error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      console.error('❌ No response body from streaming endpoint');
      throw new Error('No response body');
    }

    console.log('📖 Starting to read stream data');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('✅ Stream completed');
          break;
        }

        if (signal?.aborted) {
          console.log('🛑 Stream aborted by user');
          reader.releaseLock();
          throw new Error('Stream aborted');
        }

        const chunk = decoder.decode(value);
        console.log('📦 Received chunk:', chunk.substring(0, 100) + '...');
        const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));

        for (const line of lines) {
          const eventData = line.replace('data: ', '');
          
          try {
            const event: StreamEvent = JSON.parse(eventData);
            
            switch (event.type) {
              case 'delta':
                if (event.delta) {
                  callbacks.onDelta(event.delta);
                }
                break;
                
              case 'cost':
                if (callbacks.onCost && event.tokensIn && event.tokensOut && event.cost) {
                  callbacks.onCost(event.tokensIn, event.tokensOut, event.cost);
                }
                break;
                
              case 'done':
                callbacks.onDone(event.data || {});
                break;
                
              case 'error':
                callbacks.onError(event.error || 'Unknown streaming error');
                break;
            }
          } catch (parseError) {
            console.warn('Failed to parse SSE event:', parseError);
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

  } catch (error) {
    if (signal?.aborted) {
      console.log('🛑 Stream was cancelled');
      return;
    }
    
    console.error('❌ Streaming error:', error);
    callbacks.onError(error instanceof Error ? error.message : 'Streaming failed');
  }
}
