-- NOUVEAU PROJET SUPABASE UNIQUEMENT. Aucun lien avec l'ancienne application.
begin;
create table if not exists public.rg_profiles(
 id uuid primary key references auth.users(id),full_name text not null,email text not null,
 role text not null check(role in ('admin','user')),active boolean not null default true,created_at timestamptz not null default now()
);
create or replace function public.rg_active() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from rg_profiles where id=auth.uid() and active) $$;
create or replace function public.rg_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from rg_profiles where id=auth.uid() and active and role='admin') $$;
create table if not exists public.rg_opening(
 id integer primary key check(id=1),date date,quantities jsonb not null default '{"B65":0,"B33N":0,"B33V":0,"B30CL":0,"ALE50":0,"BAC":0}',
 locked boolean not null default false,revision integer not null default 0,source_metadata jsonb not null default '{}'
);
insert into rg_opening(id) values(1) on conflict do nothing;
create table if not exists public.rg_operations(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,date date,
 kind text not null check(kind in ('delivery','return','paid','bottles','breakage','loss','legacy')),
 ref text not null,ref_key text not null,lines jsonb not null,inputs jsonb not null default '[]',
 source text not null check(source in ('manual','pdf','workbook')),source_key text unique,
 bv_amount numeric,document_path text,pdf_sha256 text check(pdf_sha256 is null or pdf_sha256 ~ '^[a-f0-9]{64}$'),
 metadata jsonb not null default '{}',note text not null default '',
 created_by uuid not null,created_at timestamptz not null default now(),
 cancel_date date,cancel_reason text,cancelled_by uuid,cancelled_at timestamptz
);
create unique index if not exists rg_request_document on rg_operations(pdf_sha256) where pdf_sha256 is not null and cancel_date is null;
create unique index if not exists rg_document_ref on rg_operations(kind,ref_key) where cancel_date is null and source<>'workbook';
create index if not exists rg_date_idx on rg_operations(date);
create table if not exists public.rg_audit(id uuid primary key default gen_random_uuid(),action text not null,actor_id uuid not null,details jsonb not null,created_at timestamptz not null default now());
create table if not exists public.rg_mappings(code text primary key,bremer_id text not null check(bremer_id in ('B65','B33N','B33V','B30CL','ALE50','BAC')),label text not null);
insert into rg_mappings values('2018','ALE50','Doppel Munich 50 cl C20'),('2997','ALE50','Peak 50 cl C20'),('2927','ALE50','33 Export 50 cl C20'),('2905','B33N','Tembo 33 cl C24') on conflict do nothing;
create table if not exists public.rg_legacy_batches(file_hash text primary key,archive jsonb not null,created_at timestamptz not null default now(),created_by uuid not null);
alter table rg_profiles enable row level security;
alter table rg_opening enable row level security;
alter table rg_operations enable row level security;
alter table rg_audit enable row level security;
alter table rg_mappings enable row level security;
alter table rg_legacy_batches enable row level security;
drop policy if exists rg_profiles_read on rg_profiles;
create policy rg_profiles_read on rg_profiles for select to authenticated using(id=auth.uid() or rg_admin());
drop policy if exists rg_opening_read on rg_opening;
create policy rg_opening_read on rg_opening for select to authenticated using(rg_active());
drop policy if exists rg_operations_read on rg_operations;
create policy rg_operations_read on rg_operations for select to authenticated using(rg_active());
drop policy if exists rg_audit_read on rg_audit;
create policy rg_audit_read on rg_audit for select to authenticated using(rg_admin());
drop policy if exists rg_mappings_read on rg_mappings;
create policy rg_mappings_read on rg_mappings for select to authenticated using(rg_active());
drop policy if exists rg_batches_read on rg_legacy_batches;
create policy rg_batches_read on rg_legacy_batches for select to authenticated using(rg_admin());
revoke all on rg_profiles,rg_opening,rg_operations,rg_audit,rg_mappings,rg_legacy_batches from public,anon,authenticated;
grant select on rg_profiles,rg_opening,rg_operations,rg_audit,rg_mappings,rg_legacy_batches to authenticated;
create or replace function public.rg_price(t text) returns integer language sql immutable as $$ select case when t='BAC' then 4500 when t='ALE50' then 24500 when t in ('B65','B33N','B33V','B30CL') then 16500 else null end $$;
create or replace function public.rg_ref_key(t text) returns text language sql immutable as $$ select case when regexp_replace(upper(trim(t)),'\s','','g') ~ '^\d{10}(/\d+/\d{4})?$' then left(regexp_replace(upper(trim(t)),'\s','','g'),10) else regexp_replace(upper(trim(t)),'\s','','g') end $$;
create or replace function public.rg_validate_lines(p jsonb) returns void language plpgsql set search_path=public as $$
declare l jsonb;q numeric;
begin
 if jsonb_typeof(p) is distinct from 'array' then raise exception 'Lignes invalides.';end if;
 if jsonb_array_length(p)>6 then raise exception 'Six familles maximum.';end if;
 if (select count(distinct value->>'bremer_id') from jsonb_array_elements(p))<>jsonb_array_length(p) then raise exception 'Famille répétée.';end if;
 for l in select value from jsonb_array_elements(p) loop
  q:=(l->>'delta')::numeric;
  if rg_price(l->>'bremer_id') is null or q is null or q<>trunc(q) or abs(q)>1000000000 or (l->>'unit_price')::numeric is distinct from rg_price(l->>'bremer_id')::numeric then raise exception 'Ligne comptable invalide.';end if;
 end loop;
end $$;
create or replace function public.rg_post(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare k text;r text;d date;req uuid;oid uuid;l jsonb;t text;n numeric;q numeric;sgn integer;pack integer;price integer;bv numeric:=0;sumq numeric:=0;bac numeric:=0;outlines jsonb:='[]';opdate date;
begin
 if not rg_active() then raise exception 'Compte inactif ou non autorisé.';end if;
 perform pg_advisory_xact_lock(20260904,1);
 req:=(p->>'request_id')::uuid;if req is null then raise exception 'Identifiant requis.';end if;
 select id into oid from rg_operations where request_id=req;if oid is not null then return oid;end if;
 k:=p->>'kind';r:=trim(p->>'ref');d:=(p->>'date')::date;
 if k is null or k not in ('delivery','return','paid','bottles','breakage','loss') or coalesce(r,'')='' or length(r)>120 or d is null or d>current_date then raise exception 'Nature, référence ou date invalide.';end if;
 select date into opdate from rg_opening where id=1;
 if opdate is null then raise exception 'Confirmez d’abord la date du report initial.';end if;
 if d<opdate then raise exception 'Date antérieure au report initial.';end if;
 if exists(select 1 from rg_operations where kind=k and ref_key=rg_ref_key(r) and cancel_date is null) then raise exception 'Ce document est déjà enregistré.';end if;
 if jsonb_typeof(p->'rows') is distinct from 'array' then raise exception 'Quantités requises.';end if;
 if jsonb_array_length(p->'rows')<>6 or (select count(distinct value->>'bremer_id') from jsonb_array_elements(p->'rows'))<>6 then raise exception 'Les six familles sont requises.';end if;
 for l in select value from jsonb_array_elements(p->'rows') loop
  t:=l->>'bremer_id';n:=(l->>'quantity')::numeric;price:=rg_price(t);
  if price is null or n is null or n<0 or n<>trunc(n) or n>10000000 then raise exception 'Quantité entière invalide.';end if;
  if n=0 then continue;end if;sumq:=sumq+n;q:=n;
  if k in ('bottles','breakage') and t='BAC' then raise exception 'Les bacs sont calculés automatiquement.';end if;
  if k='bottles' then
   pack:=case when t='B65' then 12 when t='ALE50' then 20 else 24 end;
   if mod(n,pack)<>0 then raise exception 'Bouteilles : multiple de % requis.',pack;end if;
   q:=n/pack;bv:=bv+n*(case when t in ('B65','ALE50') then 1000 else 500 end);bac:=bac+q;
  end if;
  if k='paid' then bv:=bv+q*price;end if;
  if k='breakage' then bac:=bac-q;end if;
  sgn:=case when k in ('delivery','breakage','loss') then 1 else -1 end;
  outlines:=outlines||jsonb_build_array(jsonb_build_object('bremer_id',t,'delta',sgn*q,'unit_price',price));
 end loop;
 if sumq=0 then raise exception 'Au moins une quantité requise.';end if;
 if bac<>0 then outlines:=outlines||jsonb_build_array(jsonb_build_object('bremer_id','BAC','delta',bac,'unit_price',4500));end if;
 if k in ('paid','bottles') and ((p->>'bv_amount')::numeric is distinct from bv) then raise exception 'Montant BV attendu : % Fc.',bv;end if;
 if k in ('breakage','loss') and length(trim(coalesce(p->>'note','')))<3 then raise exception 'Motif obligatoire.';end if;
 if p->>'source' not in ('manual','pdf') or p->>'source' is null then raise exception 'Source invalide.';end if;
 if p->>'source'='pdf' then
  if k not in ('delivery','return') or (p->>'reviewed')::boolean is distinct from true then raise exception 'Vérification du PDF requise.';end if;
  if p->>'document_path' is null or split_part(p->>'document_path','/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='rg-documents' and name=p->>'document_path') then raise exception 'Justificatif PDF non conservé.';end if;
  if p->>'pdf_sha256' is null then raise exception 'Empreinte PDF requise.';end if;
  if jsonb_array_length(coalesce(p->'metadata'->'warnings','[]'))>0 and length(trim(coalesce(p->>'note','')))<3 then raise exception 'Justifiez la validation des avertissements.';end if;
 end if;
 perform rg_validate_lines(outlines);
 insert into rg_operations(request_id,date,kind,ref,ref_key,lines,inputs,source,bv_amount,document_path,pdf_sha256,metadata,note,created_by)
 values(req,d,k,r,rg_ref_key(r),outlines,p->'rows',p->>'source',case when k in ('paid','bottles') then bv end,case when p->>'source'='pdf' then p->>'document_path' end,case when p->>'source'='pdf' then p->>'pdf_sha256' end,coalesce(p->'metadata','{}'),coalesce(p->>'note',''),auth.uid()) returning id into oid;
 insert into rg_audit(action,actor_id,details) values('post',auth.uid(),jsonb_build_object('id',oid,'ref',r));return oid;
end $$;
create or replace function public.rg_cancel(p_id uuid,p_date date,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare o rg_operations;
begin
 if not rg_admin() then raise exception 'Administrateur requis.';end if;
 perform pg_advisory_xact_lock(20260904,1);
 select * into o from rg_operations where id=p_id for update;
 if o.id is null then raise exception 'Opération inconnue.';end if;
 if o.cancel_date is not null then return;end if;
 if p_date is null or p_date>current_date or (o.date is not null and p_date<o.date) or length(trim(coalesce(p_reason,'')))<3 then raise exception 'Date ou motif invalide.';end if;
 update rg_operations set cancel_date=p_date,cancel_reason=trim(p_reason),cancelled_by=auth.uid(),cancelled_at=now() where id=p_id;
 insert into rg_audit(action,actor_id,details) values('cancel',auth.uid(),jsonb_build_object('id',p_id,'date',p_date,'reason',p_reason));
end $$;
create or replace function public.rg_save_opening(p_date date,p_quantities jsonb,p_locked boolean,p_revision integer,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare o rg_opening;k text;n numeric;changed boolean;
begin
 if not rg_admin() then raise exception 'Administrateur requis.';end if;perform pg_advisory_xact_lock(20260904,1);
 select * into o from rg_opening where id=1 for update;
 if p_revision is null or o.revision<>p_revision then raise exception 'Report modifié ailleurs. Actualisez.';end if;
 if length(trim(coalesce(p_reason,'')))<3 or p_locked is null then raise exception 'Motif et état requis.';end if;
 if jsonb_typeof(p_quantities) is distinct from 'object' then raise exception 'Six soldes requis.';end if;
 if (select count(*) from jsonb_object_keys(p_quantities))<>6 then raise exception 'Six soldes requis.';end if;
 for k in select jsonb_object_keys(p_quantities) loop n:=(p_quantities->>k)::numeric;if rg_price(k) is null or n is null or n<>trunc(n) or abs(n)>1000000000 then raise exception 'Solde invalide.';end if;end loop;
 changed:=p_quantities<>o.quantities or p_date is distinct from o.date;
 if o.locked and changed then raise exception 'Déverrouillez le report avant de le modifier.';end if;
 if changed and (p_date is null or p_date>current_date or exists(select 1 from rg_operations where date<p_date)) then raise exception 'Date du report incompatible avec les mouvements.';end if;
 update rg_opening set date=p_date,quantities=p_quantities,locked=p_locked,revision=revision+1 where id=1;
 insert into rg_audit(action,actor_id,details) values('opening',auth.uid(),jsonb_build_object('before',to_jsonb(o),'date',p_date,'quantities',p_quantities,'locked',p_locked,'reason',p_reason));
end $$;
create or replace function public.rg_set_profile(p_id uuid,p_role text,p_active boolean) returns void language plpgsql security definer set search_path=public as $$
begin
 if not rg_admin() then raise exception 'Administrateur requis.';end if;perform pg_advisory_xact_lock(20260904,1);
 if p_role is null or p_role not in ('admin','user') or p_active is null then raise exception 'Profil invalide.';end if;
 if p_id=auth.uid() then raise exception 'Ne modifiez pas vos propres droits.';end if;
 if not exists(select 1 from rg_profiles where id=p_id) then raise exception 'Compte introuvable.';end if;
 update rg_profiles set role=p_role,active=p_active where id=p_id;
 insert into rg_audit(action,actor_id,details) values('profile',auth.uid(),jsonb_build_object('id',p_id,'role',p_role,'active',p_active));
end $$;
create or replace function public.rg_save_mapping(p_code text,p_type text,p_label text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not rg_admin() then raise exception 'Administrateur requis.';end if;
 if p_code is null or p_code !~ '^\d{4,6}$' or rg_price(p_type) is null or length(trim(coalesce(p_label,'')))<2 then raise exception 'Correspondance invalide.';end if;
 insert into rg_mappings values(p_code,p_type,trim(p_label)) on conflict(code) do update set bremer_id=excluded.bremer_id,label=excluded.label;
 insert into rg_audit(action,actor_id,details) values('mapping',auth.uid(),jsonb_build_object('code',p_code,'bremer_id',p_type,'label',p_label));
end $$;
-- Import comptable atomique, uniquement dans un compte neuf. Ne recalcule pas les anciennes opérations selon de nouvelles règles.
create or replace function public.rg_import_workbook(p jsonb) returns integer language plpgsql security definer set search_path=public as $$
declare m jsonb;k text;q numeric;n integer:=0;h text;d date;typ text;
begin
 if not rg_admin() then raise exception 'Administrateur requis.';end if;perform pg_advisory_xact_lock(20260904,1);
 h:=p->>'file_hash';if h is null or h!~ '^[a-f0-9]{64}$' or (p->>'format') is distinct from 'rivinter-workbook-v1' then raise exception 'Fichier de reprise invalide.';end if;
 if exists(select 1 from rg_legacy_batches where file_hash=h) then raise exception 'Ce classeur a déjà été repris.';end if;
 if exists(select 1 from rg_operations) or exists(select 1 from rg_opening where revision<>0) then raise exception 'La reprise initiale est réservée à un compte neuf. Aucune donnée existante ne sera écrasée.';end if;
 if jsonb_typeof(p->'operations') is distinct from 'array' or jsonb_typeof(p->'opening'->'quantities') is distinct from 'object' then raise exception 'Données de reprise invalides.';end if;
 if jsonb_array_length(p->'operations')<1 or jsonb_array_length(p->'operations')>10000 or (select count(*) from jsonb_object_keys(p->'opening'->'quantities'))<>6 then raise exception 'Reprise hors limites.';end if;
 for k in select jsonb_object_keys(p->'opening'->'quantities') loop q:=(p->'opening'->'quantities'->>k)::numeric;if rg_price(k) is null or q is null or q<>trunc(q) or abs(q)>1000000000 then raise exception 'Report invalide.';end if;end loop;
 update rg_opening set date=null,quantities=p->'opening'->'quantities',locked=true,revision=1,source_metadata=p->'opening'->'source_metadata' where id=1;
 for m in select value from jsonb_array_elements(p->'operations') loop
  perform rg_validate_lines(m->'lines');d:=(m->>'date')::date;typ:=m->>'kind';
  if d>current_date or coalesce(m->>'ref','')='' or coalesce(m->>'source_key','')='' or typ is null or typ not in ('delivery','return','paid','bottles','breakage','loss','legacy') then raise exception 'Ligne historique invalide.';end if;
  insert into rg_operations(request_id,date,kind,ref,ref_key,lines,source,source_key,metadata,note,created_by)
  values(gen_random_uuid(),d,typ,m->>'ref',rg_ref_key(m->>'ref'),m->'lines','workbook',h||':'||(m->>'source_key'),coalesce(m->'metadata','{}'),'Reprise fidèle du classeur, sans réinterprétation.',auth.uid());n:=n+1;
 end loop;
 if p ? 'expected_closing' then
  if (p->'expected_closing'->>'count')::integer is distinct from n then raise exception 'Nombre de lignes non conforme.';end if;
  for k in select jsonb_object_keys(p->'opening'->'quantities') loop
   select coalesce(sum((l->>'delta')::numeric),0)+(p->'opening'->'quantities'->>k)::numeric into q from rg_operations o cross join lateral jsonb_array_elements(o.lines) l where l->>'bremer_id'=k;
   if q is distinct from (p->'expected_closing'->'quantities'->>k)::numeric then raise exception 'Solde de reprise non conforme pour %.',k;end if;
  end loop;
 end if;
 insert into rg_legacy_batches values(h,p,now(),auth.uid());
 insert into rg_audit(action,actor_id,details) values('import_workbook',auth.uid(),jsonb_build_object('hash',h,'count',n));return n;
end $$;
revoke all on function rg_post(jsonb),rg_cancel(uuid,date,text),rg_save_opening(date,jsonb,boolean,integer,text),rg_set_profile(uuid,text,boolean),rg_save_mapping(text,text,text),rg_import_workbook(jsonb),rg_validate_lines(jsonb) from public,anon,authenticated;
grant execute on function rg_post(jsonb),rg_cancel(uuid,date,text),rg_save_opening(date,jsonb,boolean,integer,text),rg_set_profile(uuid,text,boolean),rg_save_mapping(text,text,text),rg_import_workbook(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
