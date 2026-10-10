-- Endurece los permisos de los catálogos de traducción sin alterar datos,
-- constraints ni las policies administrativas granulares existentes.

begin;

alter table public.languages enable row level security;
alter table public.site_content enable row level security;
alter table public.platform_translations enable row level security;

-- PUBLIC y anon no necesitan privilegios de escritura. Revocarlos también de
-- PUBLIC evita que anon los recupere por los privilegios implícitos de ese rol.
revoke insert, update, delete, truncate, references, trigger
  on table public.languages, public.site_content, public.platform_translations
  from public;

revoke insert, update, delete, truncate, references, trigger
  on table public.languages, public.site_content, public.platform_translations
  from anon;

-- La web pública ya consume site_content y platform_translations. Languages se
-- expone únicamente mediante la policy activa definida más abajo.
grant select
  on table public.languages, public.site_content, public.platform_translations
  to anon;

-- Los editores actuales escriben desde el cliente autenticado. RLS continúa
-- limitando cada operación mediante las policies tg_* y has_admin_permission().
grant select, insert, update, delete
  on table public.languages, public.site_content, public.platform_translations
  to authenticated;

-- Las lecturas server-side y procesos internos conservan acceso explícito.
grant select, insert, update, delete
  on table public.languages, public.site_content, public.platform_translations
  to service_role;

-- Reemplaza únicamente la policy pública histórica. No modifica
-- tg_languages_view, que permite a administradores con content.view consultar
-- también idiomas inactivos.
drop policy if exists languages_public_read on public.languages;

create policy languages_public_read
  on public.languages
  for select
  to anon
  using (is_active = true);

-- Validación fail-closed de los invariantes introducidos por esta migración.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'languages',
    'site_content',
    'platform_translations'
  ]
  loop
    if not pg_catalog.has_table_privilege(
      'anon',
      pg_catalog.format('public.%I', target_table),
      'SELECT'
    ) then
      raise exception 'anon perdió SELECT sobre public.%', target_table;
    end if;

    if pg_catalog.has_table_privilege('anon', pg_catalog.format('public.%I', target_table), 'INSERT')
      or pg_catalog.has_table_privilege('anon', pg_catalog.format('public.%I', target_table), 'UPDATE')
      or pg_catalog.has_table_privilege('anon', pg_catalog.format('public.%I', target_table), 'DELETE')
      or pg_catalog.has_table_privilege('anon', pg_catalog.format('public.%I', target_table), 'TRUNCATE')
      or pg_catalog.has_table_privilege('anon', pg_catalog.format('public.%I', target_table), 'REFERENCES')
      or pg_catalog.has_table_privilege('anon', pg_catalog.format('public.%I', target_table), 'TRIGGER') then
      raise exception 'anon conserva privilegios de escritura sobre public.%', target_table;
    end if;

    if not pg_catalog.has_table_privilege('authenticated', pg_catalog.format('public.%I', target_table), 'SELECT')
      or not pg_catalog.has_table_privilege('authenticated', pg_catalog.format('public.%I', target_table), 'INSERT')
      or not pg_catalog.has_table_privilege('authenticated', pg_catalog.format('public.%I', target_table), 'UPDATE')
      or not pg_catalog.has_table_privilege('authenticated', pg_catalog.format('public.%I', target_table), 'DELETE') then
      raise exception 'authenticated no conserva los privilegios requeridos sobre public.%', target_table;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'languages'
      and policyname = 'languages_public_read'
      and cmd = 'SELECT'
      and roles = array['anon']::name[]
      and pg_catalog.strpos(pg_catalog.lower(coalesce(qual, '')), 'is_active') > 0
  ) then
    raise exception 'languages_public_read no quedó limitada a anon e is_active';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'languages'
      and policyname = 'tg_languages_view'
      and cmd = 'SELECT'
      and roles && array['authenticated']::name[]
      and pg_catalog.strpos(pg_catalog.lower(coalesce(qual, '')), 'has_admin_permission') > 0
  ) then
    raise exception 'La policy administrativa tg_languages_view no existe o cambió inesperadamente';
  end if;
end
$$;

commit;
