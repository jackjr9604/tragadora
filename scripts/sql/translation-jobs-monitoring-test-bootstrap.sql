create extension if not exists pgcrypto;
create schema if not exists auth;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'service_role') $$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create table public.translation_resource_types(resource_type text primary key,enabled boolean not null default true);
create table public.translation_resource_fields(resource_type text,field_name text,primary key(resource_type,field_name));
create table public.translation_jobs(
 id uuid primary key default gen_random_uuid(),logical_key text not null,generation integer not null default 1,idempotency_key text not null unique,
 resource_type text not null,resource_id text not null,field_name text not null,source_language text not null,target_language text not null,
 source_hash text not null,source_revision bigint not null,status text not null default 'queued',requested_provider text,provider_used text,
 priority smallint not null default 50,attempt_count integer not null default 0,max_attempts integer not null default 5,next_attempt_at timestamptz not null default now(),
 locked_at timestamptz,locked_by text,lease_expires_at timestamptz,started_at timestamptz,completed_at timestamptz,error_code text,last_error text,
 input_characters integer,output_characters integer,input_tokens integer,output_tokens integer,estimated_cost_usd numeric(14,6),created_by uuid,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),metadata jsonb not null default '{}'::jsonb,
 foreign key(resource_type,field_name) references public.translation_resource_fields(resource_type,field_name)
);
