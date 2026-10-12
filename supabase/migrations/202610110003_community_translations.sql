-- ETAPA 2 / BLOQUE 3D.3: traducciones persistentes de comunidades.
-- No modifica nombres, tipos, categorías estables, enlaces, idiomas ni estados fuente.
begin;

do $$ begin
  if to_regclass('public.communities') is null then raise exception '3D.3 requiere public.communities'; end if;
  if to_regclass('public.translation_field_state') is null or to_regclass('public.translation_jobs') is null then raise exception '3D.3 requiere Bloque 2'; end if;
end $$;

create table if not exists public.community_translations(
  community_id uuid not null references public.communities(id) on delete cascade,
  language text not null references public.languages(code) on update cascade on delete restrict,
  short_description text,
  category_label text,
  region_label text,
  badge text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(community_id,language),
  check(short_description is null or btrim(short_description)<>''),
  check(category_label is null or btrim(category_label)<>''),
  check(region_label is null or btrim(region_label)<>''),
  check(badge is null or btrim(badge)<>'')
);

insert into public.translation_resource_types(resource_type,description,adapter_key) values
 ('community_translation','Textos editoriales de comunidades.','community_translation')
on conflict(resource_type) do update set description=excluded.description,adapter_key=excluded.adapter_key;
insert into public.translation_resource_fields(resource_type,field_name,value_kind,max_characters) values
 ('community_translation','short_description','text',2000),
 ('community_translation','category_label','text',240),
 ('community_translation','region_label','text',240),
 ('community_translation','badge','text',120)
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
    when p_resource_type='community_translation' then 'communities.update'
  end;
  if required_permission is null then raise exception 'Resource type no autorizado' using errcode='22023'; end if;
  if public.has_admin_permission(required_permission) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
end $$;

do $$ begin
  if to_regprocedure('public.translation_read_value_before_communities(text,text,text,text)') is null then execute 'alter function public.translation_read_value(text,text,text,text) rename to translation_read_value_before_communities'; end if;
  if to_regprocedure('public.translation_write_value_before_communities(text,text,text,text,jsonb,uuid)') is null then execute 'alter function public.translation_write_value(text,text,text,text,jsonb,uuid) rename to translation_write_value_before_communities'; end if;
end $$;

create or replace function public.translation_read_community_value(p_resource_id text,p_field_name text,p_language text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare value jsonb; source_language text;
begin
  perform public.translation_assert_field('community_translation',p_field_name);
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  if source_language is null then return null; end if;
  if p_language=source_language then
    select case p_field_name when 'short_description' then to_jsonb(short_description) when 'category_label' then to_jsonb(category) when 'region_label' then to_jsonb(region_label) when 'badge' then to_jsonb(badge) end into value
    from public.communities where id::text=p_resource_id;
  else
    select case p_field_name when 'short_description' then to_jsonb(short_description) when 'category_label' then to_jsonb(category_label) when 'region_label' then to_jsonb(region_label) when 'badge' then to_jsonb(badge) end into value
    from public.community_translations where community_id::text=p_resource_id and language=p_language;
  end if;
  return value;
end $$;

create or replace function public.translation_read_value(p_resource_type text,p_resource_id text,p_field_name text,p_language text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
  if p_resource_type='community_translation' then return public.translation_read_community_value(p_resource_id,p_field_name,p_language); end if;
  return public.translation_read_value_before_communities(p_resource_type,p_resource_id,p_field_name,p_language);
end $$;

create or replace function public.translation_write_community_value(p_resource_id text,p_field_name text,p_language text,p_value jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare source_language text; text_value text;
begin
  perform public.translation_assert_field('community_translation',p_field_name);
  if jsonb_typeof(p_value)<>'string' or not public.translation_value_present(p_value) then raise exception 'El campo % requiere una cadena JSONB no vacía',p_field_name using errcode='22023'; end if;
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  if source_language is null then raise exception 'Idioma fuente no encontrado' using errcode='P0002'; end if;
  if p_language=source_language or p_language='global' then raise exception 'No se puede escribir el idioma fuente mediante traducciones' using errcode='22023'; end if;
  if not exists(select 1 from public.communities where id::text=p_resource_id) then raise exception 'Comunidad no encontrada' using errcode='P0002'; end if;
  text_value:=p_value#>>'{}';
  insert into public.community_translations(community_id,language,short_description,category_label,region_label,badge,updated_at)
  values(p_resource_id::uuid,p_language,case when p_field_name='short_description' then text_value end,case when p_field_name='category_label' then text_value end,case when p_field_name='region_label' then text_value end,case when p_field_name='badge' then text_value end,now())
  on conflict(community_id,language) do update set
    short_description=case when p_field_name='short_description' then excluded.short_description else community_translations.short_description end,
    category_label=case when p_field_name='category_label' then excluded.category_label else community_translations.category_label end,
    region_label=case when p_field_name='region_label' then excluded.region_label else community_translations.region_label end,
    badge=case when p_field_name='badge' then excluded.badge else community_translations.badge end,
    updated_at=now();
end $$;

create or replace function public.translation_write_value(p_resource_type text,p_resource_id text,p_field_name text,p_language text,p_value jsonb,p_actor uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_resource_type='community_translation' then perform public.translation_write_community_value(p_resource_id,p_field_name,p_language,p_value); return; end if;
  perform public.translation_write_value_before_communities(p_resource_type,p_resource_id,p_field_name,p_language,p_value,p_actor);
end $$;

create or replace function public.translation_community_source_insert_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare field_name text; source_language text;
begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  foreach field_name in array array['short_description','category_label','region_label','badge'] loop perform public.translation_register_source_change_internal('community_translation',new.id::text,field_name,source_language); end loop;
  return new;
end $$;

create or replace function public.translation_community_source_update_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare field_name text; source_language text; old_value jsonb; new_value jsonb;
begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  foreach field_name in array array['short_description','category_label','region_label','badge'] loop
    old_value:=case when field_name='category_label' then to_jsonb(old.category) else to_jsonb(old)->field_name end;
    new_value:=case when field_name='category_label' then to_jsonb(new.category) else to_jsonb(new)->field_name end;
    if new_value is distinct from old_value then perform public.translation_register_source_change_internal('community_translation',new.id::text,field_name,source_language); end if;
  end loop;
  return new;
end $$;

create or replace function public.translation_community_source_delete_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare field_name text; source_language text;
begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  foreach field_name in array array['short_description','category_label','region_label','badge'] loop perform public.translation_invalidate_source_internal('community_translation',old.id::text,field_name,source_language,'source_deleted'); end loop;
  return old;
end $$;

drop trigger if exists translation_community_source_insert on public.communities;
drop trigger if exists translation_community_source_update on public.communities;
drop trigger if exists translation_community_source_delete on public.communities;
create trigger translation_community_source_insert after insert on public.communities for each row execute function public.translation_community_source_insert_trigger();
create trigger translation_community_source_update after update on public.communities for each row execute function public.translation_community_source_update_trigger();
create trigger translation_community_source_delete after delete on public.communities for each row execute function public.translation_community_source_delete_trigger();

do $$ declare item record; field_name text; source_language text; begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  for item in select id from public.communities loop foreach field_name in array array['short_description','category_label','region_label','badge'] loop perform public.translation_register_source_change_internal('community_translation',item.id::text,field_name,source_language); end loop; end loop;
end $$;

alter table public.community_translations enable row level security;
drop policy if exists tg_community_translations_view on public.community_translations;
create policy tg_community_translations_view on public.community_translations for select to authenticated using(public.has_admin_permission('communities.view'));
revoke all on public.community_translations from public,anon,authenticated;
grant select on public.community_translations to authenticated;
grant all on public.community_translations to service_role;

drop policy if exists tg_translation_resource_types_view on public.translation_resource_types;
create policy tg_translation_resource_types_view on public.translation_resource_types for select to authenticated using(public.has_admin_permission('content.view') or public.has_admin_permission('platforms.view') or public.has_admin_permission('offers.view') or public.has_admin_permission('challenges.view') or public.has_admin_permission('tools.view') or public.has_admin_permission('communities.view'));
drop policy if exists tg_translation_resource_fields_view on public.translation_resource_fields;
create policy tg_translation_resource_fields_view on public.translation_resource_fields for select to authenticated using(public.has_admin_permission('content.view') or public.has_admin_permission('platforms.view') or public.has_admin_permission('offers.view') or public.has_admin_permission('challenges.view') or public.has_admin_permission('tools.view') or public.has_admin_permission('communities.view'));
drop policy if exists tg_translation_field_state_view on public.translation_field_state;
create policy tg_translation_field_state_view on public.translation_field_state for select to authenticated using(
 (resource_type='site_content' and public.has_admin_permission('content.view')) or (resource_type in ('platform_translation','broker_detail_translation','exchange_detail_translation') and public.has_admin_permission('platforms.view')) or (resource_type='offer_translation' and public.has_admin_permission('offers.view')) or (resource_type in ('challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation') and public.has_admin_permission('challenges.view')) or (resource_type='tool_translation' and public.has_admin_permission('tools.view')) or (resource_type='community_translation' and public.has_admin_permission('communities.view')));
drop policy if exists tg_translation_jobs_view on public.translation_jobs;
create policy tg_translation_jobs_view on public.translation_jobs for select to authenticated using(
 (resource_type='site_content' and public.has_admin_permission('content.view')) or (resource_type in ('platform_translation','broker_detail_translation','exchange_detail_translation') and public.has_admin_permission('platforms.view')) or (resource_type='offer_translation' and public.has_admin_permission('offers.view')) or (resource_type in ('challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation') and public.has_admin_permission('challenges.view')) or (resource_type='tool_translation' and public.has_admin_permission('tools.view')) or (resource_type='community_translation' and public.has_admin_permission('communities.view')));

revoke all on function public.translation_assert_admin_permission(text) from public,anon,authenticated;
revoke all on function public.translation_read_value(text,text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_value(text,text,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.translation_read_value_before_communities(text,text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_value_before_communities(text,text,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.translation_read_value_before_tools(text,text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_value_before_tools(text,text,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.translation_read_community_value(text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_community_value(text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.translation_community_source_insert_trigger() from public,anon,authenticated;
revoke all on function public.translation_community_source_update_trigger() from public,anon,authenticated;
revoke all on function public.translation_community_source_delete_trigger() from public,anon,authenticated;

do $$ begin
  if exists(select 1 from public.translation_jobs where resource_type='community_translation') then raise exception '3D.3 no debe crear translation_jobs'; end if;
  if exists(select 1 from public.community_translations) then raise exception '3D.3 no debe crear traducciones'; end if;
end $$;
commit;

-- Rollback controlado: retirar triggers/policies/metadata y restaurar *_before_communities.
