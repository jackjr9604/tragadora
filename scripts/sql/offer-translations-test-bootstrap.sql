create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function public.has_admin_permission(permission text) returns boolean language sql stable as $$
  select permission = any(string_to_array(coalesce(current_setting('app.test_permissions', true), ''), ','))
$$;

create table public.languages (
  code text primary key, name text not null, native_name text not null,
  is_active boolean not null default true, is_default boolean not null default false,
  auto_translate boolean not null default false, sort_order integer not null default 0
);
insert into public.languages(code,name,native_name,is_active,is_default,auto_translate,sort_order) values
 ('es','Spanish','Español',true,true,true,1),('en','English','English',true,false,true,2),('pt','Portuguese','Português',true,false,true,3);

create table public.site_content (
  id uuid primary key default extensions.gen_random_uuid(), key text not null, language text not null references public.languages(code),
  value text not null, type text not null default 'text', updated_by uuid, updated_at timestamptz not null default now(), unique(key,language)
);
create table public.platforms (id uuid primary key default extensions.gen_random_uuid());
create table public.platform_translations (
  platform_id uuid not null references public.platforms(id) on delete cascade, language text not null references public.languages(code),
  short_description text, description text, pros jsonb, cons jsonb, seo_title text, seo_description text,
  primary key(platform_id,language)
);
create table public.offers (
  id uuid primary key default extensions.gen_random_uuid(), platform_id uuid, challenge_id uuid, affiliate_link_id uuid,
  title text not null, description text, discount_value numeric, discount_type text not null, promo_code text,
  country_code text, language text, starts_at timestamptz, expires_at timestamptz, status boolean not null default true,
  priority integer not null default 1, created_at timestamptz not null default now(), includes_free_account boolean not null default false,
  free_account_label text, is_featured boolean not null default false, hot_badge text, short_highlight text
);
insert into public.offers(title,description,discount_value,discount_type,promo_code,language,free_account_label,hot_badge,short_highlight) values
 ('Oferta legacy ES','Descripción ES',20,'percentage','LEGACY-ES','es','Cuenta gratis','Exclusiva','Beneficio ES'),
 ('Legacy EN offer','English description',15,'percentage','LEGACY-EN','en','Free account','Exclusive','English benefit'),
 ('Oferta legacy PT','Descrição PT',10,'percentage','LEGACY-PT','pt','Conta grátis','Exclusiva','Benefício PT');
