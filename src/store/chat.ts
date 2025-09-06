import { create } from 'zustand';
import { useConversationsStore } from './conversations';

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
  isLoadingWallet: boolean;
  
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
  retryLastOperation: () => void;
  loadWallet: () => void;
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
  isLoadingWallet: false,
  streamController: null,

  // Actions
  setQuery: (query) => set({ query }),

  submitQuery: async () => {
    const { query } = get();
    if (!query.trim()) return;

    set({ phase: 'estimating', error: null });

    try {
      // Import backend adapter and mock services
      const [backendAdapter, mockServices] = await Promise.all([
        import('../adapters/backend'),
        import('../services/estimators')
      ]);

      // Try backend calls first, fall back to mocks on error
      try {
        console.log('Calling backend services...');
        
        // Convert messages to history format for backend
        const { messages } = get();
        const history = messages.map(msg => ({
          role: msg.role,
          content: msg.text
        }));

        // Call backend services in parallel with timeout
        const [estimateResult, analyzeResult] = await Promise.all([
          backendAdapter.postEstimate(query, history),
          backendAdapter.postAnalyze(query, history)
        ]);

        console.log('Backend response:', { estimateResult, analyzeResult });
        
        set({
          cost: { 
            display: estimateResult.estCostDisplay, 
            inr: estimateResult.estCostINR 
          },
          tags: analyzeResult.tags,
          phase: 'ready'
        });
      } catch (backendError) {
        console.warn('Backend call failed, falling back to mocks:', backendError);
        
        // Fallback to mock services
        const tokens = mockServices.estimateTokens(query);
        const costINR = mockServices.estimateCostINR(tokens);
        const tags = mockServices.inferTags(query);
        
        set({
          cost: { display: costINR, inr: costINR },
          tags,
          phase: 'ready'
        });
      }
    } catch (error) {
      console.error('All estimation methods failed:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Estimation failed',
        phase: 'idle'
      });
    }
  },

  setEstimate: (cost, tags) => set({ cost, tags, phase: 'ready' }),

  selectModel: (modelId) => set({ selectedModel: modelId }),

  startStream: async (userMessage, modelId) => {
    const { cost } = get();
    if (!cost) {
      set({ error: 'No cost estimate available' });
      return;
    }

    // First, confirm the chat with backend
    try {
      const backendAdapter = await import('../adapters/backend');
      const confirmResult = await backendAdapter.postChatConfirm({
        message: userMessage,
        model: modelId,
        estCostINR: cost.inr
      });

      if (!confirmResult.ok) {
        if (confirmResult.error === 'INSUFFICIENT_FUNDS') {
          set({ error: 'INSUFFICIENT_FUNDS' });
          return;
        }
        throw new Error(confirmResult.error || 'Chat confirmation failed');
      }

      // Update wallet balance if provided
      if (confirmResult.newBalanceINR !== undefined) {
        set({ wallet: { inr: confirmResult.newBalanceINR } });
      }
    } catch (backendError) {
      console.warn('Backend confirmation failed:', backendError);
      // Set error for insufficient funds or other backend issues
      if (backendError.type === 'INSUFFICIENT_FUNDS') {
        set({ error: 'INSUFFICIENT_FUNDS' });
        return;
      }
      set({ error: 'Backend confirmation failed. Please try again.' });
      return;
    }

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
  },

  retryLastOperation: () => {
    const { submitQuery } = get();
    submitQuery();
  },

  loadWallet: async () => {
    set({ isLoadingWallet: true });
    try {
      const backendAdapter = await import('../adapters/backend');
      const walletData = await backendAdapter.getWallet();
      set({ 
        wallet: { inr: walletData.balance_inr },
        isLoadingWallet: false 
      });
    } catch (error) {
      console.warn('Failed to load wallet data:', error);
      set({ isLoadingWallet: false });
      // Keep existing wallet data on error
    }
  }
}));