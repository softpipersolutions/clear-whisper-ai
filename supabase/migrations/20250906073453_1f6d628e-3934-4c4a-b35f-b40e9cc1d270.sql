-- Production hardening tables

-- Idempotency keys (prevent double-charges)
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key TEXT PRIMARY KEY,              -- e.g., "CHATCONFIRM::<userId>::<hash(message+model+tsBucket)>"
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Webhook deduplication
CREATE TABLE IF NOT EXISTS public.webhook_events (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (provider, event_id)
);

-- Rate limiting (token bucket per action per user)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id UUID NOT NULL,
  action TEXT NOT NULL,              -- 'chat_confirm', 'estimate', 'fx', etc.
  window_start TIMESTAMPTZ NOT NULL, -- floored to 1 minute
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, action, window_start)
);

-- Ops logs (structured logging for quick querying)
CREATE TABLE IF NOT EXISTS public.ops_logs (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ DEFAULT now(),
  user_id UUID,
  corr_id TEXT,                      -- correlation id spanning request → function calls
  level TEXT CHECK(level IN ('debug','info','warn','error')) DEFAULT 'info',
  code TEXT,                         -- app error code or action tag
  msg TEXT,
  meta JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user_id ON public.idempotency_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON public.rate_limits(user_id, action, window_start);
CREATE INDEX IF NOT EXISTS idx_ops_logs_corr_id ON public.ops_logs(corr_id);
CREATE INDEX IF NOT EXISTS idx_ops_logs_user_ts ON public.ops_logs(user_id, ts DESC);

-- TTL cleanup for rate limits (remove old windows)
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON public.rate_limits(window_start);

-- RLS policies (read-only for now, functions use service role)
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own data
CREATE POLICY "Users can view own idempotency keys" ON public.idempotency_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own rate limits" ON public.rate_limits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own ops logs" ON public.ops_logs FOR SELECT USING (auth.uid() = user_id);