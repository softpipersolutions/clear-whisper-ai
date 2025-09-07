-- Set up weekly cron job for GPT FX rate updates
SELECT extensions.cron.schedule(
  'fx-gpt-weekly-update',
  '0 2 * * 1', -- Every Monday at 2 AM
  $$
  SELECT extensions.net.http_post(
    url := 'https://dxxovxcdbdkyhokusnaz.supabase.co/functions/v1/fx-gpt-updater',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4eG92eGNkYmRreWhva3VzbmF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMzc3NDEsImV4cCI6MjA3MjcxMzc0MX0.Kq8VD8YUfbdtZUgn1gWk6FuU_Cs1nX8furJhOjiWZR8"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  );
  $$
);