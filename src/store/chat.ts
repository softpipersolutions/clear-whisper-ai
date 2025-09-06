import { create } from 'zustand';

export interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export interface ChatState {
  // Core state
  query: string;
  phase: 'idle' | 'estimating' | 'ready' | 'executing';
  selectedModel: string | null;
  cost: { display: number; inr: number } | null;
  tags: string[];
  messages: Message[];
  error: string | null;
  wallet: { inr: number };
  
  // Stream control
  streamController: AbortController | null;
  
  // Actions
  setQuery: (query: string) => void;
  submitQuery: () => void;
  setEstimate: (cost: { display: number; inr: number }, tags: string[]) => void;
  selectModel: (modelId: string) => void;
  startStream: (userMessage: string, modelId: string) => void;
  stopStream: () => void;
  setError: (error: string | null) => void;
  reset: () => void;
  addMessage: (message: Message) => void;
  updateLastMessage: (text: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  query: '',
  phase: 'idle',
  selectedModel: null,
  cost: null,
  tags: [],
  messages: [],
  error: null,
  wallet: { inr: 0.00 },
  streamController: null,

  // Actions
  setQuery: (query) => set({ query }),

  submitQuery: async () => {
    const { query } = get();
    if (!query.trim()) return;

    set({ phase: 'estimating', error: null });

    try {
      // Import services dynamically to avoid circular dependencies
      const { estimateTokens, estimateCostINR, inferTags } = await import('../services/estimators');
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 400));
      
      const tokens = estimateTokens(query);
      const costINR = estimateCostINR(tokens);
      const tags = inferTags(query);
      
      set({
        cost: { display: costINR, inr: costINR },
        tags,
        phase: 'ready'
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Estimation failed',
        phase: 'idle'
      });
    }
  },

  setEstimate: (cost, tags) => set({ cost, tags, phase: 'ready' }),

  selectModel: (modelId) => set({ selectedModel: modelId }),

  startStream: async (userMessage, modelId) => {
    const controller = new AbortController();
    set({ 
      streamController: controller,
      phase: 'executing',
      messages: [...get().messages, { role: 'user', text: userMessage }],
      query: '' // Clear the input
    });

    try {
      const { startStream } = await import('../services/stream');
      
      // Add empty assistant message that will be updated
      set({ 
        messages: [...get().messages, { role: 'assistant', text: '' }]
      });

      await startStream(
        userMessage,
        (delta: string) => {
          const { updateLastMessage } = get();
          updateLastMessage(delta);
        },
        () => {
          set({ phase: 'idle', streamController: null });
        },
        controller.signal
      );
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        set({ 
          error: error.message,
          phase: 'idle',
          streamController: null
        });
      }
    }
  },

  stopStream: () => {
    const { streamController } = get();
    if (streamController) {
      streamController.abort();
      set({ 
        phase: 'idle',
        streamController: null
      });
    }
  },

  setError: (error) => set({ error }),

  reset: () => set({
    query: '',
    phase: 'idle',
    selectedModel: null,
    cost: null,
    tags: [],
    messages: [],
    error: null,
    streamController: null
  }),

  addMessage: (message) => set({ 
    messages: [...get().messages, message] 
  }),

  updateLastMessage: (text) => {
    const { messages } = get();
    if (messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'assistant') {
      const updatedMessages = [...messages];
      updatedMessages[updatedMessages.length - 1] = {
        ...lastMessage,
        text: lastMessage.text + text
      };
      set({ messages: updatedMessages });
    }
  }
}));