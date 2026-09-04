-- À appliquer après 001_global.sql dans le NOUVEAU projet Supabase.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('rg-documents','rg-documents',false,15728640,array['application/pdf']) on conflict(id) do nothing;
drop policy if exists rg_pdf_upload on storage.objects;
create policy rg_pdf_upload on storage.objects for insert to authenticated with check(bucket_id='rg-documents' and public.rg_active() and (storage.foldername(name))[1]=auth.uid()::text and lower(storage.extension(name))='pdf');
drop policy if exists rg_pdf_read on storage.objects;
create policy rg_pdf_read on storage.objects for select to authenticated using(bucket_id='rg-documents' and public.rg_active() and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.rg_operations o where o.document_path=name)));
-- Pas de politique UPDATE/DELETE : pièces originales non remplaçables depuis l'application.
