-- ETAPA 2 / BLOQUE 3B: una identidad comercial por offer y textos por idioma.
-- No crea jobs, no altera condiciones comerciales y no sobrescribe traducciones.
begin;

create table if not exists public.offer_translations (
  offer_id uuid not null references public.offers(id) on delete cascade,
  language text not null references public.languages(code) on update cascade on delete restrict,
  title text,
  description text,
  free_account_label text,
  hot_badge text,
  short_highlight text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (offer_id, language),
  constraint offer_translations_title_check check (title is null or btrim(title) <> ''),
  constraint offer_translations_description_check check (description is null or btrim(description) <> ''),
  constraint offer_translations_free_account_label_check check (free_account_label is null or btrim(free_account_label) <> ''),
  constraint offer_translations_hot_badge_check check (hot_badge is null or btrim(hot_badge) <> ''),
  constraint offer_translations_short_highlight_check check (short_highlight is null or btrim(short_highlight) <> '')
);

comment on table public.offer_translations is
  'Textos localizados de una oferta. offers.id conserva la identidad y las condiciones comerciales.';

insert into public.translation_resource_types (resource_type, description, adapter_key)
values ('offer_translation', 'Textos traducibles de ofertas sin duplicar la promoción.', 'offer_translation')
on conflict (resource_type) do update set description=excluded.description, adapter_key=excluded.adapter_key;

insert into public.translation_resource_fields (resource_type,field_name,value_kind,max_characters)
values
 ('offer_translation','title','text',500),
 ('offer_translation','description','rich_text',10000),
 ('offer_translation','free_account_label','text',500),
 ('offer_translation','hot_badge','text',200),
 ('offer_translation','short_highlight','text',1000)
on conflict (resource_type,field_name) do update set value_kind=excluded.value_kind,max_characters=excluded.max_characters;

create or replace function public.translation_assert_admin_permission(p_resource_type text)
returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare required_permission text;
begin
  required_permission := case p_resource_type
    when 'site_content' then 'content.update'
    when 'platform_translation' then 'platforms.update'
    when 'offer_translation' then 'offers.update'
  end;
  if required_permission is null then raise exception 'Resource type no autorizado' using errcode='22023'; end if;
  if public.has_admin_permission(required_permission) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
end $$;

create or replace function public.translation_read_value(p_resource_type text,p_resource_id text,p_field_name text,p_language text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare value jsonb; source_language text;
begin
  perform public.translation_assert_field(p_resource_type,p_field_name);
  if p_language='global' then raise exception 'global no es un idioma traducible' using errcode='22023'; end if;
  if p_resource_type='site_content' and p_field_name='value' then
    select to_jsonb(sc.value) into value from public.site_content sc where sc.key=p_resource_id and sc.language=p_language and sc.type<>'config';
  elsif p_resource_type='platform_translation' then
    select case p_field_name when 'short_description' then to_jsonb(short_description) when 'description' then to_jsonb(description)
      when 'pros' then to_jsonb(pros) when 'cons' then to_jsonb(cons) when 'seo_title' then to_jsonb(seo_title)
      when 'seo_description' then to_jsonb(seo_description) end into value
    from public.platform_translations where platform_id::text=p_resource_id and language=p_language;
  elsif p_resource_type='offer_translation' then
    select coalesce(
      (select l.code from public.languages l where l.code=o.language and l.is_active),
      (select l.code from public.languages l where l.is_default and l.is_active order by l.sort_order,l.code limit 1)
    ) into source_language from public.offers o where o.id::text=p_resource_id;
    if source_language is null then return null; end if;
    if source_language=p_language then
      select case p_field_name when 'title' then to_jsonb(title) when 'description' then to_jsonb(description)
        when 'free_account_label' then to_jsonb(free_account_label) when 'hot_badge' then to_jsonb(hot_badge)
        when 'short_highlight' then to_jsonb(short_highlight) end into value from public.offers where id::text=p_resource_id;
    else
      select case p_field_name when 'title' then to_jsonb(title) when 'description' then to_jsonb(description)
        when 'free_account_label' then to_jsonb(free_account_label) when 'hot_badge' then to_jsonb(hot_badge)
        when 'short_highlight' then to_jsonb(short_highlight) end into value from public.offer_translations
      where offer_id::text=p_resource_id and language=p_language;
    end if;
  else raise exception 'Adaptador de traducción no implementado' using errcode='0A000';
  end if;
  return value;
end $$;

create or replace function public.translation_write_value(p_resource_type text,p_resource_id text,p_field_name text,p_language text,p_value jsonb,p_actor uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare source_type text; source_language text;
begin
  perform public.translation_assert_field(p_resource_type,p_field_name);
  if p_language='global' or not public.translation_value_present(p_value) then
    raise exception 'La traducción no puede estar vacía' using errcode='22023';
  end if;
  if p_resource_type='site_content' and p_field_name='value' then
    if jsonb_typeof(p_value)<>'string' then raise exception 'value requiere una cadena JSONB' using errcode='22023'; end if;
    select sc.type into source_type from public.site_content sc join public.languages l on l.code=sc.language and l.is_default
      where sc.key=p_resource_id and sc.type<>'config' limit 1;
    if source_type is null then raise exception 'Contenido fuente no encontrado' using errcode='P0002'; end if;
    insert into public.site_content(key,language,value,type,updated_by,updated_at)
    values(p_resource_id,p_language,p_value#>>'{}',source_type,p_actor,now())
    on conflict(key,language) do update set value=excluded.value,type=excluded.type,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  elsif p_resource_type='platform_translation' then
    if p_field_name in ('short_description','description','seo_title','seo_description') and jsonb_typeof(p_value)<>'string' then
      raise exception 'El campo % requiere una cadena JSONB',p_field_name using errcode='22023';
    end if;
    if p_field_name in ('pros','cons') then
      if jsonb_typeof(p_value)<>'array' then raise exception 'El campo % requiere un array JSONB',p_field_name using errcode='22023'; end if;
      if exists(select 1 from jsonb_array_elements(p_value) as elements(element) where jsonb_typeof(element)<>'string') then
        raise exception 'El campo % requiere exclusivamente cadenas',p_field_name using errcode='22023';
      end if;
    end if;
    insert into public.platform_translations(platform_id,language,short_description,description,pros,cons,seo_title,seo_description)
    values(p_resource_id::uuid,p_language,case when p_field_name='short_description' then p_value#>>'{}' end,
      case when p_field_name='description' then p_value#>>'{}' end,case when p_field_name='pros' then p_value end,
      case when p_field_name='cons' then p_value end,case when p_field_name='seo_title' then p_value#>>'{}' end,
      case when p_field_name='seo_description' then p_value#>>'{}' end)
    on conflict(platform_id,language) do update set
      short_description=case when p_field_name='short_description' then excluded.short_description else platform_translations.short_description end,
      description=case when p_field_name='description' then excluded.description else platform_translations.description end,
      pros=case when p_field_name='pros' then excluded.pros else platform_translations.pros end,
      cons=case when p_field_name='cons' then excluded.cons else platform_translations.cons end,
      seo_title=case when p_field_name='seo_title' then excluded.seo_title else platform_translations.seo_title end,
      seo_description=case when p_field_name='seo_description' then excluded.seo_description else platform_translations.seo_description end;
  elsif p_resource_type='offer_translation' then
    if jsonb_typeof(p_value)<>'string' then raise exception 'El campo % requiere una cadena JSONB',p_field_name using errcode='22023'; end if;
    select coalesce(
      (select l.code from public.languages l where l.code=o.language and l.is_active),
      (select l.code from public.languages l where l.is_default and l.is_active order by l.sort_order,l.code limit 1)
    ) into source_language from public.offers o where o.id::text=p_resource_id;
    if source_language is null then raise exception 'Oferta fuente no encontrada' using errcode='P0002'; end if;
    if source_language=p_language then raise exception 'No se puede escribir el idioma fuente mediante traducciones' using errcode='22023'; end if;
    insert into public.offer_translations(offer_id,language,title,description,free_account_label,hot_badge,short_highlight,updated_at)
    values(p_resource_id::uuid,p_language,case when p_field_name='title' then p_value#>>'{}' end,
      case when p_field_name='description' then p_value#>>'{}' end,case when p_field_name='free_account_label' then p_value#>>'{}' end,
      case when p_field_name='hot_badge' then p_value#>>'{}' end,case when p_field_name='short_highlight' then p_value#>>'{}' end,now())
    on conflict(offer_id,language) do update set
      title=case when p_field_name='title' then excluded.title else offer_translations.title end,
      description=case when p_field_name='description' then excluded.description else offer_translations.description end,
      free_account_label=case when p_field_name='free_account_label' then excluded.free_account_label else offer_translations.free_account_label end,
      hot_badge=case when p_field_name='hot_badge' then excluded.hot_badge else offer_translations.hot_badge end,
      short_highlight=case when p_field_name='short_highlight' then excluded.short_highlight else offer_translations.short_highlight end,updated_at=now();
  else raise exception 'Adaptador de traducción no implementado' using errcode='0A000'; end if;
end $$;

-- Las ofertas legacy pueden tener ES, EN o PT como idioma fuente. Este adaptador
-- conserva la semántica del registro genérico del Bloque 2, pero admite cualquier
-- idioma activo como fuente sin relajar esa regla para los demás resource_type.
create or replace function public.translation_register_offer_source_change_internal(
  p_resource_id text,p_field_name text,p_source_language text
)
returns integer language plpgsql security definer
set search_path=pg_catalog,public,extensions as $$
declare source_value jsonb; target_value jsonb; new_hash text; target record; affected integer:=0;
begin
  if p_source_language='global' or not exists(
    select 1 from public.languages where code=p_source_language and is_active
  ) then
    raise exception 'El idioma fuente de la oferta debe estar activo' using errcode='22023';
  end if;
  perform public.translation_assert_field('offer_translation',p_field_name);
  source_value:=public.translation_read_value('offer_translation',p_resource_id,p_field_name,p_source_language);
  if not public.translation_value_present(source_value) then
    return public.translation_invalidate_source_internal(
      'offer_translation',p_resource_id,p_field_name,p_source_language,'source_unavailable'
    );
  end if;
  new_hash:=public.translation_hash(source_value);

  delete from public.translation_field_state
  where resource_type='offer_translation' and resource_id=p_resource_id
    and field_name=p_field_name and target_language=p_source_language;
  update public.translation_jobs set
    status='cancelled',completed_at=now(),updated_at=now(),error_code='language_became_source',
    last_error='El idioma destino pasó a ser el idioma fuente.',
    locked_at=null,locked_by=null,lease_expires_at=null
  where resource_type='offer_translation' and resource_id=p_resource_id
    and field_name=p_field_name and target_language=p_source_language
    and status in ('queued','running','retry_wait');

  for target in select code from public.languages where is_active and code<>p_source_language loop
    target_value:=public.translation_read_value('offer_translation',p_resource_id,p_field_name,target.code);
    insert into public.translation_field_state(
      resource_type,resource_id,field_name,source_language,target_language,
      source_hash,translated_source_hash,source_revision,translated_revision,
      status,translation_method,is_protected,protection_reason,updated_at
    ) values(
      'offer_translation',p_resource_id,p_field_name,p_source_language,target.code,
      new_hash,case when public.translation_value_present(target_value) then new_hash end,
      1,case when public.translation_value_present(target_value) then 1 end,
      case when public.translation_value_present(target_value) then 'imported_unreviewed' else 'missing' end,
      case when public.translation_value_present(target_value) then 'imported' end,
      public.translation_value_present(target_value),
      case when public.translation_value_present(target_value) then 'imported' end,now()
    )
    on conflict(resource_type,resource_id,field_name,target_language) do update set
      source_language=excluded.source_language,
      source_hash=excluded.source_hash,
      source_revision=case
        when translation_field_state.source_hash<>excluded.source_hash
        then translation_field_state.source_revision+1
        else translation_field_state.source_revision end,
      status=case
        when translation_field_state.source_hash=excluded.source_hash then translation_field_state.status
        when public.translation_value_present(target_value) then 'stale'
        else 'missing' end,
      last_error_code=null,last_error=null,updated_at=now();

    update public.translation_jobs set
      status='cancelled',completed_at=now(),updated_at=now(),error_code='source_changed',
      last_error='La fuente cambió antes de completar el trabajo.',
      locked_at=null,locked_by=null,lease_expires_at=null
    where resource_type='offer_translation' and resource_id=p_resource_id
      and field_name=p_field_name and target_language=target.code
      and source_hash<>new_hash and status in ('queued','running','retry_wait');
    affected:=affected+1;
  end loop;
  return affected;
end $$;

-- Detecta cambios únicamente en la fila comercial fuente; nunca en traducciones.
create or replace function public.translation_offer_source_insert_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare f text; source_language text;
begin
  select coalesce(
    (select code from public.languages where code=new.language and is_active),
    (select code from public.languages where is_default and is_active order by sort_order,code limit 1)
  ) into source_language;
  foreach f in array array['title','description','free_account_label','hot_badge','short_highlight'] loop
    perform public.translation_register_offer_source_change_internal(new.id::text,f,source_language);
  end loop;
  return new;
end $$;

create or replace function public.translation_offer_source_update_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare f text; source_language text; old_source text; identity_changed boolean;
begin
  select coalesce(
    (select code from public.languages where code=new.language and is_active),
    (select code from public.languages where is_default and is_active order by sort_order,code limit 1)
  ) into source_language;
  select coalesce(
    (select code from public.languages where code=old.language and is_active),
    (select code from public.languages where is_default and is_active order by sort_order,code limit 1)
  ) into old_source;
  identity_changed:=old.id is distinct from new.id or old_source is distinct from source_language;
  if identity_changed then
    foreach f in array array['title','description','free_account_label','hot_badge','short_highlight'] loop
      perform public.translation_invalidate_source_internal('offer_translation',old.id::text,f,old_source,'source_removed_or_untranslatable');
    end loop;
  end if;
  if identity_changed or new.title is distinct from old.title then perform public.translation_register_offer_source_change_internal(new.id::text,'title',source_language); end if;
  if identity_changed or new.description is distinct from old.description then perform public.translation_register_offer_source_change_internal(new.id::text,'description',source_language); end if;
  if identity_changed or new.free_account_label is distinct from old.free_account_label then perform public.translation_register_offer_source_change_internal(new.id::text,'free_account_label',source_language); end if;
  if identity_changed or new.hot_badge is distinct from old.hot_badge then perform public.translation_register_offer_source_change_internal(new.id::text,'hot_badge',source_language); end if;
  if identity_changed or new.short_highlight is distinct from old.short_highlight then perform public.translation_register_offer_source_change_internal(new.id::text,'short_highlight',source_language); end if;
  return new;
end $$;

create or replace function public.translation_offer_source_delete_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare f text; source_language text;
begin
  select coalesce(
    (select code from public.languages where code=old.language and is_active),
    (select code from public.languages where is_default and is_active order by sort_order,code limit 1)
  ) into source_language;
  foreach f in array array['title','description','free_account_label','hot_badge','short_highlight'] loop
    perform public.translation_invalidate_source_internal('offer_translation',old.id::text,f,source_language,'source_deleted');
  end loop;
  return old;
end $$;

drop trigger if exists translation_offer_source_change on public.offers;
drop trigger if exists translation_offer_source_insert on public.offers;
drop trigger if exists translation_offer_source_update on public.offers;
drop trigger if exists translation_offer_source_delete on public.offers;
create trigger translation_offer_source_insert after insert on public.offers for each row execute function public.translation_offer_source_insert_trigger();
create trigger translation_offer_source_update after update on public.offers for each row execute function public.translation_offer_source_update_trigger();
create trigger translation_offer_source_delete after delete on public.offers for each row execute function public.translation_offer_source_delete_trigger();

-- Inicializa metadata de ofertas existentes; no crea texto ni jobs.
do $$ declare o record; f text; source_language text; begin
  for o in select * from public.offers loop
    select coalesce(
      (select code from public.languages where code=o.language and is_active),
      (select code from public.languages where is_default and is_active order by sort_order,code limit 1)
    ) into source_language;
    foreach f in array array['title','description','free_account_label','hot_badge','short_highlight'] loop
      perform public.translation_register_offer_source_change_internal(o.id::text,f,source_language);
    end loop;
  end loop;
end $$;

alter table public.offer_translations enable row level security;
drop policy if exists tg_offer_translations_view on public.offer_translations;
create policy tg_offer_translations_view on public.offer_translations for select to authenticated
using (public.has_admin_permission('offers.view'));
drop policy if exists tg_translation_resource_types_view on public.translation_resource_types;
create policy tg_translation_resource_types_view on public.translation_resource_types for select to authenticated using (
 public.has_admin_permission('content.view') or public.has_admin_permission('platforms.view') or public.has_admin_permission('offers.view')
);
drop policy if exists tg_translation_resource_fields_view on public.translation_resource_fields;
create policy tg_translation_resource_fields_view on public.translation_resource_fields for select to authenticated using (
 public.has_admin_permission('content.view') or public.has_admin_permission('platforms.view') or public.has_admin_permission('offers.view')
);
drop policy if exists tg_translation_field_state_view on public.translation_field_state;
create policy tg_translation_field_state_view on public.translation_field_state for select to authenticated using (
 (resource_type='site_content' and public.has_admin_permission('content.view')) or
 (resource_type='platform_translation' and public.has_admin_permission('platforms.view')) or
 (resource_type='offer_translation' and public.has_admin_permission('offers.view'))
);
drop policy if exists tg_translation_jobs_view on public.translation_jobs;
create policy tg_translation_jobs_view on public.translation_jobs for select to authenticated using (
 (resource_type='site_content' and public.has_admin_permission('content.view')) or
 (resource_type='platform_translation' and public.has_admin_permission('platforms.view')) or
 (resource_type='offer_translation' and public.has_admin_permission('offers.view'))
);

revoke all on public.offer_translations from public,anon,authenticated;
grant select on public.offer_translations to authenticated;
grant all on public.offer_translations to service_role;
revoke all on function public.translation_assert_admin_permission(text) from public,anon,authenticated;
revoke all on function public.translation_read_value(text,text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_value(text,text,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.translation_offer_source_insert_trigger() from public,anon,authenticated;
revoke all on function public.translation_offer_source_update_trigger() from public,anon,authenticated;
revoke all on function public.translation_offer_source_delete_trigger() from public,anon,authenticated;
revoke all on function public.translation_register_offer_source_change_internal(text,text,text) from public,anon,authenticated;

-- Seguridad: la inicialización no debe haber creado trabajos.
do $$ begin
  if exists(select 1 from public.translation_jobs where resource_type='offer_translation') then
    raise exception 'La inicialización de ofertas no debe crear translation_jobs';
  end if;
end $$;

commit;

-- Rollback controlado: quitar trigger/policies/registro y tabla solo después de
-- cancelar estados/jobs offer_translation; restaurar las funciones del Bloque 2.
