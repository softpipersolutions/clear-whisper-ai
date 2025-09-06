// Shared hardening utilities for production edge functions

export function generateCorrId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function createStructuredError(code: string, message: string, corrId: string, status = 500) {
  return {
    status,
    body: JSON.stringify({ error: code, message, corrId }),
  };
}

export async function checkRateLimit(
  supabase: any,
  userId: string,
  action: string,
  limit: number,
  corrId: string
): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  try {
    const windowStart = new Date();
    windowStart.setSeconds(0, 0); // Floor to minute

    // Upsert rate limit counter
    const { data, error } = await supabase
      .from('rate_limits')
      .upsert(
        {
          user_id: userId,
          action: action,
          window_start: windowStart.toISOString(),
          count: 1,
        },
        {
          onConflict: 'user_id,action,window_start',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) {
      console.error(`[${corrId}] Rate limit check failed:`, error);
      return { allowed: true }; // Fail open
    }

    // Check if over limit
    if (data.count > limit) {
      console.warn(`[${corrId}] Rate limit exceeded for ${userId}:${action}: ${data.count}/${limit}`);
      return { allowed: false, retryAfterSec: 15 };
    }

    // Increment counter for existing window
    if (data.count > 1) {
      await supabase
        .from('rate_limits')
        .update({ count: data.count + 1 })
        .eq('user_id', userId)
        .eq('action', action)
        .eq('window_start', windowStart.toISOString());
    }

    return { allowed: true };
  } catch (error) {
    console.error(`[${corrId}] Rate limit error:`, error);
    return { allowed: true }; // Fail open
  }
}

export async function logOpsEvent(
  supabase: any,
  userId: string | null,
  corrId: string,
  level: 'debug' | 'info' | 'warn' | 'error',
  code: string,
  msg: string,
  meta: Record<string, any> = {}
) {
  try {
    await supabase.from('ops_logs').insert({
      user_id: userId,
      corr_id: corrId,
      level,
      code,
      msg,
      meta,
    });
    
    const logLine = `[${corrId}] ${level.toUpperCase()}: ${code} - ${msg}`;
    console.log(logLine, meta);
  } catch (error) {
    console.error(`Failed to log ops event: ${error}`);
  }
}

export async function checkIdempotency(
  supabase: any,
  key: string,
  userId: string,
  corrId: string
): Promise<{ isNew: boolean }> {
  try {
    const { error } = await supabase
      .from('idempotency_keys')
      .insert({
        key,
        user_id: userId,
      });

    if (error && error.code === '23505') { // Unique constraint violation
      console.info(`[${corrId}] Idempotent replay detected for key: ${key}`);
      return { isNew: false };
    }

    if (error) {
      console.error(`[${corrId}] Idempotency check failed:`, error);
      return { isNew: true }; // Fail open
    }

    return { isNew: true };
  } catch (error) {
    console.error(`[${corrId}] Idempotency error:`, error);
    return { isNew: true }; // Fail open
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
  corrId: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } catch (error) {
    console.error(`[${corrId}] ${operation} failed:`, error);
    throw error;
  }
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private isOpen = false;
  private readonly failureThreshold = 5;
  private readonly resetTimeoutMs = 30000; // 30 seconds
  private readonly failureWindowMs = 60000; // 1 minute

  async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
    corrId: string
  ): Promise<T> {
    const now = Date.now();

    // Reset if enough time has passed
    if (this.isOpen && now - this.lastFailureTime > this.resetTimeoutMs) {
      this.isOpen = false;
      this.failures = 0;
      console.info(`[${corrId}] Circuit breaker reset for ${operationName}`);
    }

    // If circuit is open, fail fast
    if (this.isOpen) {
      throw new Error(`SERVICE_UNAVAILABLE: ${operationName} circuit breaker is open`);
    }

    try {
      const result = await operation();
      
      // Reset on success
      if (this.failures > 0) {
        this.failures = 0;
        console.info(`[${corrId}] ${operationName} recovered, resetting circuit breaker`);
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = now;

      // Clean old failures outside window
      if (now - this.lastFailureTime > this.failureWindowMs) {
        this.failures = 1;
      }

      // Open circuit if threshold reached
      if (this.failures >= this.failureThreshold) {
        this.isOpen = true;
        console.error(`[${corrId}] Circuit breaker opened for ${operationName} after ${this.failures} failures`);
      }

      throw error;
    }
  }
}

// Global circuit breakers (per function instance)
export const circuitBreakers = {
  fx: new CircuitBreaker(),
  razorpay: new CircuitBreaker(),
};

export function hashIdempotencyKey(userId: string, message: string, model: string): string {
  const minute = Math.floor(Date.now() / 60000); // Minute bucket
  const input = `${userId}:${message}:${model}:${minute}`;
  
  // Simple hash function (in production, use crypto.subtle.digest)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `CHATCONFIRM::${userId}::${Math.abs(hash).toString(36)}`;
}