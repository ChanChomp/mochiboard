-- Storage bucket + policies for book cover images in mochiboard
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Note: if the "book-covers" bucket already exists (e.g. created via the dashboard UI),
-- the insert below is a no-op; just make sure the policies below are applied too.

insert into storage.buckets (id, name, public)
values ('book-covers', 'book-covers', true)
on conflict (id) do nothing;

create policy "Public read access for book covers"
  on storage.objects for select
  using (bucket_id = 'book-covers');

create policy "Users can upload their own book covers"
  on storage.objects for insert
  with check (bucket_id = 'book-covers' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update their own book covers"
  on storage.objects for update
  using (bucket_id = 'book-covers' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own book covers"
  on storage.objects for delete
  using (bucket_id = 'book-covers' and auth.uid()::text = (storage.foldername(name))[1]);
