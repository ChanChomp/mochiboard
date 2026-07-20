-- Adds an optional per-item category to transaction_items (used for Amazon
-- Online Shopping order breakdowns on the Finances page).
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

alter table transaction_items add column if not exists item_category text;
