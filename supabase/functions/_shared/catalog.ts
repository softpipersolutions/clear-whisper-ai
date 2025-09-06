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
  // OPENAI (API) - Using correct API model names
  {
    id: 'gpt-5-2025-08-07',
    provider: 'openai',
    label: 'GPT-5',
    model: 'gpt-5-2025-08-07',
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
    id: 'gpt-5-mini-2025-08-07',
    provider: 'openai',
    label: 'GPT-5 Mini',
    model: 'gpt-5-mini-2025-08-07',
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
    id: 'gpt-5-nano-2025-08-07',
    provider: 'openai',
    label: 'GPT-5 Nano',
    model: 'gpt-5-nano-2025-08-07',
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
    id: 'gpt-4.1-2025-01-29',
    provider: 'openai',
    label: 'GPT-4.1',
    model: 'gpt-4.1-2025-01-29',
    family: 'gpt-4',
    tags: ['Advanced', 'Reliable', 'Latest'],
    pricingUSD: {
      inputPer1M: 3.00,
      outputPer1M: 12.00,
      cachedInputPer1M: 1.50,
      unit: 'tokens'
    }
  },
  {
    id: 'gpt-4.1-mini-2025-01-29',
    provider: 'openai',
    label: 'GPT-4.1 Mini',
    model: 'gpt-4.1-mini-2025-01-29',
    family: 'gpt-4',
    tags: ['Fast', 'Budget', 'Efficient'],
    pricingUSD: {
      inputPer1M: 0.20,
      outputPer1M: 0.80,
      cachedInputPer1M: 0.10,
      unit: 'tokens'
    }
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    label: 'GPT-4o',
    model: 'gpt-4o',
    family: 'gpt-4',
    tags: ['Multimodal', 'Vision', 'Legacy'],
    pricingUSD: {
      inputPer1M: 2.50,
      outputPer1M: 10.00,
      cachedInputPer1M: 1.25,
      unit: 'tokens'
    }
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    label: 'GPT-4o Mini',
    model: 'gpt-4o-mini',
    family: 'gpt-4',
    tags: ['Fast', 'Budget', 'Vision'],
    pricingUSD: {
      inputPer1M: 0.15,
      outputPer1M: 0.60,
      cachedInputPer1M: 0.075,
      unit: 'tokens'
    }
  },
  {
    id: 'o1-2024-12-17',
    provider: 'openai',
    label: 'o1',
    model: 'o1-2024-12-17',
    family: 'o1',
    tags: ['Reasoning', 'Complex', 'Analysis'],
    pricingUSD: {
      inputPer1M: 15.00,
      outputPer1M: 60.00,
      unit: 'tokens'
    }
  },
  {
    id: 'o1-mini-2024-09-12',
    provider: 'openai',
    label: 'o1 Mini',
    model: 'o1-mini-2024-09-12',
    family: 'o1',
    tags: ['Reasoning', 'Fast', 'Budget'],
    pricingUSD: {
      inputPer1M: 3.00,
      outputPer1M: 12.00,
      unit: 'tokens'
    }
  },

  // ANTHROPIC (Claude API) - Using correct API model names
  {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    label: 'Claude 3.5 Sonnet',
    model: 'claude-3-5-sonnet-20241022',
    family: 'claude-3',
    tags: ['Reasoning', 'Coding', 'Analysis'],
    pricingUSD: {
      inputPer1M: 3.00,
      outputPer1M: 15.00,
      cachedInputPer1M: 0.30,
      unit: 'tokens'
    }
  },
  {
    id: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    label: 'Claude 3.5 Haiku',
    model: 'claude-3-5-haiku-20241022',
    family: 'claude-3',
    tags: ['Fast', 'Budget', 'Quick'],
    pricingUSD: {
      inputPer1M: 0.80,
      outputPer1M: 4.00,
      cachedInputPer1M: 0.08,
      unit: 'tokens'
    }
  },
  {
    id: 'claude-3-opus-20240229',
    provider: 'anthropic',
    label: 'Claude 3 Opus',
    model: 'claude-3-opus-20240229',
    family: 'claude-3',
    tags: ['Advanced', 'Complex', 'Premium'],
    pricingUSD: {
      inputPer1M: 15.00,
      outputPer1M: 75.00,
      unit: 'tokens'
    }
  },

  // GOOGLE GEMINI (Gemini API)
  {
    id: 'gemini-2.5-pro',
    provider: 'google',
    label: 'Gemini 2.5 Pro',
    model: 'models/gemini-2.5-pro',
    family: 'gemini-2',
    tags: ['Advanced', 'Thinking', 'Multimodal'],
    pricingUSD: {
      inputPer1M: 1.25,
      outputPer1M: 5.00,
      unit: 'tokens'
    }
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'google',
    label: 'Gemini 2.5 Flash',
    model: 'models/gemini-2.5-flash',
    family: 'gemini-2',
    tags: ['Fast', 'Thinking', 'Multimodal'],
    pricingUSD: {
      inputPer1M: 0.35,
      outputPer1M: 1.05,
      unit: 'tokens'
    }
  },
  {
    id: 'gemini-2.0-flash',
    provider: 'google',
    label: 'Gemini 2.0 Flash',
    model: 'models/gemini-2.0-flash',
    family: 'gemini-2',
    tags: ['Fast', 'Multimodal', 'Latest'],
    pricingUSD: {
      inputPer1M: 0.30,
      outputPer1M: 1.20,
      unit: 'tokens'
    }
  },
  {
    id: 'gemini-1.5-pro',
    provider: 'google',
    label: 'Gemini 1.5 Pro',
    model: 'models/gemini-1.5-pro',
    family: 'gemini-1',
    tags: ['Advanced', 'Long Context', 'Legacy'],
    pricingUSD: {
      inputPer1M: 1.25,
      outputPer1M: 5.00,
      unit: 'tokens'
    }
  },
  {
    id: 'gemini-1.5-flash',
    provider: 'google',
    label: 'Gemini 1.5 Flash',
    model: 'models/gemini-1.5-flash',
    family: 'gemini-1',
    tags: ['Fast', 'Budget', 'Legacy'],
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