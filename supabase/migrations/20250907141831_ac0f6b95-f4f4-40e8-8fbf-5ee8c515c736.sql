-- Create new daily cron job at 2 AM UTC (replacing any existing FX update job)
SELECT cron.schedule(
  'daily-fx-update',
  '0 2 * * *', -- Daily at 2 AM UTC
  $$
  SELECT
    net.http_post(
        url:='https://dxxovxcdbdkyhokusnaz.supabase.co/functions/v1/fx-updater',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4eG92eGNkYmRreWhva3VzbmF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMzc3NDEsImV4cCI6MjA3MjcxMzc0MX0.Kq8VD8YUfbdtZUgn1gWk6FuU_Cs1nX8furJhOjiWZR8"}'::jsonb,
        body:='{"cron_trigger": true}'::jsonb
    ) as request_id;
  $$
);