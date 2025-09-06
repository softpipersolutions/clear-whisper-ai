-- Ensure fx_rates table exists with correct structure
-- Check if we need to add the index
CREATE INDEX IF NOT EXISTS idx_fx_rates_fetched_at ON public.fx_rates(fetched_at DESC);

-- Add RLS policies for fx_rates table
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read fx rates (public data)
CREATE POLICY "Anyone can view fx rates" ON public.fx_rates FOR SELECT USING (true);

-- Only service role can insert/update fx rates (via edge functions)
-- Note: Edge functions run with service role permissions