-- Replace due_date with a simple monthly due_day for credit cards in mochiboard
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

alter table credit_cards add column if not exists due_day integer;
alter table credit_cards drop column if exists due_date;
