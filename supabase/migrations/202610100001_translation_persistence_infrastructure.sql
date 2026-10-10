-- ETAPA 2 / BLOQUE 2: infraestructura persistente de traducciones.
-- No modifica textos existentes, no publica idiomas nuevos y no crea jobs.

begin;

create extension if not exists pgcrypto with schema extensions;

-- Fail early if the diagnosed remote column types or pgcrypto placement differ.
-- The adapters below intentionally preserve jsonb arrays for pros/cons.
do $$
declare
  pros_type text;
  cons_type text;
begin
  if pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'extensions.digest(bytea,text) no está disponible';
  end if;

  select pg_catalog.format_type(a.atttypid, a.atttypmod) into pros_type
  from pg_catalog.pg_attribute a
  where a.attrelid = 'public.platform_translations'::pg_catalog.regclass
    and a.attname = 'pros' and not a.attisdropped;
  select pg_catalog.format_type(a.atttypid, a.atttypmod) into cons_type
  from pg_catalog.pg_attribute a
  where a.attrelid = 'public.platform_translations'::pg_catalog.regclass
    and a.attname = 'cons' and not a.attisdropped;

  if pros_type is distinct from 'jsonb' or cons_type is distinct from 'jsonb' then
    raise exception 'platform_translations.pros/cons deben ser jsonb (pros=%, cons=%)', pros_type, cons_type;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Estado editorial de idiomas. is_active conserva su semántica actual durante
-- la transición; publication_status todavía no es consumido por la web pública.
-- ---------------------------------------------------------------------------

alter table public.languages
  add column if not exists publication_status text not null default 'draft',
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid;

alter table public.languages
  drop constraint if exists languages_publication_status_check;
alter table public.languages
  add constraint languages_publication_status_check
  check (publication_status in ('draft', 'translating', 'review', 'ready', 'published'));

alter table public.languages
  drop constraint if exists languages_published_requires_active_check;
alter table public.languages
  add constraint languages_published_requires_active_check
  check (publication_status <> 'published' or is_active = true);

-- ES/EN/PT ya están publicados en producción. El resto permanece draft.
update public.languages
set publication_status = 'published',
    published_at = coalesce(published_at, now())
where code in ('es', 'en', 'pt')
  and is_active = true
  and publication_status <> 'published';

create index if not exists languages_publication_status_idx
  on public.languages (publication_status, sort_order)
  where is_active = true;

comment on column public.languages.publication_status is
  'Estado editorial independiente de is_active. La web seguirá usando is_active hasta el corte controlado.';

-- ---------------------------------------------------------------------------
-- Registro explícito de recursos y campos traducibles.
-- ---------------------------------------------------------------------------

create table if not exists public.translation_resource_types (
  resource_type text primary key,
  description text not null,
  adapter_key text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint translation_resource_types_key_check
    check (resource_type ~ '^[a-z][a-z0-9_]{1,62}$'),
  constraint translation_resource_types_adapter_check
    check (adapter_key ~ '^[a-z][a-z0-9_]{1,62}$')
);

create table if not exists public.translation_resource_fields (
  resource_type text not null
    references public.translation_resource_types(resource_type)
    on update cascade on delete restrict,
  field_name text not null,
  value_kind text not null default 'text',
  max_characters integer,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (resource_type, field_name),
  constraint translation_resource_fields_name_check
    check (field_name ~ '^[a-z][a-z0-9_.-]{0,126}$'),
  constraint translation_resource_fields_kind_check
    check (value_kind in ('text', 'text_array', 'rich_text')),
  constraint translation_resource_fields_length_check
    check (max_characters is null or max_characters > 0)
);

insert into public.translation_resource_types (resource_type, description, adapter_key)
values
  ('site_content', 'Contenido editorial administrado por key e idioma.', 'site_content'),
  ('platform_translation', 'Contenido traducible de plataformas.', 'platform_translation')
on conflict (resource_type) do update set
  description = excluded.description,
  adapter_key = excluded.adapter_key;

insert into public.translation_resource_fields
  (resource_type, field_name, value_kind, max_characters)
values
  ('site_content', 'value', 'rich_text', 50000),
  ('platform_translation', 'short_description', 'text', 5000),
  ('platform_translation', 'description', 'rich_text', 50000),
  ('platform_translation', 'pros', 'text_array', 20000),
  ('platform_translation', 'cons', 'text_array', 20000),
  ('platform_translation', 'seo_title', 'text', 500),
  ('platform_translation', 'seo_description', 'text', 2000)
on conflict (resource_type, field_name) do update set
  value_kind = excluded.value_kind,
  max_characters = excluded.max_characters;

-- ---------------------------------------------------------------------------
-- Estado por campo. Los valores permanecen en sus tablas funcionales.
-- ---------------------------------------------------------------------------

create table if not exists public.translation_field_state (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null,
  resource_id text not null,
  field_name text not null,
  source_language text not null references public.languages(code)
    on update cascade on delete restrict,
  target_language text not null references public.languages(code)
    on update cascade on delete restrict,
  source_hash text not null,
  translated_source_hash text,
  source_revision bigint not null default 1,
  translated_revision bigint,
  status text not null default 'missing',
  translation_method text,
  provider text,
  is_protected boolean not null default false,
  protection_reason text,
  translated_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  last_error_code text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint translation_field_state_resource_fk
    foreign key (resource_type, field_name)
    references public.translation_resource_fields(resource_type, field_name)
    on update cascade on delete restrict,
  constraint translation_field_state_identity_unique
    unique (resource_type, resource_id, field_name, target_language),
  constraint translation_field_state_languages_check
    check (source_language <> target_language),
  constraint translation_field_state_source_hash_check
    check (source_hash ~ '^[0-9a-f]{64}$'),
  constraint translation_field_state_translated_hash_check
    check (translated_source_hash is null or translated_source_hash ~ '^[0-9a-f]{64}$'),
  constraint translation_field_state_revision_check
    check (source_revision > 0 and (translated_revision is null or translated_revision > 0)),
  constraint translation_field_state_status_check
    check (status in ('missing', 'queued', 'machine_translated', 'imported_unreviewed', 'reviewed', 'stale', 'error')),
  constraint translation_field_state_method_check
    check (translation_method is null or translation_method in ('manual', 'libretranslate', 'openai', 'imported')),
  constraint translation_field_state_protection_check
    check (protection_reason is null or protection_reason in ('manual', 'reviewed', 'imported')),
  constraint translation_field_state_review_check
    check (status <> 'reviewed' or reviewed_at is not null),
  constraint translation_field_state_lock_reason_check
    check (is_protected = false or protection_reason is not null)
);

create index if not exists translation_field_state_resource_idx
  on public.translation_field_state (resource_type, resource_id);
create index if not exists translation_field_state_language_status_idx
  on public.translation_field_state (target_language, status);
create index if not exists translation_field_state_pending_idx
  on public.translation_field_state (target_language, updated_at)
  where status in ('missing', 'stale', 'error');

-- ---------------------------------------------------------------------------
-- Cola persistente. No se insertan jobs durante esta migración.
-- ---------------------------------------------------------------------------

create table if not exists public.translation_jobs (
  id uuid primary key default gen_random_uuid(),
  logical_key text not null,
  generation integer not null default 1,
  idempotency_key text not null unique,
  resource_type text not null,
  resource_id text not null,
  field_name text not null,
  source_language text not null references public.languages(code)
    on update cascade on delete restrict,
  target_language text not null references public.languages(code)
    on update cascade on delete restrict,
  source_hash text not null,
  source_revision bigint not null,
  status text not null default 'queued',
  requested_provider text,
  provider_used text,
  priority smallint not null default 50,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  lease_expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  last_error text,
  input_characters integer,
  output_characters integer,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric(14,6),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint translation_jobs_resource_fk
    foreign key (resource_type, field_name)
    references public.translation_resource_fields(resource_type, field_name)
    on update cascade on delete restrict,
  constraint translation_jobs_generation_check check (generation > 0),
  constraint translation_jobs_key_check
    check (logical_key ~ '^[0-9a-f]{64}$' and idempotency_key ~ '^[0-9a-f]{64}$'),
  constraint translation_jobs_languages_check check (source_language <> target_language),
  constraint translation_jobs_hash_check check (source_hash ~ '^[0-9a-f]{64}$'),
  constraint translation_jobs_revision_check check (source_revision > 0),
  constraint translation_jobs_status_check
    check (status in ('queued', 'running', 'retry_wait', 'succeeded', 'failed', 'cancelled')),
  constraint translation_jobs_priority_check check (priority between 0 and 100),
  constraint translation_jobs_attempts_check
    check (attempt_count >= 0 and max_attempts between 1 and 20 and attempt_count <= max_attempts),
  constraint translation_jobs_usage_check
    check (coalesce(input_characters,0) >= 0 and coalesce(output_characters,0) >= 0
      and coalesce(input_tokens,0) >= 0 and coalesce(output_tokens,0) >= 0
      and coalesce(estimated_cost_usd,0) >= 0),
  unique (logical_key, generation)
);

create unique index if not exists translation_jobs_one_active_identity_idx
  on public.translation_jobs (
    resource_type, resource_id, field_name, target_language, source_hash, source_revision
  )
  where status in ('queued', 'running', 'retry_wait');
create index if not exists translation_jobs_queue_idx
  on public.translation_jobs (priority desc, next_attempt_at, created_at)
  where status in ('queued', 'retry_wait');
create index if not exists translation_jobs_lease_idx
  on public.translation_jobs (lease_expires_at)
  where status = 'running';

-- ---------------------------------------------------------------------------
-- Helpers internos: validación, lectura, hash y escritura mediante adaptadores
-- explícitos. No existe SQL dinámico controlado por el cliente.
-- ---------------------------------------------------------------------------

create or replace function public.translation_hash(p_value jsonb)
returns text
language sql immutable strict
set search_path = pg_catalog, public, extensions
as $$
  select pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_value::text, 'UTF8'), 'sha256'),
    'hex'
  )
$$;

create or replace function public.translation_value_present(p_value jsonb)
returns boolean
language sql immutable
set search_path = pg_catalog, public
as $$
  select case
    when p_value is null or p_value = 'null'::jsonb then false
    when jsonb_typeof(p_value) = 'string' then pg_catalog.btrim(p_value #>> '{}') <> ''
    when jsonb_typeof(p_value) = 'array' then jsonb_array_length(p_value) > 0
    else true
  end
$$;

create or replace function public.translation_assert_field(p_resource_type text, p_field_name text)
returns void
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1
    from public.translation_resource_types rt
    join public.translation_resource_fields rf using (resource_type)
    where rt.resource_type = p_resource_type and rt.enabled
      and rf.field_name = p_field_name and rf.enabled
  ) then
    raise exception 'Recurso o campo traducible no permitido' using errcode = '22023';
  end if;
end
$$;

create or replace function public.translation_assert_admin_permission(p_resource_type text)
returns void
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare required_permission text;
begin
  required_permission := case p_resource_type
    when 'site_content' then 'content.update'
    when 'platform_translation' then 'platforms.update'
    else null
  end;

  if required_permission is null then
    raise exception 'Resource type no autorizado' using errcode = '22023';
  end if;
  if public.has_admin_permission(required_permission) is not true then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
end
$$;

create or replace function public.translation_read_value(
  p_resource_type text, p_resource_id text, p_field_name text, p_language text
)
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare value jsonb;
begin
  perform public.translation_assert_field(p_resource_type, p_field_name);
  if p_language = 'global' then raise exception 'global no es un idioma traducible' using errcode = '22023'; end if;

  if p_resource_type = 'site_content' and p_field_name = 'value' then
    select to_jsonb(sc.value) into value
    from public.site_content sc
    where sc.key = p_resource_id and sc.language = p_language and sc.type <> 'config';
  elsif p_resource_type = 'platform_translation' then
    select case p_field_name
      when 'short_description' then to_jsonb(pt.short_description)
      when 'description' then to_jsonb(pt.description)
      when 'pros' then to_jsonb(pt.pros)
      when 'cons' then to_jsonb(pt.cons)
      when 'seo_title' then to_jsonb(pt.seo_title)
      when 'seo_description' then to_jsonb(pt.seo_description)
    end into value
    from public.platform_translations pt
    where pt.platform_id::text = p_resource_id and pt.language = p_language;
  else
    raise exception 'Adaptador de traducción no implementado' using errcode = '0A000';
  end if;
  return value;
end
$$;

create or replace function public.translation_write_value(
  p_resource_type text, p_resource_id text, p_field_name text,
  p_language text, p_value jsonb, p_actor uuid
)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare source_type text;
begin
  perform public.translation_assert_field(p_resource_type, p_field_name);
  if p_language = 'global' then raise exception 'global no es un idioma traducible' using errcode = '22023'; end if;
  if not public.translation_value_present(p_value) then raise exception 'La traducción no puede estar vacía' using errcode = '22023'; end if;

  if p_resource_type = 'site_content' and p_field_name = 'value' then
    if jsonb_typeof(p_value) <> 'string' then
      raise exception 'El campo value requiere una cadena JSONB' using errcode = '22023';
    end if;
    select sc.type into source_type from public.site_content sc
    join public.languages l on l.code = sc.language and l.is_default
    where sc.key = p_resource_id and sc.type <> 'config' limit 1;
    if source_type is null then raise exception 'Contenido fuente no encontrado' using errcode = 'P0002'; end if;
    insert into public.site_content (key, language, value, type, updated_by, updated_at)
    values (p_resource_id, p_language, p_value #>> '{}', source_type, p_actor, now())
    on conflict (key, language) do update set
      value = excluded.value, type = excluded.type,
      updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  elsif p_resource_type = 'platform_translation' then
    if p_field_name in ('short_description','description','seo_title','seo_description') then
      if jsonb_typeof(p_value) <> 'string' then
        raise exception 'El campo % requiere una cadena JSONB', p_field_name using errcode = '22023';
      end if;
    elsif p_field_name in ('pros', 'cons') then
      if jsonb_typeof(p_value) <> 'array' then raise exception 'El campo requiere un array' using errcode = '22023'; end if;
      if exists (
        select 1 from jsonb_array_elements(p_value) as elements(element)
        where jsonb_typeof(element) <> 'string'
      ) then
        raise exception 'El array solo puede contener cadenas' using errcode = '22023';
      end if;
    end if;
    -- Un único UPSERT evita disparar triggers sobre una fila intermedia vacía.
    insert into public.platform_translations (
      platform_id, language, short_description, description, pros, cons,
      seo_title, seo_description
    ) values (
      p_resource_id::uuid,
      p_language,
      case when p_field_name = 'short_description' then p_value #>> '{}' end,
      case when p_field_name = 'description' then p_value #>> '{}' end,
      case when p_field_name = 'pros' then p_value end,
      case when p_field_name = 'cons' then p_value end,
      case when p_field_name = 'seo_title' then p_value #>> '{}' end,
      case when p_field_name = 'seo_description' then p_value #>> '{}' end
    )
    on conflict (platform_id, language) do update set
      short_description = case when p_field_name = 'short_description'
        then excluded.short_description else platform_translations.short_description end,
      description = case when p_field_name = 'description'
        then excluded.description else platform_translations.description end,
      pros = case when p_field_name = 'pros'
        then excluded.pros else platform_translations.pros end,
      cons = case when p_field_name = 'cons'
        then excluded.cons else platform_translations.cons end,
      seo_title = case when p_field_name = 'seo_title'
        then excluded.seo_title else platform_translations.seo_title end,
      seo_description = case when p_field_name = 'seo_description'
        then excluded.seo_description else platform_translations.seo_description end;
  else
    raise exception 'Adaptador de traducción no implementado' using errcode = '0A000';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Registro de cambios e idempotencia.
-- ---------------------------------------------------------------------------

create or replace function public.translation_invalidate_source_internal(
  p_resource_type text, p_resource_id text, p_field_name text,
  p_source_language text, p_reason text default 'source_unavailable'
)
returns integer
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare affected integer;
begin
  update public.translation_field_state
  set status = 'error',
      last_error_code = pg_catalog.left(coalesce(p_reason, 'source_unavailable'), 100),
      last_error = 'La fuente fue eliminada, quedó vacía o dejó de ser traducible.',
      updated_at = now()
  where resource_type = p_resource_type and resource_id = p_resource_id
    and field_name = p_field_name and source_language = p_source_language;
  get diagnostics affected = row_count;

  update public.translation_jobs
  set status = 'cancelled', completed_at = now(), updated_at = now(),
      error_code = pg_catalog.left(coalesce(p_reason, 'source_unavailable'), 100),
      last_error = 'La fuente fue eliminada, quedó vacía o dejó de ser traducible.',
      locked_at = null, locked_by = null, lease_expires_at = null
  where resource_type = p_resource_type and resource_id = p_resource_id
    and field_name = p_field_name and source_language = p_source_language
    and status in ('queued', 'running', 'retry_wait');
  return affected;
end
$$;

create or replace function public.translation_register_source_change_internal(
  p_resource_type text, p_resource_id text, p_field_name text, p_source_language text
)
returns integer
language plpgsql security definer
set search_path = pg_catalog, public, extensions
as $$
declare source_value jsonb; target_value jsonb; new_hash text; target record; affected integer := 0;
begin
  if p_source_language = 'global' then return 0; end if;
  if not exists (
    select 1 from public.languages
    where code = p_source_language and is_default and is_active
  ) then
    raise exception 'El idioma fuente debe ser el idioma base activo' using errcode = '22023';
  end if;
  perform public.translation_assert_field(p_resource_type, p_field_name);
  source_value := public.translation_read_value(p_resource_type, p_resource_id, p_field_name, p_source_language);
  if not public.translation_value_present(source_value) then
    return public.translation_invalidate_source_internal(
      p_resource_type, p_resource_id, p_field_name, p_source_language, 'source_unavailable'
    );
  end if;
  new_hash := public.translation_hash(source_value);

  for target in select code from public.languages where is_active and code <> p_source_language loop
    target_value := public.translation_read_value(p_resource_type, p_resource_id, p_field_name, target.code);
    insert into public.translation_field_state (
      resource_type, resource_id, field_name, source_language, target_language,
      source_hash, translated_source_hash, source_revision, translated_revision,
      status, translation_method, is_protected, protection_reason, updated_at
    ) values (
      p_resource_type, p_resource_id, p_field_name, p_source_language, target.code,
      new_hash, case when public.translation_value_present(target_value) then new_hash end,
      1, case when public.translation_value_present(target_value) then 1 end,
      case when public.translation_value_present(target_value) then 'imported_unreviewed' else 'missing' end,
      case when public.translation_value_present(target_value) then 'imported' end,
      public.translation_value_present(target_value),
      case when public.translation_value_present(target_value) then 'imported' end,
      now()
    )
    on conflict (resource_type, resource_id, field_name, target_language) do update set
      source_language = excluded.source_language,
      source_hash = excluded.source_hash,
      source_revision = case
        when translation_field_state.source_hash <> excluded.source_hash
        then translation_field_state.source_revision + 1
        else translation_field_state.source_revision
      end,
      status = case
        when translation_field_state.source_hash = excluded.source_hash then translation_field_state.status
        when public.translation_value_present(target_value) then 'stale'
        else 'missing'
      end,
      last_error_code = null, last_error = null, updated_at = now();

    update public.translation_jobs
    set status = 'cancelled', completed_at = now(), updated_at = now(),
        error_code = 'source_changed', last_error = 'La fuente cambió antes de completar el trabajo.',
        locked_at = null, locked_by = null, lease_expires_at = null
    where resource_type = p_resource_type and resource_id = p_resource_id
      and field_name = p_field_name and target_language = target.code
      and source_hash <> new_hash and status in ('queued', 'running', 'retry_wait');
    affected := affected + 1;
  end loop;
  return affected;
end
$$;

create or replace function public.translation_register_source_change(
  p_resource_type text, p_resource_id text, p_field_name text, p_source_language text
)
returns integer
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.translation_assert_admin_permission(p_resource_type);
  return public.translation_register_source_change_internal(p_resource_type, p_resource_id, p_field_name, p_source_language);
end
$$;

create or replace function public.translation_enqueue_internal(
  p_resource_type text, p_resource_id text, p_field_name text,
  p_target_language text, p_provider text, p_force boolean, p_actor uuid
)
returns uuid
language plpgsql security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  state_row public.translation_field_state%rowtype;
  active_job public.translation_jobs%rowtype;
  current_source jsonb;
  existing_id uuid;
  next_generation integer;
  logical text;
  job_id uuid;
begin
  select * into state_row from public.translation_field_state
  where resource_type = p_resource_type and resource_id = p_resource_id
    and field_name = p_field_name and target_language = p_target_language
  for update;
  if not found then raise exception 'Estado de traducción no encontrado' using errcode = 'P0002'; end if;
  if state_row.is_protected then raise exception 'La traducción está protegida y no puede regenerarse' using errcode = '42501'; end if;

  current_source := public.translation_read_value(
    p_resource_type, p_resource_id, p_field_name, state_row.source_language
  );
  if not public.translation_value_present(current_source)
    or public.translation_hash(current_source) <> state_row.source_hash then
    perform public.translation_invalidate_source_internal(
      p_resource_type, p_resource_id, p_field_name, state_row.source_language,
      'source_state_mismatch'
    );
    -- No lanzar excepción: PostgreSQL revertiría también la invalidación.
    return null;
  end if;

  logical := public.translation_hash(to_jsonb(concat_ws('|', p_resource_type, p_resource_id, p_field_name,
    state_row.source_language, p_target_language, state_row.source_hash,
    state_row.source_revision::text)));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(logical, 0));

  select * into active_job from public.translation_jobs
  where resource_type = p_resource_type and resource_id = p_resource_id
    and field_name = p_field_name and target_language = p_target_language
    and source_hash = state_row.source_hash
    and source_revision = state_row.source_revision
    and status in ('queued', 'running', 'retry_wait')
  order by generation desc limit 1 for update;

  if found then
    if not p_force
      or (active_job.status = 'running' and active_job.lease_expires_at > now()) then
      -- A live worker is never superseded. Forced requests reuse that job.
      return active_job.id;
    end if;

    update public.translation_jobs
    set status = 'cancelled', completed_at = now(), updated_at = now(),
        error_code = case when active_job.status = 'running'
          then 'superseded_expired_lease' else 'superseded_by_forced_regeneration' end,
        last_error = 'El trabajo fue reemplazado transaccionalmente por una regeneración forzada.',
        locked_at = null, locked_by = null, lease_expires_at = null
    where id = active_job.id;
  elsif not p_force then
    select id into existing_id from public.translation_jobs
    where logical_key = logical and source_hash = state_row.source_hash
      and source_revision = state_row.source_revision
    order by generation desc limit 1;
    if existing_id is not null then return existing_id; end if;
  end if;

  select coalesce(max(generation), 0) + 1 into next_generation
  from public.translation_jobs where logical_key = logical;
  job_id := gen_random_uuid();
  insert into public.translation_jobs (
    id, logical_key, generation, idempotency_key, resource_type, resource_id,
    field_name, source_language, target_language, source_hash, source_revision,
    requested_provider, created_by
  ) values (
    job_id, logical, next_generation,
    public.translation_hash(to_jsonb(logical || ':' || next_generation::text)),
    p_resource_type, p_resource_id, p_field_name, state_row.source_language,
    p_target_language, state_row.source_hash, state_row.source_revision,
    nullif(pg_catalog.btrim(p_provider), ''), p_actor
  );
  update public.translation_field_state set status = 'queued', updated_at = now()
  where id = state_row.id;
  return job_id;
end
$$;

create or replace function public.translation_request_regeneration(
  p_resource_type text, p_resource_id text, p_field_name text,
  p_target_language text, p_provider text default null, p_force boolean default false
)
returns uuid
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.translation_assert_admin_permission(p_resource_type);
  return public.translation_enqueue_internal(p_resource_type, p_resource_id, p_field_name,
    p_target_language, p_provider, p_force, auth.uid());
end
$$;

-- ---------------------------------------------------------------------------
-- Worker: claim con SKIP LOCKED, leases, recuperación, completar y retry.
-- ---------------------------------------------------------------------------

create or replace function public.translation_claim_jobs(
  p_worker_id text, p_limit integer default 10, p_lease_seconds integer default 300,
  p_provider text default null
)
returns setof public.translation_jobs
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if pg_catalog.btrim(coalesce(p_worker_id, '')) = '' then raise exception 'worker_id obligatorio' using errcode = '22023'; end if;
  if p_limit not between 1 and 100 or p_lease_seconds not between 30 and 3600 then raise exception 'Límites inválidos' using errcode = '22023'; end if;
  return query
  with candidates as (
    select j.id from public.translation_jobs j
    where j.status in ('queued', 'retry_wait') and j.next_attempt_at <= now()
      and j.attempt_count < j.max_attempts
      and (p_provider is null or j.requested_provider is null or j.requested_provider = p_provider)
    order by j.priority desc, j.next_attempt_at, j.created_at
    for update skip locked limit p_limit
  )
  update public.translation_jobs j set
    status = 'running', attempt_count = j.attempt_count + 1,
    locked_at = now(), locked_by = p_worker_id,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    started_at = coalesce(j.started_at, now()), updated_at = now()
  from candidates c where j.id = c.id returning j.*;
end
$$;

create or replace function public.translation_recover_expired_leases(p_limit integer default 100)
returns integer
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare affected integer;
begin
  if p_limit not between 1 and 1000 then raise exception 'Límite inválido' using errcode = '22023'; end if;
  with expired as (
    select id from public.translation_jobs
    where status = 'running' and lease_expires_at < now()
    order by lease_expires_at for update skip locked limit p_limit
  )
  update public.translation_jobs j set
    status = case when j.attempt_count < j.max_attempts then 'retry_wait' else 'failed' end,
    next_attempt_at = case when j.attempt_count < j.max_attempts
      then now() + make_interval(secs => least(3600, 30 * (2 ^ greatest(j.attempt_count - 1, 0))::integer))
      else j.next_attempt_at end,
    error_code = 'lease_expired', last_error = 'El worker no completó el trabajo dentro del lease.',
    completed_at = case when j.attempt_count >= j.max_attempts then now() else null end,
    locked_at = null, locked_by = null, lease_expires_at = null, updated_at = now()
  from expired e where j.id = e.id;
  get diagnostics affected = row_count;
  return affected;
end
$$;

create or replace function public.translation_complete_job(
  p_job_id uuid, p_worker_id text, p_translated_value jsonb,
  p_provider text, p_usage jsonb default '{}'::jsonb
)
returns text
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  job public.translation_jobs%rowtype;
  state_row public.translation_field_state%rowtype;
  current_source jsonb;
  state_exists boolean;
begin
  select * into job from public.translation_jobs where id = p_job_id;
  if not found then raise exception 'Job no encontrado' using errcode = 'P0002'; end if;
  select * into state_row from public.translation_field_state
  where resource_type = job.resource_type and resource_id = job.resource_id
    and field_name = job.field_name and target_language = job.target_language for update;
  state_exists := found;
  select * into job from public.translation_jobs where id = p_job_id for update;
  if not found then raise exception 'Job no encontrado' using errcode = 'P0002'; end if;
  if job.status <> 'running' or job.locked_by is distinct from p_worker_id
    or job.lease_expires_at is null or job.lease_expires_at <= now()
    then raise exception 'Lease inválido o vencido' using errcode = '55000'; end if;
  if not state_exists or state_row.source_hash <> job.source_hash or state_row.source_revision <> job.source_revision then
    update public.translation_jobs set status='cancelled', completed_at=now(), error_code='source_changed',
      last_error='La fuente cambió antes de aplicar el resultado.', locked_at=null, locked_by=null,
      lease_expires_at=null, updated_at=now() where id=job.id;
    return 'cancelled_source_changed';
  end if;
  current_source := public.translation_read_value(
    job.resource_type, job.resource_id, job.field_name, job.source_language
  );
  if not public.translation_value_present(current_source)
    or public.translation_hash(current_source) <> job.source_hash then
    perform public.translation_invalidate_source_internal(
      job.resource_type, job.resource_id, job.field_name, job.source_language,
      'source_state_mismatch'
    );
    return 'cancelled_source_changed';
  end if;
  if state_row.is_protected then
    update public.translation_jobs set status='cancelled', completed_at=now(), error_code='protected',
      last_error='La traducción está protegida.', locked_at=null, locked_by=null,
      lease_expires_at=null, updated_at=now() where id=job.id;
    return 'cancelled_protected';
  end if;
  perform public.translation_write_value(job.resource_type, job.resource_id, job.field_name,
    job.target_language, p_translated_value, null);
  update public.translation_field_state set
    translated_source_hash = source_hash, translated_revision = source_revision,
    status = 'machine_translated', translation_method = coalesce(nullif(p_provider,''), 'libretranslate'),
    provider = nullif(p_provider,''), translated_at = now(), reviewed_at = null,
    reviewed_by = null, last_error_code = null, last_error = null, updated_at = now()
  where id = state_row.id
    and source_hash = job.source_hash and source_revision = job.source_revision;
  update public.translation_jobs set
    status='succeeded', provider_used=nullif(p_provider,''), completed_at=now(),
    input_characters=nullif(p_usage->>'input_characters','')::integer,
    output_characters=nullif(p_usage->>'output_characters','')::integer,
    input_tokens=nullif(p_usage->>'input_tokens','')::integer,
    output_tokens=nullif(p_usage->>'output_tokens','')::integer,
    estimated_cost_usd=nullif(p_usage->>'estimated_cost_usd','')::numeric,
    locked_at=null, locked_by=null, lease_expires_at=null, updated_at=now()
  where id=job.id;
  return 'succeeded';
end
$$;

create or replace function public.translation_fail_job(
  p_job_id uuid, p_worker_id text, p_error_code text,
  p_error_message text, p_retryable boolean default true
)
returns text
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  job public.translation_jobs%rowtype;
  state_row public.translation_field_state%rowtype;
  state_exists boolean;
  next_status text;
begin
  select * into job from public.translation_jobs where id=p_job_id;
  if not found then raise exception 'Job no encontrado' using errcode='P0002'; end if;
  select * into state_row from public.translation_field_state
  where resource_type=job.resource_type and resource_id=job.resource_id
    and field_name=job.field_name and target_language=job.target_language
  for update;
  state_exists := found;
  select * into job from public.translation_jobs where id=p_job_id for update;
  if not found then raise exception 'Job no encontrado' using errcode='P0002'; end if;
  if job.status <> 'running' or job.locked_by is distinct from p_worker_id
    or job.lease_expires_at is null or job.lease_expires_at <= now()
    then raise exception 'Lease inválido o vencido' using errcode='55000'; end if;
  if not state_exists or state_row.source_hash <> job.source_hash
    or state_row.source_revision <> job.source_revision then
    update public.translation_jobs set status='cancelled', completed_at=now(),
      error_code='source_changed',
      last_error='La fuente cambió antes de registrar el fallo del proveedor.',
      locked_at=null, locked_by=null, lease_expires_at=null, updated_at=now()
    where id=job.id;
    return 'cancelled_source_changed';
  end if;
  next_status := case when p_retryable and job.attempt_count < job.max_attempts then 'retry_wait' else 'failed' end;
  update public.translation_jobs set status=next_status,
    next_attempt_at=case when next_status='retry_wait'
      then now()+make_interval(secs=>least(3600,30*(2^greatest(attempt_count-1,0))::integer)) else next_attempt_at end,
    completed_at=case when next_status='failed' then now() else null end,
    error_code=pg_catalog.left(coalesce(p_error_code,'provider_error'),100),
    last_error=pg_catalog.left(coalesce(p_error_message,'Error del proveedor'),2000),
    locked_at=null, locked_by=null, lease_expires_at=null, updated_at=now()
  where id=job.id;
  update public.translation_field_state set status=case when next_status='failed' then 'error' else status end,
    last_error_code=pg_catalog.left(coalesce(p_error_code,'provider_error'),100),
    last_error=pg_catalog.left(coalesce(p_error_message,'Error del proveedor'),2000), updated_at=now()
  where resource_type=job.resource_type and resource_id=job.resource_id
    and field_name=job.field_name and target_language=job.target_language
    and source_hash=job.source_hash and source_revision=job.source_revision;
  return next_status;
end
$$;

-- ---------------------------------------------------------------------------
-- Revisión y protección administrativas.
-- ---------------------------------------------------------------------------

create or replace function public.translation_approve(
  p_resource_type text, p_resource_id text, p_field_name text,
  p_target_language text, p_expected_source_hash text,
  p_expected_translation_hash text, p_lock boolean default true
)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  state_row public.translation_field_state%rowtype;
  source_value jsonb;
  target_value jsonb;
  actual_source_hash text;
  actual_translation_hash text;
begin
  perform public.translation_assert_admin_permission(p_resource_type);
  select * into state_row from public.translation_field_state
  where resource_type=p_resource_type and resource_id=p_resource_id
    and field_name=p_field_name and target_language=p_target_language for update;
  if not found then raise exception 'Estado no encontrado' using errcode='P0002'; end if;
  source_value := public.translation_read_value(
    p_resource_type,p_resource_id,p_field_name,state_row.source_language
  );
  target_value := public.translation_read_value(p_resource_type,p_resource_id,p_field_name,p_target_language);
  if not public.translation_value_present(source_value) then
    perform public.translation_invalidate_source_internal(
      p_resource_type,p_resource_id,p_field_name,state_row.source_language,'source_unavailable'
    );
    -- La invalidación debe persistir; una excepción revertiría este cambio.
    return;
  end if;
  if not public.translation_value_present(target_value) then raise exception 'No existe traducción para aprobar' using errcode='22023'; end if;
  actual_source_hash := public.translation_hash(source_value);
  actual_translation_hash := public.translation_hash(target_value);
  if actual_source_hash <> state_row.source_hash then
    perform public.translation_invalidate_source_internal(
      p_resource_type,p_resource_id,p_field_name,state_row.source_language,
      'source_state_mismatch'
    );
    return;
  end if;
  if p_expected_source_hash is null or p_expected_translation_hash is null
    or p_expected_source_hash <> state_row.source_hash
    or p_expected_translation_hash <> actual_translation_hash then
    raise exception 'El contenido cambió después de la revisión; vuelva a revisarlo antes de aprobar'
      using errcode='40001';
  end if;
  update public.translation_field_state set status='reviewed', translated_source_hash=source_hash,
    translated_revision=source_revision, reviewed_at=now(), reviewed_by=auth.uid(),
    is_protected=p_lock, protection_reason=case when p_lock then 'reviewed' else null end,
    last_error_code=null,last_error=null,updated_at=now() where id=state_row.id;
end
$$;

create or replace function public.translation_save_manual(
  p_resource_type text, p_resource_id text, p_field_name text,
  p_target_language text, p_value jsonb, p_lock boolean default true
)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  state_row public.translation_field_state%rowtype;
  source_value jsonb;
begin
  perform public.translation_assert_admin_permission(p_resource_type);
  select * into state_row from public.translation_field_state
  where resource_type=p_resource_type and resource_id=p_resource_id
    and field_name=p_field_name and target_language=p_target_language for update;
  if not found then raise exception 'Estado no encontrado' using errcode='P0002'; end if;
  source_value := public.translation_read_value(
    p_resource_type,p_resource_id,p_field_name,state_row.source_language
  );
  if not public.translation_value_present(source_value)
    or public.translation_hash(source_value) <> state_row.source_hash then
    perform public.translation_invalidate_source_internal(
      p_resource_type,p_resource_id,p_field_name,state_row.source_language,
      'source_state_mismatch'
    );
    -- No escribir ni lanzar: se conserva el estado de error para diagnóstico.
    return;
  end if;
  perform public.translation_write_value(p_resource_type,p_resource_id,p_field_name,
    p_target_language,p_value,auth.uid());
  update public.translation_field_state set status='reviewed', translation_method='manual',
    provider=null, translated_source_hash=source_hash, translated_revision=source_revision,
    translated_at=now(), reviewed_at=now(), reviewed_by=auth.uid(),
    is_protected=p_lock, protection_reason=case when p_lock then 'manual' else null end,
    last_error_code=null,last_error=null,updated_at=now() where id=state_row.id;
  update public.translation_jobs set status='cancelled',completed_at=now(),
    error_code='manual_override',last_error='La traducción fue reemplazada manualmente.',
    locked_at=null,locked_by=null,lease_expires_at=null,updated_at=now()
  where resource_type=p_resource_type and resource_id=p_resource_id
    and field_name=p_field_name and target_language=p_target_language
    and status in ('queued','running','retry_wait');
end
$$;

create or replace function public.translation_set_protection(
  p_resource_type text, p_resource_id text, p_field_name text,
  p_target_language text, p_protected boolean
)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.translation_assert_admin_permission(p_resource_type);
  update public.translation_field_state set is_protected=p_protected,
    protection_reason=case when p_protected then coalesce(protection_reason,'manual') else null end,
    updated_at=now()
  where resource_type=p_resource_type and resource_id=p_resource_id
    and field_name=p_field_name and target_language=p_target_language;
  if not found then raise exception 'Estado no encontrado' using errcode='P0002'; end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Inicialización: metadata únicamente. Traducciones existentes quedan
-- imported_unreviewed y protegidas; ausencias quedan missing. Cero jobs.
-- ---------------------------------------------------------------------------

do $$
declare source_language text;
begin
  select code into source_language from public.languages where is_default and is_active limit 1;
  if source_language is null then raise exception 'No existe idioma base activo'; end if;

  insert into public.translation_field_state (
    resource_type,resource_id,field_name,source_language,target_language,
    source_hash,translated_source_hash,source_revision,translated_revision,
    status,translation_method,is_protected,protection_reason
  )
  select 'site_content',s.key,'value',source_language,l.code,
    public.translation_hash(to_jsonb(s.value)),
    case when public.translation_value_present(to_jsonb(t.value)) then public.translation_hash(to_jsonb(s.value)) end,
    1,case when public.translation_value_present(to_jsonb(t.value)) then 1 end,
    case when public.translation_value_present(to_jsonb(t.value)) then 'imported_unreviewed' else 'missing' end,
    case when public.translation_value_present(to_jsonb(t.value)) then 'imported' end,
    public.translation_value_present(to_jsonb(t.value)),
    case when public.translation_value_present(to_jsonb(t.value)) then 'imported' end
  from public.site_content s
  join public.languages l on l.is_active and l.code<>source_language
  left join public.site_content t on t.key=s.key and t.language=l.code
  where s.language=source_language and s.language<>'global' and s.type<>'config'
    and public.translation_value_present(to_jsonb(s.value))
  on conflict (resource_type,resource_id,field_name,target_language) do nothing;

  insert into public.translation_field_state (
    resource_type,resource_id,field_name,source_language,target_language,
    source_hash,translated_source_hash,source_revision,translated_revision,
    status,translation_method,is_protected,protection_reason
  )
  select 'platform_translation',s.platform_id::text,f.field_name,source_language,l.code,
    public.translation_hash(v.source_value),
    case when public.translation_value_present(v.target_value) then public.translation_hash(v.source_value) end,
    1,case when public.translation_value_present(v.target_value) then 1 end,
    case when public.translation_value_present(v.target_value) then 'imported_unreviewed' else 'missing' end,
    case when public.translation_value_present(v.target_value) then 'imported' end,
    public.translation_value_present(v.target_value),
    case when public.translation_value_present(v.target_value) then 'imported' end
  from public.platform_translations s
  join public.languages base on base.code=s.language and base.is_default
  cross join public.translation_resource_fields f
  join public.languages l on l.is_active and l.code<>source_language
  left join public.platform_translations t on t.platform_id=s.platform_id and t.language=l.code
  cross join lateral (
    select case f.field_name
      when 'short_description' then to_jsonb(s.short_description)
      when 'description' then to_jsonb(s.description)
      when 'pros' then to_jsonb(s.pros)
      when 'cons' then to_jsonb(s.cons)
      when 'seo_title' then to_jsonb(s.seo_title)
      when 'seo_description' then to_jsonb(s.seo_description) end as source_value,
    case f.field_name
      when 'short_description' then to_jsonb(t.short_description)
      when 'description' then to_jsonb(t.description)
      when 'pros' then to_jsonb(t.pros)
      when 'cons' then to_jsonb(t.cons)
      when 'seo_title' then to_jsonb(t.seo_title)
      when 'seo_description' then to_jsonb(t.seo_description) end as target_value
  ) v
  where f.resource_type='platform_translation' and f.enabled
    and public.translation_value_present(v.source_value)
  on conflict (resource_type,resource_id,field_name,target_language) do nothing;
end
$$;

-- ---------------------------------------------------------------------------
-- Detección automática de cambios del idioma base. No encola jobs.
-- ---------------------------------------------------------------------------

create or replace function public.translation_registry_disable_trigger()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare disabled_field text;
begin
  if old.enabled and not new.enabled then
    if tg_table_name = 'translation_resource_fields' then
      disabled_field := old.field_name;
    end if;
    update public.translation_field_state
    set status='error', last_error_code='field_disabled',
        last_error='El recurso o campo dejó de estar habilitado para traducción.',
        updated_at=now()
    where resource_type=old.resource_type
      and (disabled_field is null or field_name=disabled_field);

    update public.translation_jobs
    set status='cancelled', completed_at=now(), updated_at=now(),
        error_code='field_disabled',
        last_error='El recurso o campo dejó de estar habilitado para traducción.',
        locked_at=null, locked_by=null, lease_expires_at=null
    where resource_type=old.resource_type
      and (disabled_field is null or field_name=disabled_field)
      and status in ('queued','running','retry_wait');
  end if;
  return new;
end
$$;

drop trigger if exists translation_resource_type_disable on public.translation_resource_types;
create trigger translation_resource_type_disable
after update of enabled on public.translation_resource_types
for each row execute function public.translation_registry_disable_trigger();

drop trigger if exists translation_resource_field_disable on public.translation_resource_fields;
create trigger translation_resource_field_disable
after update of enabled on public.translation_resource_fields
for each row execute function public.translation_registry_disable_trigger();

create or replace function public.translation_source_language_disable_trigger()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if old.is_default and old.is_active and (not new.is_default or not new.is_active) then
    update public.translation_field_state
    set status='error', last_error_code='source_language_disabled',
        last_error='El idioma fuente dejó de ser el idioma base activo.', updated_at=now()
    where source_language=old.code;

    update public.translation_jobs
    set status='cancelled', completed_at=now(), updated_at=now(),
        error_code='source_language_disabled',
        last_error='El idioma fuente dejó de ser el idioma base activo.',
        locked_at=null, locked_by=null, lease_expires_at=null
    where source_language=old.code and status in ('queued','running','retry_wait');
  end if;
  return new;
end
$$;

drop trigger if exists translation_source_language_disable on public.languages;
create trigger translation_source_language_disable
after update of is_default, is_active on public.languages
for each row execute function public.translation_source_language_disable_trigger();

create or replace function public.translation_site_content_source_insert_trigger()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if new.language <> 'global' and new.type <> 'config'
    and exists(select 1 from public.languages where code=new.language and is_default and is_active) then
    perform public.translation_register_source_change_internal('site_content',new.key,'value',new.language);
  end if;
  return new;
end
$$;

create or replace function public.translation_site_content_source_update_trigger()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  old_is_source boolean;
  new_is_source boolean;
begin
  old_is_source := old.language <> 'global' and old.type <> 'config'
    and exists(select 1 from public.languages where code=old.language and is_default and is_active);
  new_is_source := new.language <> 'global' and new.type <> 'config'
    and exists(select 1 from public.languages where code=new.language and is_default and is_active);

  if old_is_source and (not new_is_source
    or new.key is distinct from old.key or new.language is distinct from old.language) then
    perform public.translation_invalidate_source_internal(
      'site_content',old.key,'value',old.language,'source_removed_or_untranslatable'
    );
  end if;
  if new_is_source and (not old_is_source
    or new.key is distinct from old.key or new.language is distinct from old.language
    or new.type is distinct from old.type or new.value is distinct from old.value) then
    perform public.translation_register_source_change_internal('site_content',new.key,'value',new.language);
  end if;
  return new;
end
$$;

create or replace function public.translation_site_content_source_delete_trigger()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if old.language <> 'global' and old.type <> 'config'
    and exists(select 1 from public.languages where code=old.language and is_default) then
    perform public.translation_invalidate_source_internal(
      'site_content',old.key,'value',old.language,'source_deleted'
    );
  end if;
  return old;
end
$$;

drop trigger if exists translation_site_content_source_change on public.site_content;
drop trigger if exists translation_site_content_source_insert on public.site_content;
drop trigger if exists translation_site_content_source_update on public.site_content;
drop trigger if exists translation_site_content_source_delete on public.site_content;
create trigger translation_site_content_source_insert after insert on public.site_content
for each row execute function public.translation_site_content_source_insert_trigger();
create trigger translation_site_content_source_update after update on public.site_content
for each row execute function public.translation_site_content_source_update_trigger();
create trigger translation_site_content_source_delete after delete on public.site_content
for each row execute function public.translation_site_content_source_delete_trigger();

create or replace function public.translation_platform_source_insert_trigger()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare field_name text;
begin
  if exists(select 1 from public.languages where code=new.language and is_default and is_active) then
    foreach field_name in array array['short_description','description','pros','cons','seo_title','seo_description'] loop
      perform public.translation_register_source_change_internal(
        'platform_translation',new.platform_id::text,field_name,new.language
      );
    end loop;
  end if;
  return new;
end
$$;

create or replace function public.translation_platform_source_update_trigger()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  old_is_source boolean;
  new_is_source boolean;
  field_name text;
  identity_changed boolean;
begin
  old_is_source := exists(select 1 from public.languages where code=old.language and is_default and is_active);
  new_is_source := exists(select 1 from public.languages where code=new.language and is_default and is_active);
  identity_changed := new.platform_id is distinct from old.platform_id
    or new.language is distinct from old.language;

  if old_is_source and (not new_is_source or identity_changed) then
    foreach field_name in array array['short_description','description','pros','cons','seo_title','seo_description'] loop
      perform public.translation_invalidate_source_internal(
        'platform_translation',old.platform_id::text,field_name,old.language,
        'source_removed_or_untranslatable'
      );
    end loop;
  end if;

  if new_is_source then
    if not old_is_source or identity_changed or new.short_description is distinct from old.short_description then
      perform public.translation_register_source_change_internal('platform_translation',new.platform_id::text,'short_description',new.language);
    end if;
    if not old_is_source or identity_changed or new.description is distinct from old.description then
      perform public.translation_register_source_change_internal('platform_translation',new.platform_id::text,'description',new.language);
    end if;
    if not old_is_source or identity_changed or new.pros is distinct from old.pros then
      perform public.translation_register_source_change_internal('platform_translation',new.platform_id::text,'pros',new.language);
    end if;
    if not old_is_source or identity_changed or new.cons is distinct from old.cons then
      perform public.translation_register_source_change_internal('platform_translation',new.platform_id::text,'cons',new.language);
    end if;
    if not old_is_source or identity_changed or new.seo_title is distinct from old.seo_title then
      perform public.translation_register_source_change_internal('platform_translation',new.platform_id::text,'seo_title',new.language);
    end if;
    if not old_is_source or identity_changed or new.seo_description is distinct from old.seo_description then
      perform public.translation_register_source_change_internal('platform_translation',new.platform_id::text,'seo_description',new.language);
    end if;
  end if;
  return new;
end
$$;

create or replace function public.translation_platform_source_delete_trigger()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare field_name text;
begin
  if exists(select 1 from public.languages where code=old.language and is_default) then
    foreach field_name in array array['short_description','description','pros','cons','seo_title','seo_description'] loop
      perform public.translation_invalidate_source_internal(
        'platform_translation',old.platform_id::text,field_name,old.language,'source_deleted'
      );
    end loop;
  end if;
  return old;
end
$$;

drop trigger if exists translation_platform_source_change on public.platform_translations;
drop trigger if exists translation_platform_source_insert on public.platform_translations;
drop trigger if exists translation_platform_source_update on public.platform_translations;
drop trigger if exists translation_platform_source_delete on public.platform_translations;
create trigger translation_platform_source_insert after insert on public.platform_translations
for each row execute function public.translation_platform_source_insert_trigger();
create trigger translation_platform_source_update after update on public.platform_translations
for each row execute function public.translation_platform_source_update_trigger();
create trigger translation_platform_source_delete after delete on public.platform_translations
for each row execute function public.translation_platform_source_delete_trigger();

-- ---------------------------------------------------------------------------
-- RLS y grants. authenticated puede leer con content.view, pero nunca mutar
-- estados/jobs/registry directamente. Toda mutación pasa por RPC autorizada.
-- ---------------------------------------------------------------------------

alter table public.translation_resource_types enable row level security;
alter table public.translation_resource_fields enable row level security;
alter table public.translation_field_state enable row level security;
alter table public.translation_jobs enable row level security;

drop policy if exists tg_translation_resource_types_view on public.translation_resource_types;
create policy tg_translation_resource_types_view on public.translation_resource_types
for select to authenticated using (
  public.has_admin_permission('content.view') or public.has_admin_permission('platforms.view')
);
drop policy if exists tg_translation_resource_fields_view on public.translation_resource_fields;
create policy tg_translation_resource_fields_view on public.translation_resource_fields
for select to authenticated using (
  public.has_admin_permission('content.view') or public.has_admin_permission('platforms.view')
);
drop policy if exists tg_translation_field_state_view on public.translation_field_state;
create policy tg_translation_field_state_view on public.translation_field_state
for select to authenticated using (
  (resource_type='site_content' and public.has_admin_permission('content.view'))
  or (resource_type='platform_translation' and public.has_admin_permission('platforms.view'))
);
drop policy if exists tg_translation_jobs_view on public.translation_jobs;
create policy tg_translation_jobs_view on public.translation_jobs
for select to authenticated using (
  (resource_type='site_content' and public.has_admin_permission('content.view'))
  or (resource_type='platform_translation' and public.has_admin_permission('platforms.view'))
);

revoke all on public.translation_resource_types, public.translation_resource_fields,
  public.translation_field_state, public.translation_jobs from public, anon, authenticated;
grant select on public.translation_resource_types, public.translation_resource_fields,
  public.translation_field_state, public.translation_jobs to authenticated;
grant all on public.translation_resource_types, public.translation_resource_fields,
  public.translation_field_state, public.translation_jobs to service_role;

-- Helpers internos: nadie fuera del owner/service_role.
revoke all on function public.translation_hash(jsonb) from public, anon, authenticated;
revoke all on function public.translation_value_present(jsonb) from public, anon, authenticated;
revoke all on function public.translation_assert_field(text,text) from public, anon, authenticated;
revoke all on function public.translation_assert_admin_permission(text) from public, anon, authenticated;
revoke all on function public.translation_read_value(text,text,text,text) from public, anon, authenticated;
revoke all on function public.translation_write_value(text,text,text,text,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.translation_invalidate_source_internal(text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.translation_register_source_change_internal(text,text,text,text) from public, anon, authenticated;
revoke all on function public.translation_enqueue_internal(text,text,text,text,text,boolean,uuid) from public, anon, authenticated;
revoke all on function public.translation_registry_disable_trigger() from public, anon, authenticated;
revoke all on function public.translation_source_language_disable_trigger() from public, anon, authenticated;
revoke all on function public.translation_site_content_source_insert_trigger() from public, anon, authenticated;
revoke all on function public.translation_site_content_source_update_trigger() from public, anon, authenticated;
revoke all on function public.translation_site_content_source_delete_trigger() from public, anon, authenticated;
revoke all on function public.translation_platform_source_insert_trigger() from public, anon, authenticated;
revoke all on function public.translation_platform_source_update_trigger() from public, anon, authenticated;
revoke all on function public.translation_platform_source_delete_trigger() from public, anon, authenticated;

-- RPC administrativas: cada una exige content.update o platforms.update según
-- resource_type; no existe un permiso transversal implícito.
revoke all on function public.translation_register_source_change(text,text,text,text) from public, anon, authenticated;
revoke all on function public.translation_request_regeneration(text,text,text,text,text,boolean) from public, anon, authenticated;
revoke all on function public.translation_approve(text,text,text,text,text,text,boolean) from public, anon, authenticated;
revoke all on function public.translation_save_manual(text,text,text,text,jsonb,boolean) from public, anon, authenticated;
revoke all on function public.translation_set_protection(text,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.translation_register_source_change(text,text,text,text) to authenticated;
grant execute on function public.translation_request_regeneration(text,text,text,text,text,boolean) to authenticated;
grant execute on function public.translation_approve(text,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.translation_save_manual(text,text,text,text,jsonb,boolean) to authenticated;
grant execute on function public.translation_set_protection(text,text,text,text,boolean) to authenticated;

-- RPC de workers: exclusivamente service_role.
revoke all on function public.translation_claim_jobs(text,integer,integer,text) from public, anon, authenticated;
revoke all on function public.translation_recover_expired_leases(integer) from public, anon, authenticated;
revoke all on function public.translation_complete_job(uuid,text,jsonb,text,jsonb) from public, anon, authenticated;
revoke all on function public.translation_fail_job(uuid,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.translation_claim_jobs(text,integer,integer,text) to service_role;
grant execute on function public.translation_recover_expired_leases(integer) to service_role;
grant execute on function public.translation_complete_job(uuid,text,jsonb,text,jsonb) to service_role;
grant execute on function public.translation_fail_job(uuid,text,text,text,boolean) to service_role;

-- Fail closed: ninguna tabla interna acepta DML directo de authenticated y la
-- migración no puede crear trabajos automáticamente.
do $$
begin
  if exists(select 1 from public.translation_jobs) then
    raise exception 'La inicialización no debe crear translation_jobs';
  end if;
  if pg_catalog.has_table_privilege('authenticated','public.translation_field_state','INSERT')
    or pg_catalog.has_table_privilege('authenticated','public.translation_field_state','UPDATE')
    or pg_catalog.has_table_privilege('authenticated','public.translation_field_state','DELETE')
    or pg_catalog.has_table_privilege('authenticated','public.translation_jobs','INSERT')
    or pg_catalog.has_table_privilege('authenticated','public.translation_jobs','UPDATE')
    or pg_catalog.has_table_privilege('authenticated','public.translation_jobs','DELETE') then
    raise exception 'authenticated conserva DML directo sobre infraestructura de traducciones';
  end if;
  if exists(select 1 from public.translation_field_state where source_language='global' or target_language='global') then
    raise exception 'global fue incluido incorrectamente como idioma traducible';
  end if;
end
$$;

commit;
