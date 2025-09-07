-- Add 'signup_bonus' to the allowed transaction types
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_type_check 
CHECK (type = ANY (ARRAY['recharge'::text, 'deduction'::text, 'signup_bonus'::text]));

-- Update the handle_new_user function to provide ₹50 signup bonus
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  signup_bonus_inr NUMERIC := 50.00;
  signup_bonus_display NUMERIC;
  user_currency TEXT;
BEGIN
  -- Get user's preferred currency
  user_currency := COALESCE(NEW.raw_user_meta_data ->> 'preferred_currency', 'INR');
  
  -- Calculate display amount (same as INR for now, can add FX conversion later)
  signup_bonus_display := signup_bonus_inr;
  
  -- Create profile entry
  INSERT INTO public.profiles (id, name, email, country, preferred_currency)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'name',
    NEW.email,
    NEW.raw_user_meta_data ->> 'country',
    user_currency
  );
  
  -- Create wallet entry with signup bonus instead of zero balance
  INSERT INTO public.wallets (user_id, balance_inr, balance_display, currency)
  VALUES (NEW.id, signup_bonus_inr, signup_bonus_display, user_currency);
  
  -- Log the signup bonus transaction for transparency
  INSERT INTO public.transactions (user_id, type, amount_inr, amount_display, currency)
  VALUES (NEW.id, 'signup_bonus', signup_bonus_inr, signup_bonus_display, user_currency);
  
  RETURN NEW;
END;
$$;

-- Backfill existing users who don't have signup bonus yet
-- First, add signup bonus transactions for eligible users
INSERT INTO public.transactions (user_id, type, amount_inr, amount_display, currency)
SELECT 
  w.user_id,
  'signup_bonus',
  50.00,
  50.00, 
  w.currency
FROM public.wallets w
WHERE NOT EXISTS (
  SELECT 1 FROM public.transactions t 
  WHERE t.user_id = w.user_id AND t.type = 'signup_bonus'
);

-- Update wallet balances for users who just got the signup bonus transaction
UPDATE public.wallets 
SET 
  balance_inr = balance_inr + 50.00,
  balance_display = balance_display + 50.00,
  updated_at = now()
WHERE user_id IN (
  SELECT user_id FROM public.transactions 
  WHERE type = 'signup_bonus' 
  AND created_at > NOW() - INTERVAL '5 minutes' -- Recently added transactions
);