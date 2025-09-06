export interface ModelInfo {
  id: string;
  name: string;
  badges: string[];
  latencyMs: number;
  context: number;
}

export const CATALOG: ModelInfo[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    badges: ['Fast', 'Multimodal'],
    latencyMs: 1200,
    context: 128000
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    badges: ['Reasoning', 'Coding'],
    latencyMs: 1800,
    context: 200000
  },
  {
    id: 'llama-3.1-405b',
    name: 'Llama 3.1 405B',
    badges: ['Open Source', 'Large'],
    latencyMs: 2500,
    context: 128000
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    badges: ['Google', 'Multimodal'],
    latencyMs: 1500,
    context: 1000000
  },
  {
    id: 'mistral-large',
    name: 'Mistral Large',
    badges: ['European', 'Fast'],
    latencyMs: 1000,
    context: 32000
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