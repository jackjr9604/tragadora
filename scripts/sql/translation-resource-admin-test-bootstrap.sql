create schema if not exists auth;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'service_role') $$;

create table public.translation_field_state(
  id uuid primary key,
  resource_type text not null,
  resource_id text not null,
  field_name text not null,
  target_language text not null,
  status text not null,
  workflow_status text not null default 'none',
  publication_status text not null default 'unpublished',
  is_protected boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.platforms(id uuid primary key,name text,type text);
create table public.offers(id uuid primary key,title text);
create table public.challenge_phases(id uuid primary key,challenge_id uuid,phase_number integer);
create table public.challenge_variants(id uuid primary key,challenge_id uuid,name text);
create table public.challenge_variant_phases(id uuid primary key,variant_id uuid,phase_number integer);
create table public.account_plans(id uuid primary key,challenge_id uuid,account_size numeric,currency text);
create table public.challenge_reward_options(id uuid primary key,challenge_id uuid,name text);
create table public.tools(id uuid primary key,name text);
create table public.communities(id uuid primary key,name text);
create table public.giveaways(id uuid primary key,title text);
create table public.blog_posts(id uuid primary key,title text);
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
