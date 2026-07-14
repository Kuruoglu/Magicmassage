insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-media',
  'admin-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read admin media" on storage.objects;

drop policy if exists "content roles can upload admin media" on storage.objects;
create policy "content roles can upload admin media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'admin-media'
  and public.admin_has_role(array['owner', 'administrator', 'editor']::public.admin_role[])
);

drop policy if exists "content roles can update admin media" on storage.objects;
create policy "content roles can update admin media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'admin-media'
  and public.admin_has_role(array['owner', 'administrator', 'editor']::public.admin_role[])
)
with check (
  bucket_id = 'admin-media'
  and public.admin_has_role(array['owner', 'administrator', 'editor']::public.admin_role[])
);

drop policy if exists "owners can delete admin media" on storage.objects;
create policy "owners can delete admin media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'admin-media'
  and public.admin_has_role(array['owner']::public.admin_role[])
);
