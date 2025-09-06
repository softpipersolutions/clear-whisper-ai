import { supabase } from "@/integrations/supabase/client";

export interface FxRate {
  rate: number;
  stale: boolean;
  fetchedAt: string;
}

export interface FxRatesResponse {
  base: string;
  rates: Record<string, number>;
  fetchedAt: string;
  stale?: boolean;
  error?: string;
}

export async function getFxRate(to: string): Promise<FxRate> {
  // Handle INR to INR conversion
  if (to === 'INR') {
    return {
      rate: 1.0,
      stale: false,
      fetchedAt: new Date().toISOString()
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('fx', {
      body: { to }
    });

    if (error) {
      console.error('FX function error:', error);
      throw new Error('FX_UNAVAILABLE');
    }

    const response = data as FxRatesResponse;
    
    if (response.error) {
      throw new Error(response.error);
    }

    const rate = response.rates[to];
    if (!rate) {
      throw new Error(`Currency ${to} not available`);
    }

    return {
      rate,
      stale: response.stale || false,
      fetchedAt: response.fetchedAt
    };
  } catch (error) {
    console.error('Error fetching FX rate:', error);
    throw error;
  }
}

export async function getFxRates(toCurrencies: string[]): Promise<Record<string, FxRate>> {
  // Filter out INR and handle it separately
  const nonInrCurrencies = toCurrencies.filter(c => c !== 'INR');
  const result: Record<string, FxRate> = {};

  // Handle INR
  if (toCurrencies.includes('INR')) {
    result.INR = {
      rate: 1.0,
      stale: false,
      fetchedAt: new Date().toISOString()
    };
  }

  // Return early if only INR requested
  if (nonInrCurrencies.length === 0) {
    return result;
  }

  try {
    const { data, error } = await supabase.functions.invoke('fx', {
      body: { to: nonInrCurrencies.join(',') }
    });

    if (error) {
      console.error('FX function error:', error);
      throw new Error('FX_UNAVAILABLE');
    }

    const response = data as FxRatesResponse;
    
    if (response.error) {
      throw new Error(response.error);
    }

    // Add rates for requested currencies
    for (const currency of nonInrCurrencies) {
      const rate = response.rates[currency];
      if (rate) {
        result[currency] = {
          rate,
          stale: response.stale || false,
          fetchedAt: response.fetchedAt
        };
      }
    }

    return result;
  } catch (error) {
    console.error('Error fetching FX rates:', error);
    throw error;
  }
}