-- Allow authenticated users to update (upsert) their own avatar
create policy "Auth update avatars"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.role() = 'authenticated');
