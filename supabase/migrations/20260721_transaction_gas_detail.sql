-- Gas fill-up detail fields for transactions in mochiboard
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

alter table transactions add column if not exists price_per_gallon numeric;
alter table transactions add column if not exists gallons numeric;
