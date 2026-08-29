-- Idiomas dinámicos y metadata de traducciones del CMS.
-- Ejecutar manualmente en Supabase antes de probar el nuevo administrador.

create table if not exists public.languages (
  code text primary key
    check (code = lower(code) and code ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$'),
  name text not null,
  native_name text not null,
  is_active boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  auto_translate boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists languages_single_default_idx
  on public.languages (is_default)
  where is_default = true;

insert into public.languages (
  code, name, native_name, is_active,
  is_default, sort_order, auto_translate
)
values
  ('es', 'Español', 'Español', true, true, 0, false),
  ('en', 'English', 'English', true, false, 10, false),
  ('pt', 'Portuguese', 'Português', true, false, 20, false)
on conflict (code) do update set
  name = excluded.name,
  native_name = excluded.native_name;

-- Migra una sola vez la configuración visual histórica guardada bajo `es`.
-- Los textos traducibles permanecen en sus idiomas actuales.
insert into public.site_content (
  key, language, value, type, updated_by, updated_at
)
select
  source.key,
  'global',
  source.value,
  source.type,
  source.updated_by,
  source.updated_at
from public.site_content as source
where source.language = 'es'
  and source.type = 'config'
  and not exists (
    select 1
    from public.site_content as existing
    where existing.key = source.key
      and existing.language = 'global'
  );

create table if not exists public.content_translation_meta (
  key text not null,
  language text not null
    references public.languages(code)
    on update cascade
    on delete restrict,
  source_language text not null
    references public.languages(code)
    on update cascade
    on delete restrict,
  source_updated_at timestamptz,
  translated_at timestamptz,
  translation_method text not null default 'manual'
    check (translation_method in ('manual', 'auto_generated')),
  manually_edited boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (key, language)
);

create index if not exists content_translation_meta_language_idx
  on public.content_translation_meta (language);

alter table public.languages enable row level security;
alter table public.content_translation_meta enable row level security;

drop policy if exists "languages_public_read" on public.languages;
create policy "languages_public_read"
  on public.languages for select
  to anon, authenticated
  using (true);

drop policy if exists "languages_authenticated_manage" on public.languages;
create policy "languages_authenticated_manage"
  on public.languages for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "translation_meta_authenticated_manage" on public.content_translation_meta;
create policy "translation_meta_authenticated_manage"
  on public.content_translation_meta for all
  to authenticated
  using (true)
  with check (true);

comment on table public.languages is
  'Catálogo dinámico de idiomas públicos y administrativos.';

comment on table public.content_translation_meta is
  'Estado y procedencia de cada traducción de site_content.';

comment on column public.site_content.language is
  'Código de languages.code para textos; global para configuración no traducible.';
