import { create } from 'zustand';
import { getFxRate, getFxRates, type FxRate } from '@/adapters/fx';

export interface FxState {
  rates: Record<string, FxRate>;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchFxRate: (currency: string) => Promise<void>;
  fetchFxRates: (currencies: string[]) => Promise<void>;
  convertFromINR: (amountINR: number, toCurrency: string) => number;
  convertToINR: (amount: number, fromCurrency: string) => number;
  isStale: (currency: string) => boolean;
}

export const useFxStore = create<FxState>((set, get) => ({
  rates: {},
  isLoading: false,
  error: null,

  fetchFxRate: async (currency: string) => {
    if (currency === 'INR') {
      // INR to INR is always 1:1, no need to fetch
      set(state => ({
        rates: {
          ...state.rates,
          INR: {
            rate: 1.0,
            stale: false,
            fetchedAt: new Date().toISOString()
          }
        }
      }));
      return;
    }

    set({ isLoading: true, error: null });
    
    try {
      const rate = await getFxRate(currency);
      set(state => ({
        rates: { ...state.rates, [currency]: rate },
        isLoading: false
      }));
    } catch (error) {
      console.error(`Failed to fetch FX rate for ${currency}:`, error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch exchange rate',
        isLoading: false 
      });
    }
  },

  fetchFxRates: async (currencies: string[]) => {
    if (currencies.length === 0) return;
    
    set({ isLoading: true, error: null });
    
    try {
      const rates = await getFxRates(currencies);
      set(state => ({
        rates: { ...state.rates, ...rates },
        isLoading: false
      }));
    } catch (error) {
      console.error('Failed to fetch FX rates:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch exchange rates',
        isLoading: false 
      });
    }
  },

  convertFromINR: (amountINR: number, toCurrency: string) => {
    if (toCurrency === 'INR') return amountINR;
    
    const { rates } = get();
    const rate = rates[toCurrency];
    
    if (!rate) {
      console.warn(`No exchange rate available for ${toCurrency}`);
      return amountINR; // Fallback to INR amount
    }
    
    return amountINR * rate.rate;
  },

  convertToINR: (amount: number, fromCurrency: string) => {
    if (fromCurrency === 'INR') return amount;
    
    const { rates } = get();
    const rate = rates[fromCurrency];
    
    if (!rate) {
      console.warn(`No exchange rate available for ${fromCurrency}`);
      return amount; // Fallback to original amount
    }
    
    return amount / rate.rate;
  },

  isStale: (currency: string) => {
    const { rates } = get();
    const rate = rates[currency];
    return rate?.stale || false;
  }
}));