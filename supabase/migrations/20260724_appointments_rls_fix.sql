-- Idempotently ensure RLS is enabled and ownership policies exist on appointments.
-- Safe to re-run regardless of whether these were already applied.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

alter table appointments enable row level security;

drop policy if exists "Users can view their own appointments" on appointments;
create policy "Users can view their own appointments"
  on appointments for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own appointments" on appointments;
create policy "Users can insert their own appointments"
  on appointments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own appointments" on appointments;
create policy "Users can update their own appointments"
  on appointments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own appointments" on appointments;
create policy "Users can delete their own appointments"
  on appointments for delete
  using (auth.uid() = user_id);
