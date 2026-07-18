-- Add sender_name to transactions (used for Income category to record who sent the money)
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

alter table transactions add column if not exists sender_name text;
