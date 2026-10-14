create extension if not exists pgcrypto;
create schema if not exists auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
alter role service_role bypassrls;
create or replace function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),current_user)$$;
create or replace function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;

create table public.languages(
 code text primary key check(code=lower(code) and code~'^[a-z]{2,3}(-[a-z0-9]{2,8})?$'),name text not null,native_name text not null,
 is_active boolean not null default true,is_default boolean not null default false,sort_order integer not null default 0,
 auto_translate boolean not null default false,created_at timestamptz not null default now(),publication_status text not null default 'draft',
 published_at timestamptz,published_by uuid,constraint languages_published_requires_active_check check(publication_status<>'published' or is_active)
);
create unique index languages_single_default_idx on public.languages(is_default) where is_default;
create table public.site_content(key text,language text references public.languages(code) on delete restrict,value text,type text,primary key(key,language));
create table public.translation_field_state(id uuid primary key default gen_random_uuid(),resource_type text,resource_id text,field_name text,
 source_language text references public.languages(code),target_language text references public.languages(code),status text,publication_status text default 'unpublished');
create table public.translation_jobs(id uuid primary key default gen_random_uuid(),resource_type text,resource_id text,field_name text,
 source_language text references public.languages(code),target_language text references public.languages(code),status text);
create table public.profiles(id uuid primary key);
create table public.admin_audit_log(id uuid primary key default gen_random_uuid(),actor_user_id uuid not null references public.profiles(id),target_user_id uuid references public.profiles(id),action text not null,module text,previous_value jsonb,new_value jsonb,created_at timestamptz not null default now());
alter table public.languages enable row level security;
create policy tg_languages_create on public.languages for insert to authenticated with check(true);
create policy tg_languages_update on public.languages for update to authenticated using(true) with check(true);
create policy tg_languages_delete on public.languages for delete to authenticated using(true);
grant usage on schema public,auth to anon,authenticated,service_role;
grant select,insert,update,delete on public.languages to anon,authenticated,service_role;
grant all on all tables in schema public to service_role;
insert into public.profiles(id) values('00000000-0000-0000-0000-000000000001');
insert into public.languages(code,name,native_name,is_active,is_default,sort_order,auto_translate,publication_status,published_at)
values('es','Spanish','Español',true,true,0,false,'published',now()),('en','English','English',true,false,10,true,'published',now()),('pt','Portuguese','Português',true,false,20,true,'published',now());
