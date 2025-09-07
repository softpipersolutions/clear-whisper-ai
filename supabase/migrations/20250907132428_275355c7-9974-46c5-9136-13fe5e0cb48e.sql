-- Phase 1: Database Schema Updates

-- Add new columns to fx_rates table for GPT tracking
ALTER TABLE public.fx_rates 
ADD COLUMN source TEXT DEFAULT 'gpt-5-nano',
ADD COLUMN prompt_version TEXT DEFAULT 'v1.0',
ADD COLUMN confidence_score NUMERIC DEFAULT 0.95;

-- Add model_id column to messages table for chat bubble model display
ALTER TABLE public.messages 
ADD COLUMN model_id TEXT;

-- Add an index for better performance on model_id lookups
CREATE INDEX idx_messages_model_id ON public.messages(model_id);

-- Enable pg_cron and pg_net extensions for scheduled FX updates
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;