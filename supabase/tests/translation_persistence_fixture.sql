-- Fixture mínimo para validar 202610100001 en PostgreSQL local aislado.
-- No representa una migración de producción.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;

create function auth.uid() returns uuid
language sql stable
as $$ select null::uuid $$;

create table public.languages (
  code text primary key,
  name text not null,
  native_name text not null,
  is_active boolean not null default true,
  is_default boolean not null default false,
  auto_translate boolean not null default false,
  sort_order integer not null default 0
);

create table public.site_content (
  key text not null,
  language text not null references public.languages(code),
  value text,
  type text not null default 'text',
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (key, language)
);

create table public.platform_translations (
  platform_id uuid not null,
  language text not null references public.languages(code),
  short_description text,
  description text,
  pros jsonb,
  cons jsonb,
  seo_title text,
  seo_description text,
  unique (platform_id, language)
);

create function public.has_admin_permission(permission_key text)
returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$ select permission_key is not null $$;

insert into public.languages
  (code,name,native_name,is_active,is_default,auto_translate,sort_order)
values
  ('es','Español','Español',true,true,true,1),
  ('en','English','English',true,false,true,2),
  ('pt','Português','Português',true,false,true,3);

insert into public.site_content (key,language,value,type)
values
  ('fixture.title','es','Título fuente','text'),
  ('fixture.title','en','Imported title','text');

insert into public.platform_translations (
  platform_id,language,short_description,description,pros,cons,seo_title,seo_description
)
values
  ('11111111-1111-4111-8111-111111111111','es','Fuente corta','Descripción fuente',
   '["Pro fuente"]'::jsonb,'["Contra fuente"]'::jsonb,'SEO fuente','Descripción SEO'),
  ('11111111-1111-4111-8111-111111111111','en','Imported short','Imported description',
   '["Imported pro"]'::jsonb,'["Imported con"]'::jsonb,'Imported SEO','Imported SEO description');
