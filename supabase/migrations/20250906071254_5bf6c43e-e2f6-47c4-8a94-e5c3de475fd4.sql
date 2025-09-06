-- Create trigger to auto-create profile and wallet for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $function$
BEGIN
  -- Create profile entry
  INSERT INTO public.profiles (id, name, email, country, preferred_currency)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'name',
    NEW.email,
    NEW.raw_user_meta_data ->> 'country',
    COALESCE(NEW.raw_user_meta_data ->> 'preferred_currency', 'INR')
  );
  
  -- Create wallet entry with zero balance
  INSERT INTO public.wallets (user_id, balance_inr, balance_display, currency)
  VALUES (NEW.id, 0, 0, COALESCE(NEW.raw_user_meta_data ->> 'preferred_currency', 'INR'));
  
  RETURN NEW;
END;
$function$;

-- Create trigger to execute the function on new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();