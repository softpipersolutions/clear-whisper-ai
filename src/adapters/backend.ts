import { supabase } from "@/integrations/supabase/client";

// Error types for normalized error handling
export type BackendErrorType = 'NETWORK' | 'TIMEOUT' | 'BACKEND_BAD_SHAPE' | 'INSUFFICIENT_FUNDS';

export interface BackendError {
  type: BackendErrorType;
  message: string;
  originalError?: any;
}

// Response types
export interface EstimateResponse {
  inputTokens: number;
  outputTokensEst: number;
  estCostINR: number;
  estCostDisplay: number;
  displayCurrency: string;
}

export interface AnalyzeResponse {
  tags: string[];
  recommended: Array<{
    model: string;
    why: string;
    fitScore: number;
  }>;
}

export interface ChatConfirmResponse {
  ok: boolean;
  newBalanceINR?: number;
  error?: string;
}

export interface WalletResponse {
  balance_inr: number;
  balance_display: number;
  currency: string;
  updated_at: string;
}

export interface CreateOrderRequest {
  amountInDisplay: number;
  currency: string;
}

export interface CreateOrderResponse {
  order_id: string;
  amount_inr: number;
  currency: string;
  display_amount: number;
  display_currency: string;
}

export interface AdminStats {
  totalUsers: number;
  totalWalletINR: number;
  totalRechargesINR: number;
  totalDeductionsINR: number;
  totalRawCostINR: number;
  totalDeductedCostINR: number;
  profitINR: number;
}

export interface AdminTransaction {
  id: string;
  user_id: string;
  type: string;
  amount_inr: number;
  currency: string;
  raw_cost_inr: number | null;
  deducted_cost_inr: number | null;
  created_at: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  country: string;
  preferred_currency: string;
  created_at: string;
  wallet_balance_inr: number;
  wallet_balance_display: number;
  wallet_currency: string;
  wallet_updated_at: string | null;
}

export interface FxResponse {
  rate: number;
  lastUpdated: string;
  stale?: boolean;
  from: string;
  to: string;
}

export interface PricingResponse {
  pricing: Array<{
    model: string;
    inputPer1k: number;
    outputPer1k: number;
    currency: string;
    lastUpdated: string;
    provider: string;
  }>;
  defaultModel: string;
  timestamp: string;
}

// Helper function to create timeout promise
const createTimeoutPromise = (ms: number) => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), ms);
  });
};

// Helper function to normalize errors
const normalizeError = (error: any): BackendError => {
  console.error('Backend error:', error);
  
  if (error.message === 'Request timeout') {
    return {
      type: 'TIMEOUT',
      message: 'Request timed out. Please try again.',
      originalError: error
    };
  }
  
  if (error.message?.includes('INSUFFICIENT_FUNDS')) {
    return {
      type: 'INSUFFICIENT_FUNDS',
      message: 'Insufficient funds in your wallet.',
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
    type: 'BACKEND_BAD_SHAPE',
    message: 'Unexpected response from server.',
    originalError: error
  };
};

// Helper function to make Supabase function calls with timeout
const callFunction = async <T>(
  functionName: string, 
  body?: any, 
  timeoutMs: number = 1500
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

// Adapter functions
export const fetchPricing = async (): Promise<PricingResponse> => {
  return callFunction<PricingResponse>('pricing');
};

export const postEstimate = async (
  message: string, 
  history: Array<{ role: string; content: string }> = []
): Promise<EstimateResponse> => {
  return callFunction<EstimateResponse>('estimate', { message, history });
};

export const postAnalyze = async (
  message: string, 
  history: Array<{ role: string; content: string }> = []
): Promise<AnalyzeResponse> => {
  return callFunction<AnalyzeResponse>('analyze', { message, history });
};

export const postChatConfirm = async (data: {
  message: string;
  model: string;
  estCostINR: number;
}): Promise<ChatConfirmResponse> => {
  return callFunction<ChatConfirmResponse>('chat-confirm', data);
};

export const getFx = async (to: string = 'USD'): Promise<FxResponse> => {
  return callFunction<FxResponse>('fx');
};

export const getWallet = async (): Promise<WalletResponse> => {
  return callFunction<WalletResponse>('get-wallet');
};

export const createOrder = async (data: CreateOrderRequest): Promise<CreateOrderResponse> => {
  return callFunction<CreateOrderResponse>('create-order', data);
};

// Admin functions
export const getAdminStats = async (): Promise<AdminStats> => {
  return callFunction<AdminStats>('admin-stats');
};

export const getAdminTransactions = async (params?: {
  limit?: number;
  offset?: number;
  type?: string;
}): Promise<{
  transactions: AdminTransaction[];
  totalCount: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}> => {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  if (params?.type) queryParams.append('type', params.type);
  
  const url = queryParams.toString() ? `admin-transactions?${queryParams}` : 'admin-transactions';
  return callFunction(url);
};

export const getAdminUsers = async (): Promise<{
  users: AdminUser[];
  totalCount: number;
}> => {
  return callFunction('admin-users');
};