create policy "Users upload proofs to own folder"
on storage.objects for insert to authenticated
with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Authenticated users read proofs"
on storage.objects for select to authenticated
using (bucket_id = 'proofs');

create policy "Users delete own proofs"
on storage.objects for delete to authenticated
using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);