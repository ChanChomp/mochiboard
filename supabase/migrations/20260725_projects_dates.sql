-- Start/finish dates for projects.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

alter table projects add column if not exists start_date date;
alter table projects add column if not exists finish_date date;
