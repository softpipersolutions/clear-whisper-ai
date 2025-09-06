// Model catalog with real provider data and pricing
// Update here if vendor strings change

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
  cachedInputPer1M?: number;
  unit?: 'tokens' | 'audioTokens';
}

export interface ModelInfo {
  id: string;
  provider: 'openai' | 'anthropic' | 'google';
  label: string;
  model: string; // EXACT provider model string
  family: string;
  tags: string[];
  locked: boolean;
  pricingUSD: ModelPricing;
}

// Provider availability check
export const getProviderAvailability = () => {
  return {
    openai: !!Deno.env.get('OPENAI_API_KEY'),
    anthropic: !!Deno.env.get('ANTHROPIC_API_KEY'),
    google: !!Deno.env.get('GOOGLE_API_KEY')
  };
};

// Base model definitions (without lock status)
const BASE_MODEL_CATALOG: Omit<ModelInfo, 'locked'>[] = [
  // OPENAI (API)
  {
    id: 'gpt-5',
    provider: 'openai',
    label: 'GPT-5',
    model: 'gpt-5',
    family: 'gpt-5',
    tags: ['Flagship', 'Reasoning', 'Multimodal'],
    pricingUSD: {
      inputPer1M: 1.25,
      outputPer1M: 10.00,
      cachedInputPer1M: 0.125,
      unit: 'tokens'
    }
  },
  {
    id: 'gpt-5-mini',
    provider: 'openai',
    label: 'GPT-5 Mini',
    model: 'gpt-5-mini',
    family: 'gpt-5',
    tags: ['Fast', 'Budget', 'Efficient'],
    pricingUSD: {
      inputPer1M: 0.25,
      outputPer1M: 2.00,
      cachedInputPer1M: 0.025,
      unit: 'tokens'
    }
  },
  {
    id: 'gpt-5-nano',
    provider: 'openai',
    label: 'GPT-5 Nano',
    model: 'gpt-5-nano',
    family: 'gpt-5',
    tags: ['Ultra Fast', 'Ultra Budget', 'Minimal'],
    pricingUSD: {
      inputPer1M: 0.05,
      outputPer1M: 0.40,
      cachedInputPer1M: 0.005,
      unit: 'tokens'
    }
  },
  {
    id: 'gpt-realtime',
    provider: 'openai',
    label: 'GPT Realtime',
    model: 'gpt-realtime',
    family: 'gpt-realtime',
    tags: ['Realtime', 'Audio', 'Streaming'],
    pricingUSD: {
      inputPer1M: 32.00,
      outputPer1M: 64.00,
      cachedInputPer1M: 0.40,
      unit: 'audioTokens'
    }
  },

  // ANTHROPIC (Claude API)
  {
    id: 'claude-4.1-opus',
    provider: 'anthropic',
    label: 'Claude 4.1 Opus',
    model: 'claude-4.1-opus',
    family: 'claude-4',
    tags: ['Premium', 'Reasoning', 'Complex'],
    pricingUSD: {
      inputPer1M: 15.00,
      outputPer1M: 75.00,
      cachedInputPer1M: 1.50,
      unit: 'tokens'
    }
  },
  {
    id: 'claude-4-sonnet',
    provider: 'anthropic',
    label: 'Claude 4 Sonnet',
    model: 'claude-4-sonnet',
    family: 'claude-4',
    tags: ['Balanced', 'Coding', 'Analysis'],
    pricingUSD: {
      inputPer1M: 3.00,
      outputPer1M: 15.00,
      cachedInputPer1M: 0.30,
      unit: 'tokens'
    }
  },
  {
    id: 'claude-3.5-haiku',
    provider: 'anthropic',
    label: 'Claude 3.5 Haiku',
    model: 'claude-3.5-haiku',
    family: 'claude-3',
    tags: ['Fast', 'Budget', 'Quick'],
    pricingUSD: {
      inputPer1M: 0.80,
      outputPer1M: 4.00,
      cachedInputPer1M: 0.08,
      unit: 'tokens'
    }
  },

  // GOOGLE GEMINI (Gemini API)
  {
    id: 'gemini-2.5-flash',
    provider: 'google',
    label: 'Gemini 2.5 Flash',
    model: 'models/gemini-2.5-flash',
    family: 'gemini-2',
    tags: ['Google', 'Multimodal', 'Fast'],
    pricingUSD: {
      inputPer1M: 0.35,
      outputPer1M: 1.05,
      unit: 'tokens'
    }
  }
];

// Export function to get models with lock status
export const getModelCatalog = (): ModelInfo[] => {
  const availability = getProviderAvailability();
  
  return BASE_MODEL_CATALOG.map(model => ({
    ...model,
    locked: !availability[model.provider]
  }));
};

// Validation helper
export const isSupportedModel = (modelId: string): boolean => {
  return BASE_MODEL_CATALOG.some(model => model.id === modelId);
};

// Get model by ID
export const getModelById = (modelId: string): ModelInfo | undefined => {
  const catalog = getModelCatalog();
  return catalog.find(model => model.id === modelId);
};