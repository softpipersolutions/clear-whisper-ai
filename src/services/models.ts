export interface ModelInfo {
  id: string;
  name: string;
  badges: string[];
  latencyMs: number;
  context: number;
}

export const CATALOG: ModelInfo[] = [
  {
    id: 'gpt-5-2025-08-07',
    name: 'GPT-5',
    badges: ['Flagship', 'Reasoning'],
    latencyMs: 1000,
    context: 200000
  },
  {
    id: 'gpt-5-mini-2025-08-07',
    name: 'GPT-5 Mini',
    badges: ['Fast', 'Budget'],
    latencyMs: 800,
    context: 128000
  },
  {
    id: 'gpt-5-nano-2025-08-07',
    name: 'GPT-5 Nano',
    badges: ['Ultra Fast', 'Ultra Budget'],
    latencyMs: 600,
    context: 128000
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    badges: ['Fast', 'Multimodal'],
    latencyMs: 1200,
    context: 128000
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    badges: ['Fast', 'Budget'],
    latencyMs: 800,
    context: 128000
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    badges: ['Reasoning', 'Coding'],
    latencyMs: 1800,
    context: 200000
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    badges: ['Fast', 'Budget'],
    latencyMs: 1000,
    context: 200000
  },
  {
    id: 'models/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badges: ['Google', 'Multimodal'],
    latencyMs: 1500,
    context: 1000000
  }
];

export function filterByTags(tags: string[]): ModelInfo[] {
  if (tags.length === 0) return CATALOG;
  
  // Simple filtering logic - return all models for now
  // In a real app, this would filter based on model capabilities
  return CATALOG;
}

export function getModelById(id: string): ModelInfo | undefined {
  return CATALOG.find(model => model.id === id);
}