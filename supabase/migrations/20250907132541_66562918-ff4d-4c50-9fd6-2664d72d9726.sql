-- Fix security warning: Move extensions from public schema
-- Create extensions schema and move extensions there
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move pg_cron and pg_net to extensions schema
DROP EXTENSION IF EXISTS pg_cron;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;