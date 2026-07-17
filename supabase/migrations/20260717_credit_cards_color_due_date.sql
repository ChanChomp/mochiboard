-- Add color and due date to credit cards for mochiboard
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

alter table credit_cards add column if not exists card_color text not null default 'peach';
alter table credit_cards add column if not exists due_date date;
