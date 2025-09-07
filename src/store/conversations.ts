import { create } from 'zustand';
import * as conversationsApi from '@/adapters/conversations';

export interface ChatItem {
  id: string;
  title: string;
  updatedAt: string;
}

export interface MessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokensIn: number;
  tokensOut: number;
  createdAt: string;
  idx: number;
  model_id?: string;
}

export interface MessagesState {
  items: MessageItem[];
  nextCursor?: number;
  loading: boolean;
  error: string | null;
}

export interface ConversationsState {
  // Core state
  activeChatId: string | null;
  chatList: ChatItem[];
  messagesByChat: Record<string, MessagesState>;
  isLoadingChats: boolean;
  error: string | null;
  
  // Streaming state
  streamingMessage: string;
  isStreaming: boolean;
  
  // Actions
  createNewChat: (title?: string) => Promise<string>;
  loadChatList: () => Promise<void>;
  openChat: (chatId: string) => Promise<void>;
  loadMoreMessages: (chatId: string) => Promise<void>;
  appendLocalUserMessage: (chatId: string, content: string) => Promise<void>;
  appendLocalAssistantDelta: (chatId: string, delta: string) => void;
  finalizeAssistantMessage: (chatId: string, tokensIn?: number, tokensOut?: number) => Promise<void>;
  renameChat: (chatId: string, title: string) => Promise<void>;
  archiveChat: (chatId: string) => Promise<void>;
  setActiveChat: (chatId: string | null) => void;
  clearStreamingMessage: () => void;
  setError: (error: string | null) => void;
}

export const useConversationsStore = create<ConversationsState>((set, get) => ({
  // Initial state
  activeChatId: null,
  chatList: [],
  messagesByChat: {},
  isLoadingChats: false,
  error: null,
  streamingMessage: '',
  isStreaming: false,

  createNewChat: async (title) => {
    try {
      set({ error: null });
      
      const response = await conversationsApi.createChat({ title });
      
      // Add to chat list at the top
      const newChat: ChatItem = {
        id: response.chatId,
        title: response.title,
        updatedAt: response.createdAt
      };
      
      set(state => ({
        chatList: [newChat, ...state.chatList],
        activeChatId: response.chatId,
        messagesByChat: {
          ...state.messagesByChat,
          [response.chatId]: {
            items: [],
            loading: false,
            error: null
          }
        }
      }));

      return response.chatId;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to create chat';
      set({ error: errorMessage });
      throw error;
    }
  },

  loadChatList: async () => {
    try {
      set({ isLoadingChats: true, error: null });
      
      const response = await conversationsApi.listChats({ limit: 20 });
      
      set({
        chatList: response.items,
        isLoadingChats: false
      });
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load chats';
      set({ 
        error: errorMessage,
        isLoadingChats: false 
      });
    }
  },

  openChat: async (chatId: string) => {
    try {
      set({ 
        activeChatId: chatId,
        error: null 
      });

      const state = get();
      const existingMessages = state.messagesByChat[chatId];
      
      // If messages not cached, load them
      if (!existingMessages) {
        set(state => ({
          messagesByChat: {
            ...state.messagesByChat,
            [chatId]: {
              items: [],
              loading: true,
              error: null
            }
          }
        }));

        const response = await conversationsApi.listMessages({ chatId, limit: 50 });
        
        set(state => ({
          messagesByChat: {
            ...state.messagesByChat,
            [chatId]: {
              items: response.items,
              nextCursor: response.nextCursor,
              loading: false,
              error: null
            }
          }
        }));
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load chat';
      set(state => ({
        error: errorMessage,
        messagesByChat: {
          ...state.messagesByChat,
          [chatId]: {
            items: [],
            loading: false,
            error: errorMessage
          }
        }
      }));
    }
  },

  loadMoreMessages: async (chatId: string) => {
    try {
      const state = get();
      const chatMessages = state.messagesByChat[chatId];
      
      if (!chatMessages || chatMessages.loading || !chatMessages.nextCursor) {
        return;
      }

      set(state => ({
        messagesByChat: {
          ...state.messagesByChat,
          [chatId]: {
            ...chatMessages,
            loading: true
          }
        }
      }));

      const response = await conversationsApi.listMessages({
        chatId,
        cursor: chatMessages.nextCursor,
        limit: 50
      });

      set(state => ({
        messagesByChat: {
          ...state.messagesByChat,
          [chatId]: {
            items: [...response.items, ...chatMessages.items],
            nextCursor: response.nextCursor,
            loading: false,
            error: null
          }
        }
      }));
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load more messages';
      set(state => {
        const chatMessages = state.messagesByChat[chatId];
        return {
          messagesByChat: {
            ...state.messagesByChat,
            [chatId]: {
              ...chatMessages,
              loading: false,
              error: errorMessage
            }
          }
        };
      });
    }
  },

  appendLocalUserMessage: async (chatId: string, content: string) => {
    try {
      // Append to server first
      const response = await conversationsApi.appendMessage({
        chatId,
        role: 'user',
        content
      });

      // Add to local state
      const newMessage: MessageItem = {
        id: response.id,
        role: 'user',
        content,
        tokensIn: 0,
        tokensOut: 0,
        createdAt: response.createdAt,
        idx: Date.now() // Temporary idx, will be corrected on reload
      };

      set(state => {
        const chatMessages = state.messagesByChat[chatId];
        return {
          messagesByChat: {
            ...state.messagesByChat,
            [chatId]: {
              ...chatMessages,
              items: [...(chatMessages?.items || []), newMessage]
            }
          }
        };
      });

      // Update chat list order
      set(state => ({
        chatList: state.chatList.map(chat => 
          chat.id === chatId 
            ? { ...chat, updatedAt: response.createdAt }
            : chat
        ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      }));
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to send message';
      set({ error: errorMessage });
      throw error;
    }
  },

  appendLocalAssistantDelta: (chatId: string, delta: string) => {
    set(state => ({
      streamingMessage: state.streamingMessage + delta,
      isStreaming: true
    }));
  },

  finalizeAssistantMessage: async (chatId: string, tokensIn = 0, tokensOut = 0) => {
    try {
      const state = get();
      const content = state.streamingMessage;
      
      if (!content) return;

      // Send to server
      const response = await conversationsApi.appendMessage({
        chatId,
        role: 'assistant',
        content,
        tokensIn,
        tokensOut
      });

      // Add to local state
      const newMessage: MessageItem = {
        id: response.id,
        role: 'assistant',
        content,
        tokensIn,
        tokensOut,
        createdAt: response.createdAt,
        idx: Date.now() // Temporary idx
      };

      set(state => {
        const chatMessages = state.messagesByChat[chatId];
        return {
          messagesByChat: {
            ...state.messagesByChat,
            [chatId]: {
              ...chatMessages,
              items: [...(chatMessages?.items || []), newMessage]
            }
          },
          streamingMessage: '',
          isStreaming: false
        };
      });

      // Update chat list order
      set(state => ({
        chatList: state.chatList.map(chat => 
          chat.id === chatId 
            ? { ...chat, updatedAt: response.createdAt }
            : chat
        ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      }));
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to save assistant message';
      set({ 
        error: errorMessage,
        streamingMessage: '',
        isStreaming: false 
      });
    }
  },

  renameChat: async (chatId: string, title: string) => {
    try {
      await conversationsApi.renameChat(chatId, title);
      
      set(state => ({
        chatList: state.chatList.map(chat =>
          chat.id === chatId ? { ...chat, title } : chat
        )
      }));
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to rename chat';
      set({ error: errorMessage });
      throw error;
    }
  },

  archiveChat: async (chatId: string) => {
    try {
      await conversationsApi.archiveChat(chatId);
      
      set(state => ({
        chatList: state.chatList.filter(chat => chat.id !== chatId),
        activeChatId: state.activeChatId === chatId ? null : state.activeChatId,
        messagesByChat: Object.fromEntries(
          Object.entries(state.messagesByChat).filter(([id]) => id !== chatId)
        )
      }));
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to archive chat';
      set({ error: errorMessage });
      throw error;
    }
  },

  setActiveChat: (chatId: string | null) => {
    set({ activeChatId: chatId });
  },

  clearStreamingMessage: () => {
    set({ streamingMessage: '', isStreaming: false });
  },

  setError: (error: string | null) => {
    set({ error });
  }
}));