create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create or replace function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('app.test_role',true),''),current_user)$$;

create table public.languages(
  code text primary key,name text not null,native_name text not null,is_active boolean not null default true,
  is_default boolean not null default false,sort_order integer not null default 0,auto_translate boolean not null default false,
  publication_status text not null default 'draft',ui_catalog_available boolean not null default false,
  seo_ready boolean not null default false,libretranslate_status text not null default 'unknown',
  libretranslate_checked_at timestamptz,updated_at timestamptz not null default now(),lock_version bigint not null default 1
);
insert into public.languages(code,name,native_name,is_active,is_default,sort_order,auto_translate,publication_status,ui_catalog_available,seo_ready)
values('es','Spanish','Español',true,true,0,false,'published',true,true),
 ('en','English','English',true,false,10,true,'published',true,true),
 ('pt','Portuguese','Português',true,false,20,true,'published',true,true);

create table public.translation_field_state(
  id uuid primary key default extensions.gen_random_uuid(),resource_type text not null,resource_id text not null,field_name text not null,
  source_language text not null references public.languages(code),target_language text not null references public.languages(code),
  source_hash text not null,source_revision bigint not null,status text not null default 'missing',
  workflow_status text not null default 'none',publication_status text not null default 'unpublished',
  is_protected boolean not null default false,lock_version bigint not null default 1,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
insert into public.translation_field_state(resource_type,resource_id,field_name,source_language,target_language,source_hash,source_revision)
values('blog_post_translation',extensions.gen_random_uuid()::text,'title','es','en',repeat('a',64),1);

create table public.translation_jobs(
  id uuid primary key default extensions.gen_random_uuid(),logical_key text not null,generation integer not null default 1,
  idempotency_key text not null unique,resource_type text not null,resource_id text not null,field_name text not null,
  source_language text not null references public.languages(code),target_language text not null references public.languages(code),
  source_hash text not null,source_revision bigint not null,status text not null default 'queued',requested_provider text,
  provider_used text,priority smallint not null default 50,attempt_count integer not null default 0,max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default now(),locked_at timestamptz,locked_by text,lease_expires_at timestamptz,
  started_at timestamptz,completed_at timestamptz,error_code text,last_error text,input_characters integer,
  output_characters integer,input_tokens integer,output_tokens integer,estimated_cost_usd numeric(14,6),created_by uuid,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),metadata jsonb not null default '{}'::jsonb,
  unique(logical_key,generation)
);
create unique index translation_jobs_one_active_identity_idx on public.translation_jobs(
  resource_type,resource_id,field_name,target_language,source_hash,source_revision
) where status in ('queued','running','retry_wait');

grant usage on schema public,auth to anon,authenticated,service_role;
grant select on all tables in schema public to anon,authenticated;
grant all on all tables in schema public to service_role;
