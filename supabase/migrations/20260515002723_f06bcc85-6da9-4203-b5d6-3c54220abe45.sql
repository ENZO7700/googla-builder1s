
insert into storage.buckets (id, name, public)
values ('inquiry-attachments', 'inquiry-attachments', false)
on conflict (id) do nothing;

create policy "inquiry attachments owner read"
on storage.objects for select
using (
  bucket_id = 'inquiry-attachments'
  and public.is_wp_site_owner( ((storage.foldername(name))[1])::uuid )
);

create policy "inquiry attachments owner delete"
on storage.objects for delete
using (
  bucket_id = 'inquiry-attachments'
  and public.is_wp_site_owner( ((storage.foldername(name))[1])::uuid )
);
