import { create } from 'zustand';
import type { AdminStats, AdminTransaction, AdminUser } from '@/adapters/backend';

export interface AdminState {
  // Auth state (mocked for now)
  isAdmin: boolean;
  
  // Data state
  stats: AdminStats | null;
  transactions: AdminTransaction[];
  users: AdminUser[];
  
  // Loading states
  isLoadingStats: boolean;
  isLoadingTransactions: boolean;
  isLoadingUsers: boolean;
  
  // Error states
  statsError: string | null;
  transactionsError: string | null;
  usersError: string | null;
  
  // Pagination
  transactionsPagination: {
    limit: number;
    offset: number;
    totalCount: number;
    hasMore: boolean;
  };
  
  // Filters
  transactionTypeFilter: string | null;
  
  // Actions
  setIsAdmin: (isAdmin: boolean) => void;
  fetchAdminStats: () => Promise<void>;
  fetchAdminTransactions: (reset?: boolean) => Promise<void>;
  fetchAdminUsers: () => Promise<void>;
  setTransactionTypeFilter: (type: string | null) => void;
  clearErrors: () => void;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  // Initial state
  isAdmin: false, // Will be set to true for demo purposes
  
  stats: null,
  transactions: [],
  users: [],
  
  isLoadingStats: false,
  isLoadingTransactions: false,
  isLoadingUsers: false,
  
  statsError: null,
  transactionsError: null,
  usersError: null,
  
  transactionsPagination: {
    limit: 50,
    offset: 0,
    totalCount: 0,
    hasMore: false
  },
  
  transactionTypeFilter: null,
  
  // Actions
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  
  fetchAdminStats: async () => {
    set({ isLoadingStats: true, statsError: null });
    
    try {
      const { getAdminStats } = await import('@/adapters/backend');
      const stats = await getAdminStats();
      set({ stats, isLoadingStats: false });
    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
      set({ 
        statsError: error instanceof Error ? error.message : 'Failed to fetch stats',
        isLoadingStats: false 
      });
    }
  },
  
  fetchAdminTransactions: async (reset = false) => {
    const { transactionsPagination, transactionTypeFilter } = get();
    const offset = reset ? 0 : transactionsPagination.offset;
    
    set({ isLoadingTransactions: true, transactionsError: null });
    
    try {
      const { getAdminTransactions } = await import('@/adapters/backend');
      const response = await getAdminTransactions({
        limit: transactionsPagination.limit,
        offset,
        type: transactionTypeFilter || undefined
      });
      
      set({
        transactions: reset ? response.transactions : [...get().transactions, ...response.transactions],
        transactionsPagination: {
          limit: response.limit,
          offset: response.offset + response.limit,
          totalCount: response.totalCount,
          hasMore: response.hasMore
        },
        isLoadingTransactions: false
      });
    } catch (error) {
      console.error('Failed to fetch admin transactions:', error);
      set({ 
        transactionsError: error instanceof Error ? error.message : 'Failed to fetch transactions',
        isLoadingTransactions: false 
      });
    }
  },
  
  fetchAdminUsers: async () => {
    set({ isLoadingUsers: true, usersError: null });
    
    try {
      const { getAdminUsers } = await import('@/adapters/backend');
      const response = await getAdminUsers();
      set({ users: response.users, isLoadingUsers: false });
    } catch (error) {
      console.error('Failed to fetch admin users:', error);
      set({ 
        usersError: error instanceof Error ? error.message : 'Failed to fetch users',
        isLoadingUsers: false 
      });
    }
  },
  
  setTransactionTypeFilter: (type) => {
    set({ transactionTypeFilter: type });
    // Reset and refetch transactions with new filter
    get().fetchAdminTransactions(true);
  },
  
  clearErrors: () => set({
    statsError: null,
    transactionsError: null,
    usersError: null
  })
}));