-- ETAPA 2 / BLOQUE 3D.2: traducciones persistentes de herramientas y calculadoras.
-- Conserva identidad, filtros, fórmulas, destinos y datos comerciales fuente.
begin;

do $$ begin
  if to_regclass('public.tools') is null then raise exception '3D.2 requiere public.tools'; end if;
  if to_regclass('public.translation_field_state') is null or to_regclass('public.translation_jobs') is null then
    raise exception '3D.2 requiere la infraestructura persistente del Bloque 2';
  end if;
end $$;

create table if not exists public.tool_translations (
  tool_id uuid not null references public.tools(id) on delete cascade,
  language text not null references public.languages(code) on update cascade on delete restrict,
  name text,
  short_description text,
  category_label text,
  badge text,
  price_label text,
  availability text,
  promo_label text,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(tool_id,language),
  check(name is null or btrim(name)<>''),
  check(short_description is null or btrim(short_description)<>''),
  check(category_label is null or btrim(category_label)<>''),
  check(badge is null or btrim(badge)<>''),
  check(price_label is null or btrim(price_label)<>''),
  check(availability is null or btrim(availability)<>''),
  check(promo_label is null or btrim(promo_label)<>''),
  check(seo_title is null or btrim(seo_title)<>''),
  check(seo_description is null or btrim(seo_description)<>'')
);

insert into public.translation_resource_types(resource_type,description,adapter_key) values
 ('tool_translation','Textos editoriales de herramientas y calculadoras.','tool_translation')
on conflict(resource_type) do update set description=excluded.description,adapter_key=excluded.adapter_key;

insert into public.translation_resource_fields(resource_type,field_name,value_kind,max_characters) values
 ('tool_translation','name','text',240),
 ('tool_translation','short_description','text',2000),
 ('tool_translation','category_label','text',240),
 ('tool_translation','badge','text',120),
 ('tool_translation','price_label','text',240),
 ('tool_translation','availability','text',500),
 ('tool_translation','promo_label','text',500),
 ('tool_translation','seo_title','text',240),
 ('tool_translation','seo_description','text',500)
on conflict(resource_type,field_name) do update set value_kind=excluded.value_kind,max_characters=excluded.max_characters;

create or replace function public.translation_assert_admin_permission(p_resource_type text)
returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare required_permission text;
begin
  required_permission:=case
    when p_resource_type='site_content' then 'content.update'
    when p_resource_type in ('platform_translation','broker_detail_translation','exchange_detail_translation') then 'platforms.update'
    when p_resource_type='offer_translation' then 'offers.update'
    when p_resource_type in ('challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation') then 'challenges.update'
    when p_resource_type='tool_translation' then 'tools.update'
  end;
  if required_permission is null then raise exception 'Resource type no autorizado' using errcode='22023'; end if;
  if public.has_admin_permission(required_permission) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
end $$;

-- Encadena el adaptador publicado por 3D.1.
do $$ begin
  if to_regprocedure('public.translation_read_value_before_tools(text,text,text,text)') is null then
    execute 'alter function public.translation_read_value(text,text,text,text) rename to translation_read_value_before_tools';
  end if;
  if to_regprocedure('public.translation_write_value_before_tools(text,text,text,text,jsonb,uuid)') is null then
    execute 'alter function public.translation_write_value(text,text,text,text,jsonb,uuid) rename to translation_write_value_before_tools';
  end if;
end $$;

create or replace function public.translation_read_tool_value(p_resource_id text,p_field_name text,p_language text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare value jsonb; source_language text;
begin
  perform public.translation_assert_field('tool_translation',p_field_name);
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  if source_language is null then return null; end if;
  if p_language=source_language then
    select case p_field_name
      when 'name' then case when tool_type='internal' or is_ours then to_jsonb(name) end
      when 'short_description' then to_jsonb(short_description)
      when 'category_label' then to_jsonb(category)
      when 'badge' then to_jsonb(badge)
      when 'price_label' then to_jsonb(price_label)
      when 'availability' then to_jsonb(availability)
      when 'promo_label' then to_jsonb(promo_label)
      when 'seo_title' then to_jsonb(name)
      when 'seo_description' then to_jsonb(short_description)
    end into value from public.tools where id::text=p_resource_id;
  else
    select case p_field_name
      when 'name' then to_jsonb(name) when 'short_description' then to_jsonb(short_description)
      when 'category_label' then to_jsonb(category_label) when 'badge' then to_jsonb(badge)
      when 'price_label' then to_jsonb(price_label) when 'availability' then to_jsonb(availability)
      when 'promo_label' then to_jsonb(promo_label) when 'seo_title' then to_jsonb(seo_title)
      when 'seo_description' then to_jsonb(seo_description)
    end into value from public.tool_translations where tool_id::text=p_resource_id and language=p_language;
  end if;
  return value;
end $$;

create or replace function public.translation_read_value(p_resource_type text,p_resource_id text,p_field_name text,p_language text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
  if p_resource_type='tool_translation' then return public.translation_read_tool_value(p_resource_id,p_field_name,p_language); end if;
  return public.translation_read_value_before_tools(p_resource_type,p_resource_id,p_field_name,p_language);
end $$;

create or replace function public.translation_write_tool_value(p_resource_id text,p_field_name text,p_language text,p_value jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare source_language text; text_value text; translatable_name boolean;
begin
  perform public.translation_assert_field('tool_translation',p_field_name);
  if jsonb_typeof(p_value)<>'string' or not public.translation_value_present(p_value) then
    raise exception 'El campo % requiere una cadena JSONB no vacía',p_field_name using errcode='22023';
  end if;
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  if source_language is null then raise exception 'Idioma fuente no encontrado' using errcode='P0002'; end if;
  if p_language=source_language or p_language='global' then raise exception 'No se puede escribir el idioma fuente mediante traducciones' using errcode='22023'; end if;
  select (tool_type='internal' or is_ours) into translatable_name from public.tools where id::text=p_resource_id;
  if translatable_name is null then raise exception 'Herramienta no encontrada' using errcode='P0002'; end if;
  if p_field_name='name' and not translatable_name then raise exception 'Los nombres comerciales externos no son traducibles' using errcode='22023'; end if;
  text_value:=p_value#>>'{}';
  insert into public.tool_translations(tool_id,language,name,short_description,category_label,badge,price_label,availability,promo_label,seo_title,seo_description,updated_at)
  values(p_resource_id::uuid,p_language,
    case when p_field_name='name' then text_value end,case when p_field_name='short_description' then text_value end,
    case when p_field_name='category_label' then text_value end,case when p_field_name='badge' then text_value end,
    case when p_field_name='price_label' then text_value end,case when p_field_name='availability' then text_value end,
    case when p_field_name='promo_label' then text_value end,case when p_field_name='seo_title' then text_value end,
    case when p_field_name='seo_description' then text_value end,now())
  on conflict(tool_id,language) do update set
    name=case when p_field_name='name' then excluded.name else tool_translations.name end,
    short_description=case when p_field_name='short_description' then excluded.short_description else tool_translations.short_description end,
    category_label=case when p_field_name='category_label' then excluded.category_label else tool_translations.category_label end,
    badge=case when p_field_name='badge' then excluded.badge else tool_translations.badge end,
    price_label=case when p_field_name='price_label' then excluded.price_label else tool_translations.price_label end,
    availability=case when p_field_name='availability' then excluded.availability else tool_translations.availability end,
    promo_label=case when p_field_name='promo_label' then excluded.promo_label else tool_translations.promo_label end,
    seo_title=case when p_field_name='seo_title' then excluded.seo_title else tool_translations.seo_title end,
    seo_description=case when p_field_name='seo_description' then excluded.seo_description else tool_translations.seo_description end,
    updated_at=now();
end $$;

create or replace function public.translation_write_value(p_resource_type text,p_resource_id text,p_field_name text,p_language text,p_value jsonb,p_actor uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_resource_type='tool_translation' then perform public.translation_write_tool_value(p_resource_id,p_field_name,p_language,p_value); return; end if;
  perform public.translation_write_value_before_tools(p_resource_type,p_resource_id,p_field_name,p_language,p_value,p_actor);
end $$;

create or replace function public.translation_tool_source_insert_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare field_name text; source_language text;
begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  foreach field_name in array array['short_description','category_label','badge','price_label','availability','promo_label','seo_title','seo_description'] loop
    perform public.translation_register_source_change_internal('tool_translation',new.id::text,field_name,source_language);
  end loop;
  if new.tool_type='internal' or new.is_ours then perform public.translation_register_source_change_internal('tool_translation',new.id::text,'name',source_language); end if;
  return new;
end $$;

create or replace function public.translation_tool_source_update_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare source_language text; field_name text; old_value jsonb; new_value jsonb; old_name_allowed boolean; new_name_allowed boolean;
begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  foreach field_name in array array['short_description','category_label','badge','price_label','availability','promo_label','seo_title','seo_description'] loop
    old_value:=case field_name when 'category_label' then to_jsonb(old.category) when 'seo_title' then to_jsonb(old.name) when 'seo_description' then to_jsonb(old.short_description) else to_jsonb(old)->field_name end;
    new_value:=case field_name when 'category_label' then to_jsonb(new.category) when 'seo_title' then to_jsonb(new.name) when 'seo_description' then to_jsonb(new.short_description) else to_jsonb(new)->field_name end;
    if new_value is distinct from old_value then perform public.translation_register_source_change_internal('tool_translation',new.id::text,field_name,source_language); end if;
  end loop;
  old_name_allowed:=old.tool_type='internal' or old.is_ours; new_name_allowed:=new.tool_type='internal' or new.is_ours;
  if new_name_allowed and (not old_name_allowed or new.name is distinct from old.name) then
    perform public.translation_register_source_change_internal('tool_translation',new.id::text,'name',source_language);
  elsif old_name_allowed and not new_name_allowed then
    perform public.translation_invalidate_source_internal('tool_translation',new.id::text,'name',source_language,'source_not_translatable');
  end if;
  return new;
end $$;

create or replace function public.translation_tool_source_delete_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare field_name text; source_language text;
begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  foreach field_name in array array['name','short_description','category_label','badge','price_label','availability','promo_label','seo_title','seo_description'] loop
    perform public.translation_invalidate_source_internal('tool_translation',old.id::text,field_name,source_language,'source_deleted');
  end loop;
  return old;
end $$;

drop trigger if exists translation_tool_source_insert on public.tools;
drop trigger if exists translation_tool_source_update on public.tools;
drop trigger if exists translation_tool_source_delete on public.tools;
create trigger translation_tool_source_insert after insert on public.tools for each row execute function public.translation_tool_source_insert_trigger();
create trigger translation_tool_source_update after update on public.tools for each row execute function public.translation_tool_source_update_trigger();
create trigger translation_tool_source_delete after delete on public.tools for each row execute function public.translation_tool_source_delete_trigger();

-- Inicializa metadata únicamente; no escribe traducciones ni crea jobs.
do $$ declare item record; field_name text; source_language text; begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  for item in select id,tool_type,is_ours from public.tools loop
    foreach field_name in array array['short_description','category_label','badge','price_label','availability','promo_label','seo_title','seo_description'] loop
      perform public.translation_register_source_change_internal('tool_translation',item.id::text,field_name,source_language);
    end loop;
    if item.tool_type='internal' or item.is_ours then perform public.translation_register_source_change_internal('tool_translation',item.id::text,'name',source_language); end if;
  end loop;
end $$;

alter table public.tool_translations enable row level security;
drop policy if exists tg_tool_translations_view on public.tool_translations;
create policy tg_tool_translations_view on public.tool_translations for select to authenticated using(public.has_admin_permission('tools.view'));
revoke all on public.tool_translations from public,anon,authenticated;
grant select on public.tool_translations to authenticated;
grant all on public.tool_translations to service_role;

drop policy if exists tg_translation_resource_types_view on public.translation_resource_types;
create policy tg_translation_resource_types_view on public.translation_resource_types for select to authenticated using(
 public.has_admin_permission('content.view') or public.has_admin_permission('platforms.view') or public.has_admin_permission('offers.view') or public.has_admin_permission('challenges.view') or public.has_admin_permission('tools.view'));
drop policy if exists tg_translation_resource_fields_view on public.translation_resource_fields;
create policy tg_translation_resource_fields_view on public.translation_resource_fields for select to authenticated using(
 public.has_admin_permission('content.view') or public.has_admin_permission('platforms.view') or public.has_admin_permission('offers.view') or public.has_admin_permission('challenges.view') or public.has_admin_permission('tools.view'));
drop policy if exists tg_translation_field_state_view on public.translation_field_state;
create policy tg_translation_field_state_view on public.translation_field_state for select to authenticated using(
 (resource_type='site_content' and public.has_admin_permission('content.view')) or
 (resource_type in ('platform_translation','broker_detail_translation','exchange_detail_translation') and public.has_admin_permission('platforms.view')) or
 (resource_type='offer_translation' and public.has_admin_permission('offers.view')) or
 (resource_type in ('challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation') and public.has_admin_permission('challenges.view')) or
 (resource_type='tool_translation' and public.has_admin_permission('tools.view')));
drop policy if exists tg_translation_jobs_view on public.translation_jobs;
create policy tg_translation_jobs_view on public.translation_jobs for select to authenticated using(
 (resource_type='site_content' and public.has_admin_permission('content.view')) or
 (resource_type in ('platform_translation','broker_detail_translation','exchange_detail_translation') and public.has_admin_permission('platforms.view')) or
 (resource_type='offer_translation' and public.has_admin_permission('offers.view')) or
 (resource_type in ('challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation') and public.has_admin_permission('challenges.view')) or
 (resource_type='tool_translation' and public.has_admin_permission('tools.view')));

revoke all on function public.translation_assert_admin_permission(text) from public,anon,authenticated;
revoke all on function public.translation_read_value(text,text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_value(text,text,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.translation_read_value_before_tools(text,text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_value_before_tools(text,text,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.translation_read_value_before_platform_details(text,text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_value_before_platform_details(text,text,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.translation_read_tool_value(text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_tool_value(text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.translation_tool_source_insert_trigger() from public,anon,authenticated;
revoke all on function public.translation_tool_source_update_trigger() from public,anon,authenticated;
revoke all on function public.translation_tool_source_delete_trigger() from public,anon,authenticated;

do $$ begin
  if exists(select 1 from public.translation_jobs where resource_type='tool_translation') then raise exception 'La inicialización 3D.2 no debe crear translation_jobs'; end if;
  if exists(select 1 from public.tool_translations) then raise exception 'La inicialización 3D.2 no debe crear traducciones'; end if;
end $$;

commit;

-- Rollback controlado: eliminar triggers, policies, metadata y tool_translations
-- únicamente tras cancelar jobs; restaurar adaptadores *_before_tools.
