import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Error types for normalized error handling
export type ConversationErrorType = 'NETWORK' | 'TIMEOUT' | 'BACKEND' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_INPUT';

export interface ConversationError {
  type: ConversationErrorType;
  message: string;
  originalError?: any;
}

// Request/Response types
export interface CreateChatRequest {
  title?: string;
}

export interface CreateChatResponse {
  chatId: string;
  title: string;
  createdAt: string;
}

export interface ChatListResponse {
  items: Array<{
    id: string;
    title: string;
    updatedAt: string;
  }>;
  nextCursor?: string;
}

export interface AppendMessageRequest {
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokensIn?: number;
  tokensOut?: number;
  modelId?: string;
}

export interface AppendMessageResponse {
  id: string;
  createdAt: string;
}

export interface MessageListResponse {
  items: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    tokensIn: number;
    tokensOut: number;
    createdAt: string;
    idx: number;
    model_id?: string;
  }>;
  nextCursor?: number;
}

// Helper function to create timeout promise
const createTimeoutPromise = (ms: number) => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), ms);
  });
};

// Helper function to normalize errors
const normalizeError = (error: any): ConversationError => {
  console.error('Conversation error:', error);
  
  if (error.message === 'Request timeout') {
    return {
      type: 'TIMEOUT',
      message: 'Request timed out. Please try again.',
      originalError: error
    };
  }
  
  if (error.message?.includes('UNAUTHORIZED')) {
    return {
      type: 'UNAUTHORIZED',
      message: 'Please sign in to continue.',
      originalError: error
    };
  }

  if (error.message?.includes('FORBIDDEN')) {
    return {
      type: 'FORBIDDEN',
      message: 'You do not have permission to access this resource.',
      originalError: error
    };
  }

  if (error.message?.includes('NOT_FOUND')) {
    return {
      type: 'NOT_FOUND',
      message: 'The requested resource was not found.',
      originalError: error
    };
  }

  if (error.message?.includes('BAD_INPUT')) {
    return {
      type: 'BAD_INPUT',
      message: 'Invalid input provided.',
      originalError: error
    };
  }
  
  if (error.message?.includes('fetch') || error.message?.includes('network')) {
    return {
      type: 'NETWORK',
      message: 'Network error. Please check your connection.',
      originalError: error
    };
  }
  
  return {
    type: 'BACKEND',
    message: 'Unexpected error. Please try again.',
    originalError: error
  };
};

// Helper function to make Supabase function calls with timeout
const callFunction = async <T>(
  functionName: string, 
  body?: any, 
  timeoutMs: number = 10000,
  signal?: AbortSignal
): Promise<T> => {
  try {
    const functionCall = supabase.functions.invoke(functionName, body ? { body } : undefined);
    const timeoutPromise = createTimeoutPromise(timeoutMs);
    
    const result = await Promise.race([functionCall, timeoutPromise]);
    const { data, error } = result as any;
    
    if (error) {
      throw new Error(error.message || 'Function call failed');
    }
    
    return data;
  } catch (error) {
    throw normalizeError(error);
  }
};

// API functions
export const createChat = async (
  request: CreateChatRequest = {},
  signal?: AbortSignal
): Promise<CreateChatResponse> => {
  return callFunction<CreateChatResponse>('chat-create', request, 10000, signal);
};

export const listChats = async (params: {
  cursor?: string;
  limit?: number;
} = {}, signal?: AbortSignal): Promise<ChatListResponse> => {
  const queryParams = new URLSearchParams();
  if (params.cursor) queryParams.append('cursor', params.cursor);
  if (params.limit) queryParams.append('limit', params.limit.toString());
  
  // Make direct GET request since chat-list expects GET, not POST
  const url = queryParams.toString() ? `chat-list?${queryParams}` : 'chat-list';
  
  try {
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) {
      throw new Error('UNAUTHORIZED: Not signed in');
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/${url}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${auth.session.access_token}`,
        'Content-Type': 'application/json',
      },
      signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Chat list error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    throw normalizeError(error);
  }
};

export const appendMessage = async (
  request: AppendMessageRequest,
  signal?: AbortSignal
): Promise<AppendMessageResponse> => {
  return callFunction<AppendMessageResponse>('message-append', {
    chatId: request.chatId,
    role: request.role,
    content: request.content,
    tokensIn: request.tokensIn,
    tokensOut: request.tokensOut,
    modelId: request.modelId
  }, 10000, signal);
};

export const listMessages = async (params: {
  chatId: string;
  cursor?: number;
  limit?: number;
}, signal?: AbortSignal): Promise<MessageListResponse> => {
  const queryParams = new URLSearchParams();
  queryParams.append('chatId', params.chatId);
  if (params.cursor) queryParams.append('cursor', params.cursor.toString());
  if (params.limit) queryParams.append('limit', params.limit.toString());
  
  const url = `message-list?${queryParams}`;
  
  // Use direct GET request since message-list expects GET, not POST
  try {
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) {
      throw new Error('UNAUTHORIZED: Not signed in');
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/${url}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${auth.session.access_token}`,
        'Content-Type': 'application/json',
      },
      signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Message list error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    throw normalizeError(error);
  }
};

export const archiveChat = async (
  chatId: string,
  signal?: AbortSignal
): Promise<{ success: boolean }> => {
  return callFunction<{ success: boolean }>('chat-archive', { chatId }, 10000, signal);
};

export const renameChat = async (
  chatId: string,
  title: string,
  signal?: AbortSignal
): Promise<{ success: boolean; title: string }> => {
  return callFunction<{ success: boolean; title: string }>('chat-rename', { chatId, title }, 10000, signal);
};
