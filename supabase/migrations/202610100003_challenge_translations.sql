-- ETAPA 2 / BLOQUE 3C: textos editoriales de challenges sin duplicar registros.
-- La fuente es el idioma activo marcado is_default. No modifica precios, reglas,
-- porcentajes, monedas, nombres comerciales ni relaciones existentes.
begin;

do $$ begin
  if to_regclass('public.translation_field_state') is null
    or to_regclass('public.translation_jobs') is null
    or to_regclass('public.translation_resource_types') is null then
    raise exception 'Debe aplicarse primero 202610100001_translation_persistence_infrastructure.sql';
  end if;
  if to_regclass('public.challenge_phases') is null
    or to_regclass('public.challenge_variants') is null
    or to_regclass('public.challenge_variant_phases') is null
    or to_regclass('public.account_plans') is null
    or to_regclass('public.challenge_reward_options') is null then
    raise exception 'El esquema normalizado de challenges está incompleto';
  end if;
end $$;

create table if not exists public.challenge_phase_translations (
  phase_id uuid not null references public.challenge_phases(id) on delete cascade,
  language text not null references public.languages(code) on update cascade on delete restrict,
  name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (phase_id, language),
  check (name is null or btrim(name) <> ''),
  check (notes is null or btrim(notes) <> '')
);

create table if not exists public.challenge_variant_translations (
  variant_id uuid not null references public.challenge_variants(id) on delete cascade,
  language text not null references public.languages(code) on update cascade on delete restrict,
  payout_frequency text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (variant_id, language),
  check (payout_frequency is null or btrim(payout_frequency) <> ''),
  check (notes is null or btrim(notes) <> '')
);

create table if not exists public.challenge_variant_phase_translations (
  variant_phase_id uuid not null references public.challenge_variant_phases(id) on delete cascade,
  language text not null references public.languages(code) on update cascade on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (variant_phase_id, language),
  check (notes is null or btrim(notes) <> '')
);

create table if not exists public.account_plan_translations (
  account_plan_id uuid not null references public.account_plans(id) on delete cascade,
  language text not null references public.languages(code) on update cascade on delete restrict,
  payout_frequency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_plan_id, language),
  check (payout_frequency is null or btrim(payout_frequency) <> '')
);

create table if not exists public.challenge_reward_translations (
  reward_option_id uuid not null references public.challenge_reward_options(id) on delete cascade,
  language text not null references public.languages(code) on update cascade on delete restrict,
  name text,
  payout_frequency text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (reward_option_id, language),
  check (name is null or btrim(name) <> ''),
  check (payout_frequency is null or btrim(payout_frequency) <> ''),
  check (notes is null or btrim(notes) <> '')
);

insert into public.translation_resource_types(resource_type,description,adapter_key) values
 ('challenge_phase_translation','Nombre editorial y notas de una fase.','challenge_phase_translation'),
 ('challenge_variant_translation','Frecuencia de payout y notas de una variante.','challenge_variant_translation'),
 ('challenge_variant_phase_translation','Notas editoriales de un override de fase.','challenge_variant_phase_translation'),
 ('account_plan_translation','Frecuencia textual legacy de un plan.','account_plan_translation'),
 ('challenge_reward_translation','Nombre, frecuencia y notas de una opción de recompensa.','challenge_reward_translation')
on conflict(resource_type) do update set description=excluded.description,adapter_key=excluded.adapter_key;

insert into public.translation_resource_fields(resource_type,field_name,value_kind,max_characters) values
 ('challenge_phase_translation','name','text',500),('challenge_phase_translation','notes','rich_text',10000),
 ('challenge_variant_translation','payout_frequency','text',500),('challenge_variant_translation','notes','rich_text',10000),
 ('challenge_variant_phase_translation','notes','rich_text',10000),
 ('account_plan_translation','payout_frequency','text',500),
 ('challenge_reward_translation','name','text',500),('challenge_reward_translation','payout_frequency','text',500),
 ('challenge_reward_translation','notes','rich_text',10000)
on conflict(resource_type,field_name) do update set value_kind=excluded.value_kind,max_characters=excluded.max_characters;

create or replace function public.translation_assert_admin_permission(p_resource_type text)
returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare required_permission text;
begin
  required_permission := case
    when p_resource_type='site_content' then 'content.update'
    when p_resource_type='platform_translation' then 'platforms.update'
    when p_resource_type='offer_translation' then 'offers.update'
    when p_resource_type in ('challenge_phase_translation','challenge_variant_translation',
      'challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation')
      then 'challenges.update'
  end;
  if required_permission is null then raise exception 'Resource type no autorizado' using errcode='22023'; end if;
  if public.has_admin_permission(required_permission) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
end $$;

-- Conserva sin duplicar los adaptadores ya publicados por Bloques 2/3B.
do $$ begin
  if to_regprocedure('public.translation_read_value_before_challenges(text,text,text,text)') is null then
    execute 'alter function public.translation_read_value(text,text,text,text) rename to translation_read_value_before_challenges';
  end if;
  if to_regprocedure('public.translation_write_value_before_challenges(text,text,text,text,jsonb,uuid)') is null then
    execute 'alter function public.translation_write_value(text,text,text,text,jsonb,uuid) rename to translation_write_value_before_challenges';
  end if;
end $$;

create or replace function public.translation_read_challenge_value(
  p_resource_type text,p_resource_id text,p_field_name text,p_language text
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare value jsonb; source_language text;
begin
  perform public.translation_assert_field(p_resource_type,p_field_name);
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  if source_language is null then return null; end if;
  if p_resource_type='challenge_phase_translation' then
    if p_language=source_language then
      select case p_field_name when 'name' then to_jsonb(name) when 'notes' then to_jsonb(notes) end into value
      from public.challenge_phases where id::text=p_resource_id;
    else
      select case p_field_name when 'name' then to_jsonb(name) when 'notes' then to_jsonb(notes) end into value
      from public.challenge_phase_translations where phase_id::text=p_resource_id and language=p_language;
    end if;
  elsif p_resource_type='challenge_variant_translation' then
    if p_language=source_language then
      select case p_field_name when 'payout_frequency' then to_jsonb(payout_frequency) when 'notes' then to_jsonb(notes) end into value
      from public.challenge_variants where id::text=p_resource_id;
    else
      select case p_field_name when 'payout_frequency' then to_jsonb(payout_frequency) when 'notes' then to_jsonb(notes) end into value
      from public.challenge_variant_translations where variant_id::text=p_resource_id and language=p_language;
    end if;
  elsif p_resource_type='challenge_variant_phase_translation' then
    if p_language=source_language then select to_jsonb(notes) into value from public.challenge_variant_phases where id::text=p_resource_id;
    else select to_jsonb(notes) into value from public.challenge_variant_phase_translations where variant_phase_id::text=p_resource_id and language=p_language; end if;
  elsif p_resource_type='account_plan_translation' then
    if p_language=source_language then select to_jsonb(payout_frequency) into value from public.account_plans where id::text=p_resource_id;
    else select to_jsonb(payout_frequency) into value from public.account_plan_translations where account_plan_id::text=p_resource_id and language=p_language; end if;
  elsif p_resource_type='challenge_reward_translation' then
    if p_language=source_language then
      select case p_field_name when 'name' then to_jsonb(name) when 'payout_frequency' then to_jsonb(payout_frequency) when 'notes' then to_jsonb(notes) end into value
      from public.challenge_reward_options where id::text=p_resource_id;
    else
      select case p_field_name when 'name' then to_jsonb(name) when 'payout_frequency' then to_jsonb(payout_frequency) when 'notes' then to_jsonb(notes) end into value
      from public.challenge_reward_translations where reward_option_id::text=p_resource_id and language=p_language;
    end if;
  else raise exception 'Adaptador de challenge no implementado' using errcode='0A000'; end if;
  return value;
end $$;

create or replace function public.translation_read_value(p_resource_type text,p_resource_id text,p_field_name text,p_language text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
  if p_resource_type in ('challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation') then
    return public.translation_read_challenge_value(p_resource_type,p_resource_id,p_field_name,p_language);
  end if;
  return public.translation_read_value_before_challenges(p_resource_type,p_resource_id,p_field_name,p_language);
end $$;

create or replace function public.translation_write_challenge_value(
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
  if p_resource_type='challenge_phase_translation' then
    insert into public.challenge_phase_translations(phase_id,language,name,notes,updated_at)
    values(p_resource_id::uuid,p_language,case when p_field_name='name' then text_value end,case when p_field_name='notes' then text_value end,now())
    on conflict(phase_id,language) do update set name=case when p_field_name='name' then excluded.name else challenge_phase_translations.name end,
      notes=case when p_field_name='notes' then excluded.notes else challenge_phase_translations.notes end,updated_at=now();
  elsif p_resource_type='challenge_variant_translation' then
    insert into public.challenge_variant_translations(variant_id,language,payout_frequency,notes,updated_at)
    values(p_resource_id::uuid,p_language,case when p_field_name='payout_frequency' then text_value end,case when p_field_name='notes' then text_value end,now())
    on conflict(variant_id,language) do update set payout_frequency=case when p_field_name='payout_frequency' then excluded.payout_frequency else challenge_variant_translations.payout_frequency end,
      notes=case when p_field_name='notes' then excluded.notes else challenge_variant_translations.notes end,updated_at=now();
  elsif p_resource_type='challenge_variant_phase_translation' then
    insert into public.challenge_variant_phase_translations(variant_phase_id,language,notes,updated_at) values(p_resource_id::uuid,p_language,text_value,now())
    on conflict(variant_phase_id,language) do update set notes=excluded.notes,updated_at=now();
  elsif p_resource_type='account_plan_translation' then
    insert into public.account_plan_translations(account_plan_id,language,payout_frequency,updated_at) values(p_resource_id::uuid,p_language,text_value,now())
    on conflict(account_plan_id,language) do update set payout_frequency=excluded.payout_frequency,updated_at=now();
  elsif p_resource_type='challenge_reward_translation' then
    insert into public.challenge_reward_translations(reward_option_id,language,name,payout_frequency,notes,updated_at)
    values(p_resource_id::uuid,p_language,case when p_field_name='name' then text_value end,case when p_field_name='payout_frequency' then text_value end,case when p_field_name='notes' then text_value end,now())
    on conflict(reward_option_id,language) do update set name=case when p_field_name='name' then excluded.name else challenge_reward_translations.name end,
      payout_frequency=case when p_field_name='payout_frequency' then excluded.payout_frequency else challenge_reward_translations.payout_frequency end,
      notes=case when p_field_name='notes' then excluded.notes else challenge_reward_translations.notes end,updated_at=now();
  else raise exception 'Adaptador de challenge no implementado' using errcode='0A000'; end if;
end $$;

create or replace function public.translation_write_value(p_resource_type text,p_resource_id text,p_field_name text,p_language text,p_value jsonb,p_actor uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_resource_type in ('challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation') then
    perform public.translation_write_challenge_value(p_resource_type,p_resource_id,p_field_name,p_language,p_value);
    return;
  end if;
  perform public.translation_write_value_before_challenges(p_resource_type,p_resource_id,p_field_name,p_language,p_value,p_actor);
end $$;

create or replace function public.translation_challenge_source_insert_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare resource_type text; fields text[]; field_name text; source_language text;
begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  resource_type:=case tg_table_name when 'challenge_phases' then 'challenge_phase_translation' when 'challenge_variants' then 'challenge_variant_translation'
    when 'challenge_variant_phases' then 'challenge_variant_phase_translation' when 'account_plans' then 'account_plan_translation'
    when 'challenge_reward_options' then 'challenge_reward_translation' end;
  fields:=case tg_table_name when 'challenge_phases' then array['name','notes'] when 'challenge_variants' then array['payout_frequency','notes']
    when 'challenge_variant_phases' then array['notes'] when 'account_plans' then array['payout_frequency']
    when 'challenge_reward_options' then array['name','payout_frequency','notes'] end;
  foreach field_name in array fields loop
    perform public.translation_register_source_change_internal(resource_type,new.id::text,field_name,source_language);
  end loop;
  return new;
end $$;

create or replace function public.translation_challenge_source_update_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare resource_type text; fields text[]; field_name text; source_language text; old_row jsonb:=to_jsonb(old); new_row jsonb:=to_jsonb(new);
begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  resource_type:=case tg_table_name when 'challenge_phases' then 'challenge_phase_translation' when 'challenge_variants' then 'challenge_variant_translation'
    when 'challenge_variant_phases' then 'challenge_variant_phase_translation' when 'account_plans' then 'account_plan_translation'
    when 'challenge_reward_options' then 'challenge_reward_translation' end;
  fields:=case tg_table_name when 'challenge_phases' then array['name','notes'] when 'challenge_variants' then array['payout_frequency','notes']
    when 'challenge_variant_phases' then array['notes'] when 'account_plans' then array['payout_frequency']
    when 'challenge_reward_options' then array['name','payout_frequency','notes'] end;
  foreach field_name in array fields loop
    if new_row->field_name is distinct from old_row->field_name then
      perform public.translation_register_source_change_internal(resource_type,new.id::text,field_name,source_language);
    end if;
  end loop;
  return new;
end $$;

create or replace function public.translation_challenge_source_delete_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare resource_type text; fields text[]; field_name text; source_language text;
begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  resource_type:=case tg_table_name when 'challenge_phases' then 'challenge_phase_translation' when 'challenge_variants' then 'challenge_variant_translation'
    when 'challenge_variant_phases' then 'challenge_variant_phase_translation' when 'account_plans' then 'account_plan_translation'
    when 'challenge_reward_options' then 'challenge_reward_translation' end;
  fields:=case tg_table_name when 'challenge_phases' then array['name','notes'] when 'challenge_variants' then array['payout_frequency','notes']
    when 'challenge_variant_phases' then array['notes'] when 'account_plans' then array['payout_frequency']
    when 'challenge_reward_options' then array['name','payout_frequency','notes'] end;
  foreach field_name in array fields loop
    perform public.translation_invalidate_source_internal(resource_type,old.id::text,field_name,source_language,'source_deleted');
  end loop;
  return old;
end $$;

do $$ declare table_name text; begin
  foreach table_name in array array['challenge_phases','challenge_variants','challenge_variant_phases','account_plans','challenge_reward_options'] loop
    execute format('drop trigger if exists translation_challenge_source_insert on public.%I',table_name);
    execute format('drop trigger if exists translation_challenge_source_update on public.%I',table_name);
    execute format('drop trigger if exists translation_challenge_source_delete on public.%I',table_name);
    execute format('create trigger translation_challenge_source_insert after insert on public.%I for each row execute function public.translation_challenge_source_insert_trigger()',table_name);
    execute format('create trigger translation_challenge_source_update after update on public.%I for each row execute function public.translation_challenge_source_update_trigger()',table_name);
    execute format('create trigger translation_challenge_source_delete after delete on public.%I for each row execute function public.translation_challenge_source_delete_trigger()',table_name);
  end loop;
end $$;

-- Inicializa solamente metadata. No escribe textos ni encola trabajos.
do $$ declare item record; source_language text; begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  for item in
    select 'challenge_phase_translation' resource_type,id::text resource_id,unnest(array['name','notes']) field_name from public.challenge_phases
    union all select 'challenge_variant_translation',id::text,unnest(array['payout_frequency','notes']) from public.challenge_variants
    union all select 'challenge_variant_phase_translation',id::text,'notes' from public.challenge_variant_phases
    union all select 'account_plan_translation',id::text,'payout_frequency' from public.account_plans
    union all select 'challenge_reward_translation',id::text,unnest(array['name','payout_frequency','notes']) from public.challenge_reward_options
  loop
    perform public.translation_register_source_change_internal(item.resource_type,item.resource_id,item.field_name,source_language);
  end loop;
end $$;

alter table public.challenge_phase_translations enable row level security;
alter table public.challenge_variant_translations enable row level security;
alter table public.challenge_variant_phase_translations enable row level security;
alter table public.account_plan_translations enable row level security;
alter table public.challenge_reward_translations enable row level security;

do $$ declare table_name text; begin
  foreach table_name in array array['challenge_phase_translations','challenge_variant_translations','challenge_variant_phase_translations','account_plan_translations','challenge_reward_translations'] loop
    execute format('drop policy if exists tg_challenge_translations_view on public.%I',table_name);
    execute format('create policy tg_challenge_translations_view on public.%I for select to authenticated using (public.has_admin_permission(''challenges.view''))',table_name);
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
 (resource_type='platform_translation' and public.has_admin_permission('platforms.view')) or
 (resource_type='offer_translation' and public.has_admin_permission('offers.view')) or
 (resource_type in ('challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation') and public.has_admin_permission('challenges.view'))
);
drop policy if exists tg_translation_jobs_view on public.translation_jobs;
create policy tg_translation_jobs_view on public.translation_jobs for select to authenticated using (
 (resource_type='site_content' and public.has_admin_permission('content.view')) or
 (resource_type='platform_translation' and public.has_admin_permission('platforms.view')) or
 (resource_type='offer_translation' and public.has_admin_permission('offers.view')) or
 (resource_type in ('challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation') and public.has_admin_permission('challenges.view'))
);

revoke all on function public.translation_assert_admin_permission(text) from public,anon,authenticated;
revoke all on function public.translation_read_value(text,text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_value(text,text,text,text,jsonb,uuid) from public,anon,authenticated;
-- ALTER FUNCTION ... RENAME conserva el ACL por OID. Se revoca también de forma
-- explícita para no depender de que una instalación anterior tuviera el ACL esperado.
revoke all on function public.translation_read_value_before_challenges(text,text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_value_before_challenges(text,text,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.translation_read_challenge_value(text,text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_challenge_value(text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.translation_challenge_source_insert_trigger() from public,anon,authenticated;
revoke all on function public.translation_challenge_source_update_trigger() from public,anon,authenticated;
revoke all on function public.translation_challenge_source_delete_trigger() from public,anon,authenticated;

do $$ begin
  if exists(select 1 from public.translation_jobs where resource_type in ('challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation')) then
    raise exception 'La inicialización de challenges no debe crear translation_jobs';
  end if;
end $$;

commit;

-- Rollback controlado: retirar triggers/policies/metadata y tablas 3C solamente
-- después de cancelar jobs del bloque; restaurar los adaptadores *_before_challenges.
