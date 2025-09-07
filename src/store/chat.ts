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
  costEstimateData: any | null;
  
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
  costEstimateData: null,

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
        console.log('📊 Starting cost estimation and analysis...');
        const [costEstimateResult, analyzeResult] = await Promise.all([
          backendAdapter.postCostEstimate(query, history),
          backendAdapter.postAnalyze(query, history)
        ]);

        console.log('✅ Backend response received:', { 
          costEstimate: {
            totalCostINR: costEstimateResult.totalCostINR,
            totalCostUSD: costEstimateResult.totalCostUSD,
            costsLength: costEstimateResult.costs?.length,
            tokens: costEstimateResult.tokens,
            fx: costEstimateResult.fx
          }, 
          analyze: analyzeResult 
        });
        
        set({
          cost: { 
            display: costEstimateResult.totalCostINR, 
            inr: costEstimateResult.totalCostINR 
          },
          tags: analyzeResult.tags,
          phase: 'ready',
          costEstimateData: costEstimateResult
        });
      } catch (backendError) {
        console.warn('⚠️ Backend cost-estimate call failed, falling back to mocks:', backendError);
        console.error('📄 Full backend error details:', {
          type: (backendError as any)?.type,
          message: (backendError as any)?.message,
          originalError: (backendError as any)?.originalError
        });
        
        // Fallback to mock services
        const tokens = mockServices.estimateTokens(query);
        const costINR = mockServices.estimateCostINR(tokens);
        const tags = mockServices.inferTags(query);
        
        console.log('🔄 Using mock fallback:', { tokens, costINR, tags });
        
        set({
          cost: { display: costINR, inr: costINR },
          tags,
          phase: 'ready',
          costEstimateData: null // Clear old data when using fallback
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

    console.log('Starting stream with:', { 
      modelId, 
      messageLength: userMessage.length, 
      costINR: cost.inr 
    });

    set({ phase: 'executing', error: null });

    try {
      console.log('Confirming chat with backend...');
      
      const backendAdapter = await import('../adapters/backend');
      const confirmResult = await backendAdapter.postChatConfirm({
        message: userMessage,
        model: modelId,
        estCostINR: cost.inr
      });

      console.log('Chat confirm response:', confirmResult);

      if (!confirmResult.ok) {
        // Handle provider failure - wallet already rolled back
        console.error('Chat confirm failed:', confirmResult.error);
        
        let errorMessage = 'Chat confirmation failed';
        
        // Better error parsing for BAD_INPUT and other provider errors
        if (confirmResult.error === 'BAD_INPUT' || confirmResult.message?.includes('BAD_INPUT')) {
          console.error('BAD_INPUT error for model:', modelId, confirmResult);
          errorMessage = `Model "${modelId}" is not supported or misconfigured. Please try another model.`;
        } else {
          switch (confirmResult.error) {
            case 'INSUFFICIENT_FUNDS':
              errorMessage = 'Insufficient funds in your wallet. Please recharge to continue.';
              break;
            case 'NO_API_KEY':
              errorMessage = 'Provider key not configured. Please contact support.';
              break;
            case 'RATE_LIMITED':
              errorMessage = 'Too many requests. Please wait a moment and try again.';
              break;
            case 'SERVICE_UNAVAILABLE':
              errorMessage = 'AI service is temporarily unavailable. Please try again later.';
              break;
            case 'UNAUTHORIZED':
              errorMessage = 'Authentication failed. Please refresh and try again.';
              break;
            default:
              errorMessage = confirmResult.message || 'Chat confirmation failed. Please try again.';
          }
        }
        
        set({ 
          error: errorMessage,
          phase: 'ready'
        });
        return;
      }

      // Update wallet balance
      if (confirmResult.newBalanceINR !== undefined) {
        set({ wallet: { inr: confirmResult.newBalanceINR } });
      }

      console.log('Chat confirmed successfully, starting stream simulation...');
      
      // Add user message to current state
      set({ 
        messages: [...get().messages, { role: 'user', text: userMessage }],
        query: '' // Clear the input
      });

      // Add user message to conversations store if it exists
      try {
        const { appendLocalUserMessage } = useConversationsStore.getState();
        const { activeChatId } = useConversationsStore.getState();
        if (activeChatId) {
          await appendLocalUserMessage(activeChatId, userMessage);
        }
      } catch (error) {
        console.warn('Failed to add message to conversations store:', error);
      }

      // Simulate progressive streaming of the assistant response
      const assistantText = confirmResult.assistantText || 'Sorry, I could not generate a response.';
      
      // Add empty assistant message first
      set({ 
        messages: [...get().messages, { role: 'assistant', text: '' }]
      });

      // Add assistant message to conversations store
      try {
        const { activeChatId } = useConversationsStore.getState();
        if (activeChatId) {
          // The assistant message will be built progressively through streaming
        }
      } catch (error) {
        console.warn('Failed to prepare assistant message in conversations store:', error);
      }

      // Stream the response progressively (simulate typewriter effect)
      let currentText = '';
      const words = assistantText.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        currentText += (i === 0 ? '' : ' ') + words[i];
        
        // Update local state
        const { updateLastMessage } = get();
        updateLastMessage(' ' + words[i]);
        
        // Update conversations store if available
        try {
          const { appendLocalAssistantDelta, activeChatId } = useConversationsStore.getState();
          if (activeChatId) {
            appendLocalAssistantDelta(activeChatId, ' ' + words[i]);
          }
        } catch (error) {
          console.warn('Failed to update message in conversations store:', error);
        }
        
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log('Chat execution completed successfully');
      
      // Finalize assistant message in conversations store
      try {
        const { finalizeAssistantMessage, activeChatId } = useConversationsStore.getState();
        if (activeChatId) {
          await finalizeAssistantMessage(activeChatId, confirmResult.tokensIn, confirmResult.tokensOut);
        }
      } catch (error) {
        console.warn('Failed to finalize message in conversations store:', error);
      }
      
      set({ 
        phase: 'ready',
        error: null
      });

    } catch (error) {
      console.error('Chat execution failed:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Network error',
        phase: 'ready'
      });
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
    streamController: null,
    costEstimateData: null
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