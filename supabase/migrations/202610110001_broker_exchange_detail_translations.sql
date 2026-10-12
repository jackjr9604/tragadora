-- ETAPA 2 / BLOQUE 3D.1: textos especializados de Brokers y Exchanges.
-- No duplica platform_translations ni modifica datos técnicos/regulatorios fuente.
begin;

do $$ begin
  if to_regclass('public.broker_details') is null or to_regclass('public.exchange_details') is null then
    raise exception '3D.1 requiere broker_details y exchange_details';
  end if;
  if to_regclass('public.translation_field_state') is null or to_regclass('public.translation_jobs') is null then
    raise exception '3D.1 requiere la infraestructura persistente del Bloque 2';
  end if;
end $$;

create table if not exists public.broker_detail_translations (
  platform_id uuid not null references public.broker_details(platform_id) on delete cascade,
  language text not null references public.languages(code) on update cascade on delete restrict,
  regulation_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(platform_id,language),
  check(regulation_summary is null or btrim(regulation_summary)<>'')
);

create table if not exists public.exchange_detail_translations (
  platform_id uuid not null references public.exchange_details(platform_id) on delete cascade,
  language text not null references public.languages(code) on update cascade on delete restrict,
  product_summary text,
  regulation_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(platform_id,language),
  check(product_summary is null or btrim(product_summary)<>''),
  check(regulation_summary is null or btrim(regulation_summary)<>'')
);

insert into public.translation_resource_types(resource_type,description,adapter_key) values
 ('broker_detail_translation','Resumen regulatorio especializado de un broker.','broker_detail_translation'),
 ('exchange_detail_translation','Productos y resumen regulatorio especializados de un exchange.','exchange_detail_translation')
on conflict(resource_type) do update set description=excluded.description,adapter_key=excluded.adapter_key;

insert into public.translation_resource_fields(resource_type,field_name,value_kind,max_characters) values
 ('broker_detail_translation','regulation_summary','rich_text',10000),
 ('exchange_detail_translation','product_summary','text',5000),
 ('exchange_detail_translation','regulation_summary','rich_text',10000)
on conflict(resource_type,field_name) do update set value_kind=excluded.value_kind,max_characters=excluded.max_characters;

create or replace function public.translation_assert_admin_permission(p_resource_type text)
returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare required_permission text;
begin
  required_permission:=case
    when p_resource_type='site_content' then 'content.update'
    when p_resource_type='platform_translation' then 'platforms.update'
    when p_resource_type='offer_translation' then 'offers.update'
    when p_resource_type in ('challenge_phase_translation','challenge_variant_translation',
      'challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation') then 'challenges.update'
    when p_resource_type in ('broker_detail_translation','exchange_detail_translation') then 'platforms.update'
  end;
  if required_permission is null then raise exception 'Resource type no autorizado' using errcode='22023'; end if;
  if public.has_admin_permission(required_permission) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
end $$;

-- Encadena el adaptador publicado por 3C sin alterar su implementación ni firmas.
do $$ begin
  if to_regprocedure('public.translation_read_value_before_platform_details(text,text,text,text)') is null then
    execute 'alter function public.translation_read_value(text,text,text,text) rename to translation_read_value_before_platform_details';
  end if;
  if to_regprocedure('public.translation_write_value_before_platform_details(text,text,text,text,jsonb,uuid)') is null then
    execute 'alter function public.translation_write_value(text,text,text,text,jsonb,uuid) rename to translation_write_value_before_platform_details';
  end if;
end $$;

create or replace function public.translation_read_platform_detail_value(
  p_resource_type text,p_resource_id text,p_field_name text,p_language text
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare value jsonb; source_language text;
begin
  perform public.translation_assert_field(p_resource_type,p_field_name);
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  if source_language is null then return null; end if;
  if p_resource_type='broker_detail_translation' then
    if p_language=source_language then
      select to_jsonb(regulation_summary) into value from public.broker_details where platform_id::text=p_resource_id;
    else
      select to_jsonb(regulation_summary) into value from public.broker_detail_translations where platform_id::text=p_resource_id and language=p_language;
    end if;
  elsif p_resource_type='exchange_detail_translation' then
    if p_language=source_language then
      select case p_field_name when 'product_summary' then to_jsonb(product_summary) when 'regulation_summary' then to_jsonb(regulation_summary) end into value
      from public.exchange_details where platform_id::text=p_resource_id;
    else
      select case p_field_name when 'product_summary' then to_jsonb(product_summary) when 'regulation_summary' then to_jsonb(regulation_summary) end into value
      from public.exchange_detail_translations where platform_id::text=p_resource_id and language=p_language;
    end if;
  else raise exception 'Adaptador de detalle de plataforma no implementado' using errcode='0A000'; end if;
  return value;
end $$;

create or replace function public.translation_read_value(p_resource_type text,p_resource_id text,p_field_name text,p_language text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
  if p_resource_type in ('broker_detail_translation','exchange_detail_translation') then
    return public.translation_read_platform_detail_value(p_resource_type,p_resource_id,p_field_name,p_language);
  end if;
  return public.translation_read_value_before_platform_details(p_resource_type,p_resource_id,p_field_name,p_language);
end $$;

create or replace function public.translation_write_platform_detail_value(
  p_resource_type text,p_resource_id text,p_field_name text,p_language text,p_value jsonb
) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare source_language text; text_value text;
begin
  perform public.translation_assert_field(p_resource_type,p_field_name);
  if jsonb_typeof(p_value)<>'string' or not public.translation_value_present(p_value) then
    raise exception 'El campo % requiere una cadena JSONB no vacía',p_field_name using errcode='22023';
  end if;
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  if source_language is null then raise exception 'Idioma fuente no encontrado' using errcode='P0002'; end if;
  if p_language=source_language or p_language='global' then raise exception 'No se puede escribir el idioma fuente mediante traducciones' using errcode='22023'; end if;
  text_value:=p_value#>>'{}';
  if p_resource_type='broker_detail_translation' and p_field_name='regulation_summary' then
    insert into public.broker_detail_translations(platform_id,language,regulation_summary,updated_at)
    values(p_resource_id::uuid,p_language,text_value,now())
    on conflict(platform_id,language) do update set regulation_summary=excluded.regulation_summary,updated_at=now();
  elsif p_resource_type='exchange_detail_translation' then
    insert into public.exchange_detail_translations(platform_id,language,product_summary,regulation_summary,updated_at)
    values(p_resource_id::uuid,p_language,case when p_field_name='product_summary' then text_value end,
      case when p_field_name='regulation_summary' then text_value end,now())
    on conflict(platform_id,language) do update set
      product_summary=case when p_field_name='product_summary' then excluded.product_summary else exchange_detail_translations.product_summary end,
      regulation_summary=case when p_field_name='regulation_summary' then excluded.regulation_summary else exchange_detail_translations.regulation_summary end,
      updated_at=now();
  else raise exception 'Adaptador de detalle de plataforma no implementado' using errcode='0A000'; end if;
end $$;

create or replace function public.translation_write_value(
  p_resource_type text,p_resource_id text,p_field_name text,p_language text,p_value jsonb,p_actor uuid
) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_resource_type in ('broker_detail_translation','exchange_detail_translation') then
    perform public.translation_write_platform_detail_value(p_resource_type,p_resource_id,p_field_name,p_language,p_value);
    return;
  end if;
  perform public.translation_write_value_before_platform_details(p_resource_type,p_resource_id,p_field_name,p_language,p_value,p_actor);
end $$;

create or replace function public.translation_platform_detail_source_insert_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare resource_type text; fields text[]; field_name text; source_language text;
begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  resource_type:=case tg_table_name when 'broker_details' then 'broker_detail_translation' when 'exchange_details' then 'exchange_detail_translation' end;
  fields:=case tg_table_name when 'broker_details' then array['regulation_summary'] when 'exchange_details' then array['product_summary','regulation_summary'] end;
  foreach field_name in array fields loop
    perform public.translation_register_source_change_internal(resource_type,new.platform_id::text,field_name,source_language);
  end loop;
  return new;
end $$;

create or replace function public.translation_platform_detail_source_update_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare resource_type text; fields text[]; field_name text; source_language text; old_row jsonb:=to_jsonb(old); new_row jsonb:=to_jsonb(new);
begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  resource_type:=case tg_table_name when 'broker_details' then 'broker_detail_translation' when 'exchange_details' then 'exchange_detail_translation' end;
  fields:=case tg_table_name when 'broker_details' then array['regulation_summary'] when 'exchange_details' then array['product_summary','regulation_summary'] end;
  foreach field_name in array fields loop
    if new_row->field_name is distinct from old_row->field_name then
      perform public.translation_register_source_change_internal(resource_type,new.platform_id::text,field_name,source_language);
    end if;
  end loop;
  return new;
end $$;

create or replace function public.translation_platform_detail_source_delete_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare resource_type text; fields text[]; field_name text; source_language text;
begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  resource_type:=case tg_table_name when 'broker_details' then 'broker_detail_translation' when 'exchange_details' then 'exchange_detail_translation' end;
  fields:=case tg_table_name when 'broker_details' then array['regulation_summary'] when 'exchange_details' then array['product_summary','regulation_summary'] end;
  foreach field_name in array fields loop
    perform public.translation_invalidate_source_internal(resource_type,old.platform_id::text,field_name,source_language,'source_deleted');
  end loop;
  return old;
end $$;

do $$ declare table_name text; begin
  foreach table_name in array array['broker_details','exchange_details'] loop
    execute format('drop trigger if exists translation_platform_detail_source_insert on public.%I',table_name);
    execute format('drop trigger if exists translation_platform_detail_source_update on public.%I',table_name);
    execute format('drop trigger if exists translation_platform_detail_source_delete on public.%I',table_name);
    execute format('create trigger translation_platform_detail_source_insert after insert on public.%I for each row execute function public.translation_platform_detail_source_insert_trigger()',table_name);
    execute format('create trigger translation_platform_detail_source_update after update on public.%I for each row execute function public.translation_platform_detail_source_update_trigger()',table_name);
    execute format('create trigger translation_platform_detail_source_delete after delete on public.%I for each row execute function public.translation_platform_detail_source_delete_trigger()',table_name);
  end loop;
end $$;

-- Inicializa exclusivamente metadata. No escribe traducciones ni crea jobs.
do $$ declare item record; source_language text; begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  for item in
    select 'broker_detail_translation' resource_type,platform_id::text resource_id,'regulation_summary' field_name from public.broker_details
    union all select 'exchange_detail_translation',platform_id::text,'product_summary' from public.exchange_details
    union all select 'exchange_detail_translation',platform_id::text,'regulation_summary' from public.exchange_details
  loop
    perform public.translation_register_source_change_internal(item.resource_type,item.resource_id,item.field_name,source_language);
  end loop;
end $$;

alter table public.broker_detail_translations enable row level security;
alter table public.exchange_detail_translations enable row level security;

do $$ declare table_name text; begin
  foreach table_name in array array['broker_detail_translations','exchange_detail_translations'] loop
    execute format('drop policy if exists tg_platform_detail_translations_view on public.%I',table_name);
    execute format('create policy tg_platform_detail_translations_view on public.%I for select to authenticated using (public.has_admin_permission(''platforms.view''))',table_name);
    execute format('revoke all on public.%I from public,anon,authenticated',table_name);
    execute format('grant select on public.%I to authenticated',table_name);
    execute format('grant all on public.%I to service_role',table_name);
  end loop;
end $$;

drop policy if exists tg_translation_resource_types_view on public.translation_resource_types;
create policy tg_translation_resource_types_view on public.translation_resource_types for select to authenticated using (
 public.has_admin_permission('content.view') or public.has_admin_permission('platforms.view') or public.has_admin_permission('offers.view') or public.has_admin_permission('challenges.view')
);
drop policy if exists tg_translation_resource_fields_view on public.translation_resource_fields;
create policy tg_translation_resource_fields_view on public.translation_resource_fields for select to authenticated using (
 public.has_admin_permission('content.view') or public.has_admin_permission('platforms.view') or public.has_admin_permission('offers.view') or public.has_admin_permission('challenges.view')
);
drop policy if exists tg_translation_field_state_view on public.translation_field_state;
create policy tg_translation_field_state_view on public.translation_field_state for select to authenticated using (
 (resource_type='site_content' and public.has_admin_permission('content.view')) or
 (resource_type in ('platform_translation','broker_detail_translation','exchange_detail_translation') and public.has_admin_permission('platforms.view')) or
 (resource_type='offer_translation' and public.has_admin_permission('offers.view')) or
 (resource_type in ('challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation') and public.has_admin_permission('challenges.view'))
);
drop policy if exists tg_translation_jobs_view on public.translation_jobs;
create policy tg_translation_jobs_view on public.translation_jobs for select to authenticated using (
 (resource_type='site_content' and public.has_admin_permission('content.view')) or
 (resource_type in ('platform_translation','broker_detail_translation','exchange_detail_translation') and public.has_admin_permission('platforms.view')) or
 (resource_type='offer_translation' and public.has_admin_permission('offers.view')) or
 (resource_type in ('challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation') and public.has_admin_permission('challenges.view'))
);

revoke all on function public.translation_assert_admin_permission(text) from public,anon,authenticated;
revoke all on function public.translation_read_value(text,text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_value(text,text,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.translation_read_value_before_platform_details(text,text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_value_before_platform_details(text,text,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.translation_read_value_before_challenges(text,text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_value_before_challenges(text,text,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.translation_read_platform_detail_value(text,text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_platform_detail_value(text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.translation_platform_detail_source_insert_trigger() from public,anon,authenticated;
revoke all on function public.translation_platform_detail_source_update_trigger() from public,anon,authenticated;
revoke all on function public.translation_platform_detail_source_delete_trigger() from public,anon,authenticated;

do $$ begin
  if exists(select 1 from public.translation_jobs where resource_type in ('broker_detail_translation','exchange_detail_translation')) then
    raise exception 'La inicialización 3D.1 no debe crear translation_jobs';
  end if;
end $$;

commit;

-- Rollback controlado: eliminar triggers, policies, metadata y tablas 3D.1
-- únicamente tras cancelar jobs; restaurar los adaptadores *_before_platform_details.
