-- Create wallets table for user balances
CREATE TABLE public.wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_inr NUMERIC(14,2) DEFAULT 0 NOT NULL,
  balance_display NUMERIC(14,2) DEFAULT 0 NOT NULL,
  currency TEXT DEFAULT 'INR' NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create transactions table for logging all wallet operations
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('recharge', 'deduction')),
  amount_inr NUMERIC(14,2) NOT NULL,
  amount_display NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL,
  raw_cost_inr NUMERIC(14,2),
  deducted_cost_inr NUMERIC(14,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create fx_rates table for currency exchange rates
CREATE TABLE public.fx_rates (
  id BIGSERIAL PRIMARY KEY,
  base TEXT DEFAULT 'INR' NOT NULL,
  rates JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL
);

-- Function to update timestamps (if not exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for wallets updated_at
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle wallet creation for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Create wallet entry with zero balance for new users
  INSERT INTO public.wallets (user_id, balance_inr, balance_display, currency)
  VALUES (NEW.id, 100.00, 100.00, 'INR') -- Start with ₹100 for testing
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger to create wallet when user signs up
CREATE TRIGGER on_auth_user_created_wallet
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_wallet();

-- Create indexes for better performance
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_fx_rates_fetched_at ON public.fx_rates(fetched_at);

-- Insert some sample FX rates
INSERT INTO public.fx_rates (base, rates, fetched_at)
VALUES (
  'INR',
  '{"USD": 0.012, "EUR": 0.011, "GBP": 0.0095, "INR": 1.0}',
  NOW()
);