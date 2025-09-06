-- Enable Row Level Security on all new tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

-- Create basic policies for profiles table
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Create basic policies for wallets table
CREATE POLICY "Users can view their own wallet" ON public.wallets
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create basic policies for transactions table
CREATE POLICY "Users can view their own transactions" ON public.transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for fx_rates table (public read access)
CREATE POLICY "Anyone can view fx rates" ON public.fx_rates
  FOR SELECT
  USING (true);

-- Create policies for edge functions to access wallets and transactions
CREATE POLICY "Edge functions can update wallets" ON public.wallets
  FOR UPDATE
  USING (true);

CREATE POLICY "Edge functions can insert transactions" ON public.transactions
  FOR INSERT
  WITH CHECK (true);

-- Fix the function search path issue
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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