import { create } from 'zustand';
import { fetchModels, type ModelsResponse, type ModelInfo } from '@/adapters/models';

interface ModelsState {
  models: ModelInfo[];
  pricing: ModelsResponse['pricing'];
  fx: ModelsResponse['fx'];
  loading: boolean;
  error: string | null;
  lastFetch: number;
  
  // Actions
  fetchModels: () => Promise<void>;
  getModelById: (id: string) => ModelInfo | undefined;
  clearError: () => void;
  forceRefresh: () => Promise<void>;
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  models: [],
  pricing: { currency: 'USD', rates: {} },
  fx: undefined,
  loading: false,
  error: null,
  lastFetch: 0,

  fetchModels: async () => {
    const now = Date.now();
    const { lastFetch } = get();
    
    // Cache for 2 minutes (shorter cache for provider key changes)
    if (now - lastFetch < 2 * 60 * 1000) {
      return;
    }

    set({ loading: true, error: null });
    
    try {
      const response = await fetchModels();
      
      set({
        models: response.models,
        pricing: response.pricing,
        fx: response.fx,
        loading: false,
        lastFetch: now
      });
    } catch (error) {
      console.error('Failed to fetch models:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch models',
        loading: false
      });
    }
  },

  getModelById: (id: string) => {
    const { models } = get();
    return models.find(model => model.id === id);
  },

  clearError: () => set({ error: null }),

  // Force refresh models (useful when provider keys change)
  forceRefresh: async () => {
    set({ lastFetch: 0 });
    return get().fetchModels();
  }
}));