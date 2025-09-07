import { callFunction } from "@/adapters/backend";

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
    const data = await callFunction<ModelsResponse>('models');
    
    // Filter out Google/Gemini models temporarily
    const filteredModels = data.models.filter(model => model.provider !== 'google');
    
    return {
      ...data,
      models: filteredModels
    };
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

export type FilterTag = 
  | 'all'
  | 'openai' 
  | 'anthropic' 
  | 'gemini'
  | 'cheapest'
  | 'fastest' 
  | 'most-capable'
  | 'best-for-query';

export function filterAndSortModels(
  models: ModelInfo[], 
  filter: FilterTag,
  queryTags?: string[]
): ModelInfo[] {
  let filteredModels = [...models];

  // Apply provider-based filtering
  switch (filter) {
    case 'openai':
      filteredModels = models.filter(m => m.provider === 'openai');
      break;
    case 'anthropic':
      filteredModels = models.filter(m => m.provider === 'anthropic');
      break;
    case 'gemini':
      filteredModels = models.filter(m => m.provider === 'google');
      break;
    case 'cheapest':
      // Sort by total cost per 1M tokens (input + output) ascending
      filteredModels = models.sort((a, b) => {
        const aCost = a.pricingUSD.inputPer1M + a.pricingUSD.outputPer1M;
        const bCost = b.pricingUSD.inputPer1M + b.pricingUSD.outputPer1M;
        return aCost - bCost;
      });
      break;
    case 'fastest':
      // Prioritize models with "Fast", "Ultra Fast", or "Quick" tags
      // Then sort by model family (nano > mini > standard)
      filteredModels = models.sort((a, b) => {
        const aHasFastTag = a.tags.some(tag => 
          ['Fast', 'Ultra Fast', 'Quick', 'Nano', 'Mini'].some(fastTag => 
            tag.toLowerCase().includes(fastTag.toLowerCase())
          )
        );
        const bHasFastTag = b.tags.some(tag => 
          ['Fast', 'Ultra Fast', 'Quick', 'Nano', 'Mini'].some(fastTag => 
            tag.toLowerCase().includes(fastTag.toLowerCase())
          )
        );
        
        if (aHasFastTag && !bHasFastTag) return -1;
        if (!aHasFastTag && bHasFastTag) return 1;
        
        // Secondary sort by family (prioritize nano/mini)
        const aIsNanoMini = a.family.toLowerCase().includes('nano') || a.family.toLowerCase().includes('mini');
        const bIsNanoMini = b.family.toLowerCase().includes('nano') || b.family.toLowerCase().includes('mini');
        
        if (aIsNanoMini && !bIsNanoMini) return -1;
        if (!aIsNanoMini && bIsNanoMini) return 1;
        
        return 0;
      });
      break;
    case 'most-capable':
      // Sort by pricing descending (higher price typically = more capable)
      filteredModels = models.sort((a, b) => {
        const aCost = a.pricingUSD.inputPer1M + a.pricingUSD.outputPer1M;
        const bCost = b.pricingUSD.inputPer1M + b.pricingUSD.outputPer1M;
        return bCost - aCost;
      });
      break;
    case 'best-for-query':
      if (queryTags && queryTags.length > 0) {
        // Score models based on tag matching and capability
        filteredModels = models.sort((a, b) => {
          const aScore = calculateQueryMatchScore(a, queryTags);
          const bScore = calculateQueryMatchScore(b, queryTags);
          return bScore - aScore;
        });
        
        // Return top performing models
        filteredModels = filteredModels.slice(0, Math.min(6, filteredModels.length));
      }
      break;
    case 'all':
    default:
      // No filtering, return all models
      break;
  }

  return filteredModels;
}

function calculateQueryMatchScore(model: ModelInfo, queryTags: string[]): number {
  let score = 0;
  
  // Tag matching score
  const matchingTags = model.tags.filter(tag => 
    queryTags.some(queryTag => 
      tag.toLowerCase().includes(queryTag.toLowerCase()) ||
      queryTag.toLowerCase().includes(tag.toLowerCase())
    )
  );
  score += matchingTags.length * 10;
  
  // Capability bonus based on pricing (higher price = more capable)
  const totalCost = model.pricingUSD.inputPer1M + model.pricingUSD.outputPer1M;
  score += Math.log(totalCost + 1) * 2;
  
  // Provider diversity bonus
  if (model.provider === 'anthropic') score += 5; // Slight anthropic preference for reasoning
  if (model.provider === 'openai') score += 3;
  
  // Special tag bonuses
  if (queryTags.includes('code') || queryTags.includes('coding')) {
    if (model.tags.some(tag => tag.toLowerCase().includes('code'))) score += 15;
  }
  
  if (queryTags.includes('reasoning')) {
    if (model.tags.some(tag => tag.toLowerCase().includes('reasoning'))) score += 15;
  }
  
  if (queryTags.includes('quick')) {
    if (model.tags.some(tag => ['Fast', 'Quick', 'Nano', 'Mini'].some(fast => 
      tag.toLowerCase().includes(fast.toLowerCase())
    ))) score += 10;
  }
  
  return score;
}

export function getModelById(models: ModelInfo[], id: string): ModelInfo | undefined {
  return models.find(model => model.id === id);
}