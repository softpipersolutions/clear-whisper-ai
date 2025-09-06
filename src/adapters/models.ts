import { supabase } from "@/integrations/supabase/client";

export interface ModelInfo {
  id: string;
  provider: string;
  label: string;
  model: string;
  family: string;
  tags: string[];
  locked: boolean;
  pricingUSD: {
    inputPer1M: number;
    outputPer1M: number;
    cachedInputPer1M?: number;
    unit?: 'tokens' | 'audioTokens';
  };
}

export interface ModelPricingResponse {
  inputPer1M: number;
  outputPer1M: number;
  cachedInputPer1M?: number;
  unit?: 'tokens' | 'audioTokens';
}

export interface ModelsResponse {
  models: ModelInfo[];
  pricing: {
    currency: 'USD' | 'INR';
    rates: Record<string, ModelPricingResponse>;
  };
  fx?: {
    usdToInr: number;
    fetchedAt: string;
    stale: boolean;
  };
}

export async function fetchModels(): Promise<ModelsResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('models');

    if (error) {
      console.error('Models function error:', error);
      throw new Error('Failed to fetch models');
    }

    return data as ModelsResponse;
  } catch (error) {
    console.error('Error fetching models:', error);
    throw error;
  }
}

export function filterByTags(models: ModelInfo[], tags: string[]): ModelInfo[] {
  if (tags.length === 0) return models;
  
  // Simple filtering logic - return all models for now
  // In a real app, this would filter based on model capabilities
  return models;
}

export function getModelById(models: ModelInfo[], id: string): ModelInfo | undefined {
  return models.find(model => model.id === id);
}