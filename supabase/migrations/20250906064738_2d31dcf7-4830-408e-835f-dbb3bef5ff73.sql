-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  country TEXT,
  preferred_currency TEXT DEFAULT 'INR',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for wallets updated_at
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Create profile entry
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'name',
    NEW.email
  );
  
  -- Create wallet entry with zero balance
  INSERT INTO public.wallets (user_id, balance_inr, balance_display, currency)
  VALUES (NEW.id, 0, 0, 'INR');
  
  RETURN NEW;
END;
$$;

-- Trigger to create profile and wallet when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_fx_rates_fetched_at ON public.fx_rates(fetched_at);