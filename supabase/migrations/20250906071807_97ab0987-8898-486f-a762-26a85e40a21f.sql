-- Fix security issues by enabling RLS on new tables
-- Note: We're not creating policies yet as per requirements - all access via edge functions

-- Enable RLS on chats table
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- Enable RLS on messages table  
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Fix function security by setting immutable search path
CREATE OR REPLACE FUNCTION public.update_chat_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.chats 
  SET updated_at = now() 
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;