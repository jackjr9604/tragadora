create extension if not exists pgcrypto;
create schema if not exists auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'service_role') $$;
create or replace function public.has_admin_permission(permission_key text) returns boolean language sql stable as $$ select true $$;

create table public.languages(code text primary key,is_default boolean not null default false,is_active boolean not null default true);
create table public.site_content(
  key text not null,language text not null,value text not null,type text not null default 'text',
  updated_by uuid,updated_at timestamptz not null default now(),primary key(key,language)
);
create table public.translation_field_state(
  id uuid primary key default gen_random_uuid(),resource_type text not null,resource_id text not null,
  field_name text not null,target_language text not null,lock_version bigint not null default 1
);
create table public.translation_jobs(id uuid primary key default gen_random_uuid());
alter table public.site_content enable row level security;
grant select on public.languages,public.translation_field_state to authenticated;
grant select,insert,update,delete on public.site_content to authenticated;
insert into public.languages values('es',true,true),('en',false,true),('pt',false,true);
insert into public.site_content(key,language,value,type) values('home.hero.title','es','Fuente','text');
insert into public.translation_field_state(resource_type,resource_id,field_name,target_language)
values('site_content','home.hero.title','value','en'),('site_content','home.hero.title','value','pt');

create or replace function public.translation_publish_draft(p_state_id uuid,p_expected_lock_version bigint)
returns bigint language plpgsql security definer set search_path=pg_catalog,public as $$
declare s public.translation_field_state%rowtype;
begin
  select * into s from public.translation_field_state where id=p_state_id;
  perform set_config('app.translation_editor_publish_state',s.id::text,true);
  insert into public.site_content(key,language,value,type) values(s.resource_id,s.target_language,'Publicada','text')
  on conflict(key,language) do update set value=excluded.value;
  return s.lock_version+1;
end $$;
