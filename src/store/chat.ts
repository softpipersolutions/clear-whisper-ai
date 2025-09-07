import { create } from 'zustand';
import { useConversationsStore } from "./conversations";
import { useAuthStore } from "./auth";
// import { backendApi } from "@/adapters/backend";
import { startRealTimeStream } from "@/services/streamingService";

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
  walletBalance: number;
  isStreaming: boolean;
  
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
  walletBalance: 0,
  isStreaming: false,
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
      
      // Normalize error message for better UX
      const errorMessage = error && typeof error === 'object' && 'type' in error 
        ? (error as any).message || 'Estimation failed'
        : error instanceof Error 
        ? error.message 
        : 'Estimation failed';
      
      set({ 
        error: errorMessage,
        phase: 'idle'
      });
    }
  },

  setEstimate: (cost, tags) => set({ cost, tags, phase: 'ready' }),

  selectModel: (modelId) => {
    console.log('Selecting model:', modelId);
    set({ selectedModel: modelId, error: null });
  },

  startStream: async (userMessage, modelId) => {
    const { cost } = get();
    
    // Validate inputs
    if (!userMessage?.trim()) {
      set({ error: 'Please enter a message' });
      return;
    }
    
    if (!modelId) {
      set({ error: 'Please select a model' });
      return;
    }
    
    if (!cost) {
      set({ error: 'No cost estimate available' });
      return;
    }

    console.log('Starting real-time stream with:', { 
      modelId, 
      messageLength: userMessage.length, 
      costINR: cost.inr 
    });

    // Create abort controller for stream cancellation
    const controller = new AbortController();
    set({ 
      phase: 'executing', 
      error: null, 
      isStreaming: true,
      streamController: controller 
    });

    try {
      // Add user message to current state
      set({ 
        messages: [...get().messages, { role: 'user', text: userMessage }],
        query: '' // Clear the input
      });

      // Add user message to conversations store if it exists
      try {
        const { appendLocalUserMessage, activeChatId } = useConversationsStore.getState();
        if (activeChatId) {
          await appendLocalUserMessage(activeChatId, userMessage);
        }
      } catch (error) {
        console.warn('Failed to add message to conversations store:', error);
      }

      // Add empty assistant message first
      set({ 
        messages: [...get().messages, { role: 'assistant', text: '' }]
      });

      // Start real-time streaming
      await startRealTimeStream(
        modelId,
        userMessage,
        {
          onDelta: (delta: string) => {
            const { updateLastMessage } = get();
            updateLastMessage(delta);
            
            // Update conversations store
            try {
              const { appendLocalAssistantDelta, activeChatId } = useConversationsStore.getState();
              if (activeChatId) {
                appendLocalAssistantDelta(activeChatId, delta);
              }
            } catch (error) {
              console.warn('Failed to update message in conversations store:', error);
            }
          },
          onCost: (tokensIn: number, tokensOut: number, cost: number) => {
            console.log('Real-time cost update:', { tokensIn, tokensOut, cost });
          },
          onDone: async (data: any) => {
            console.log('Streaming completed:', data);
            
            // Finalize assistant message in conversations store
            try {
              const { finalizeAssistantMessage, activeChatId } = useConversationsStore.getState();
              if (activeChatId && data.tokensIn && data.tokensOut) {
                await finalizeAssistantMessage(activeChatId, data.tokensIn, data.tokensOut);
              }
            } catch (error) {
              console.warn('Failed to finalize message in conversations store:', error);
            }
            
            set({ 
              phase: 'ready',
              error: null,
              isStreaming: false,
              streamController: null
            });
          },
          onError: (error: string) => {
            console.error('Streaming error:', error);
            set({ 
              error,
              phase: 'ready',
              isStreaming: false,
              streamController: null
            });
          }
        },
        controller.signal
      );

    } catch (error) {
      console.error('Chat execution failed:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Network error',
        phase: 'ready',
        isStreaming: false,
        streamController: null
      });
    }
  },

  stopStream: () => {
    const { streamController } = get();
    if (streamController) {
      streamController.abort();
      set({ 
        phase: 'ready',
        isStreaming: false,
        streamController: null
      });
      console.log('🛑 Stream stopped by user');
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
    isStreaming: false,
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
        walletBalance: walletData.balance_inr,
        isLoadingWallet: false 
      });
    } catch (error) {
      console.warn('Failed to load wallet data:', error);
      set({ isLoadingWallet: false });
      // Keep existing wallet data on error
    }
  }
}));
