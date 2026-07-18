-- Replace subscriptions.next_renewal_date with simplified recurrence fields for mochiboard
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

alter table subscriptions add column if not exists renewal_day integer;
alter table subscriptions add column if not exists renewal_weekday integer;
alter table subscriptions add column if not exists renewal_month integer;
alter table subscriptions drop column if exists next_renewal_date;
