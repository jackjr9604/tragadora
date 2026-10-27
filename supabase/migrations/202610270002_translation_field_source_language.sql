begin;

alter table public.translation_resource_fields
  add column if not exists source_language_override text null
  references public.languages(code) on update cascade on delete restrict;

comment on column public.translation_resource_fields.source_language_override is
  'Idioma fuente efectivo del campo; NULL hereda el idioma predeterminado activo.';

update public.translation_resource_fields
set source_language_override='en'
where resource_type='account_plan_translation' and field_name='payout_frequency';

create or replace function public.translation_effective_source_language(
  p_resource_type text,p_field_name text
) returns text language plpgsql stable security definer
set search_path=pg_catalog,public as $$
declare result text;
begin
  select coalesce(rf.source_language_override,l.code) into result
  from public.translation_resource_fields rf
  cross join lateral (
    select code from public.languages where is_default and is_active
    order by sort_order,code limit 1
  ) l
  where rf.resource_type=p_resource_type and rf.field_name=p_field_name and rf.enabled;
  if result is null then raise exception 'Campo o idioma fuente efectivo no disponible' using errcode='P0002'; end if;
  if not exists(select 1 from public.languages where code=result and is_active) then
    raise exception 'El idioma fuente efectivo no está activo' using errcode='55000';
  end if;
  return result;
end $$;
revoke all on function public.translation_effective_source_language(text,text) from public,anon,authenticated,service_role;

create or replace function public.translation_read_challenge_value(
  p_resource_type text,p_resource_id text,p_field_name text,p_language text
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare value jsonb; source_language text;
begin
  perform public.translation_assert_field(p_resource_type,p_field_name);
  source_language:=public.translation_effective_source_language(p_resource_type,p_field_name);
  if p_resource_type='challenge_phase_translation' then
    if p_language=source_language then select case p_field_name when 'name' then to_jsonb(name) when 'notes' then to_jsonb(notes) end into value from public.challenge_phases where id::text=p_resource_id;
    else select case p_field_name when 'name' then to_jsonb(name) when 'notes' then to_jsonb(notes) end into value from public.challenge_phase_translations where phase_id::text=p_resource_id and language=p_language; end if;
  elsif p_resource_type='challenge_variant_translation' then
    if p_language=source_language then select case p_field_name when 'payout_frequency' then to_jsonb(payout_frequency) when 'notes' then to_jsonb(notes) end into value from public.challenge_variants where id::text=p_resource_id;
    else select case p_field_name when 'payout_frequency' then to_jsonb(payout_frequency) when 'notes' then to_jsonb(notes) end into value from public.challenge_variant_translations where variant_id::text=p_resource_id and language=p_language; end if;
  elsif p_resource_type='challenge_variant_phase_translation' then
    if p_language=source_language then select to_jsonb(notes) into value from public.challenge_variant_phases where id::text=p_resource_id;
    else select to_jsonb(notes) into value from public.challenge_variant_phase_translations where variant_phase_id::text=p_resource_id and language=p_language; end if;
  elsif p_resource_type='account_plan_translation' then
    if p_language=source_language then select to_jsonb(payout_frequency) into value from public.account_plans where id::text=p_resource_id;
    else select to_jsonb(payout_frequency) into value from public.account_plan_translations where account_plan_id::text=p_resource_id and language=p_language; end if;
  elsif p_resource_type='challenge_reward_translation' then
    if p_language=source_language then select case p_field_name when 'name' then to_jsonb(name) when 'payout_frequency' then to_jsonb(payout_frequency) when 'notes' then to_jsonb(notes) end into value from public.challenge_reward_options where id::text=p_resource_id;
    else select case p_field_name when 'name' then to_jsonb(name) when 'payout_frequency' then to_jsonb(payout_frequency) when 'notes' then to_jsonb(notes) end into value from public.challenge_reward_translations where reward_option_id::text=p_resource_id and language=p_language; end if;
  else raise exception 'Adaptador de challenge no implementado' using errcode='0A000'; end if;
  return value;
end $$;

create or replace function public.translation_register_source_change_internal(p_resource_type text,p_resource_id text,p_field_name text,p_source_language text)
returns integer language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare source_value jsonb;target_value jsonb;new_hash text;target record;affected integer:=0;effective_source text;
begin
  if p_source_language='global' then return 0; end if;
  effective_source:=public.translation_effective_source_language(p_resource_type,p_field_name);
  if p_source_language<>effective_source then raise exception 'Idioma fuente incorrecto para el campo' using errcode='22023'; end if;
  source_value:=public.translation_read_value(p_resource_type,p_resource_id,p_field_name,effective_source);
  if not public.translation_value_present(source_value) then return public.translation_invalidate_source_internal(p_resource_type,p_resource_id,p_field_name,effective_source,'source_unavailable'); end if;
  new_hash:=public.translation_hash(source_value);
  for target in select code from public.languages where is_active and code<>effective_source loop
    target_value:=public.translation_read_value(p_resource_type,p_resource_id,p_field_name,target.code);
    insert into public.translation_field_state(resource_type,resource_id,field_name,source_language,target_language,source_hash,translated_source_hash,source_revision,translated_revision,status,translation_method,is_protected,protection_reason,updated_at)
    values(p_resource_type,p_resource_id,p_field_name,effective_source,target.code,new_hash,case when public.translation_value_present(target_value) then new_hash end,1,case when public.translation_value_present(target_value) then 1 end,case when public.translation_value_present(target_value) then 'imported_unreviewed' else 'missing' end,case when public.translation_value_present(target_value) then 'imported' end,public.translation_value_present(target_value),case when public.translation_value_present(target_value) then 'imported' end,now())
    on conflict(resource_type,resource_id,field_name,target_language) do update set source_language=excluded.source_language,source_hash=excluded.source_hash,
      source_revision=case when translation_field_state.source_hash<>excluded.source_hash then translation_field_state.source_revision+1 else translation_field_state.source_revision end,
      status=case when translation_field_state.source_hash=excluded.source_hash then translation_field_state.status when public.translation_value_present(target_value) then 'stale' else 'missing' end,
      last_error_code=null,last_error=null,updated_at=now();
    update public.translation_jobs set status='cancelled',completed_at=now(),updated_at=now(),error_code='source_changed',last_error='La fuente cambió antes de completar el trabajo.',locked_at=null,locked_by=null,lease_expires_at=null
    where resource_type=p_resource_type and resource_id=p_resource_id and field_name=p_field_name and target_language=target.code and source_hash<>new_hash and status in('queued','running','retry_wait');
    affected:=affected+1;
  end loop;return affected;
end $$;

create or replace function public.translation_challenge_source_insert_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare resource_type text;fields text[];field_name text;
begin
  resource_type:=case tg_table_name when 'challenge_phases' then 'challenge_phase_translation' when 'challenge_variants' then 'challenge_variant_translation' when 'challenge_variant_phases' then 'challenge_variant_phase_translation' when 'account_plans' then 'account_plan_translation' when 'challenge_reward_options' then 'challenge_reward_translation' end;
  fields:=case tg_table_name when 'challenge_phases' then array['name','notes'] when 'challenge_variants' then array['payout_frequency','notes'] when 'challenge_variant_phases' then array['notes'] when 'account_plans' then array['payout_frequency'] when 'challenge_reward_options' then array['name','payout_frequency','notes'] end;
  foreach field_name in array fields loop perform public.translation_register_source_change_internal(resource_type,new.id::text,field_name,public.translation_effective_source_language(resource_type,field_name));end loop;return new;
end $$;
create or replace function public.translation_challenge_source_update_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare resource_type text;fields text[];field_name text;old_row jsonb:=to_jsonb(old);new_row jsonb:=to_jsonb(new);
begin
  resource_type:=case tg_table_name when 'challenge_phases' then 'challenge_phase_translation' when 'challenge_variants' then 'challenge_variant_translation' when 'challenge_variant_phases' then 'challenge_variant_phase_translation' when 'account_plans' then 'account_plan_translation' when 'challenge_reward_options' then 'challenge_reward_translation' end;
  fields:=case tg_table_name when 'challenge_phases' then array['name','notes'] when 'challenge_variants' then array['payout_frequency','notes'] when 'challenge_variant_phases' then array['notes'] when 'account_plans' then array['payout_frequency'] when 'challenge_reward_options' then array['name','payout_frequency','notes'] end;
  foreach field_name in array fields loop if new_row->field_name is distinct from old_row->field_name then perform public.translation_register_source_change_internal(resource_type,new.id::text,field_name,public.translation_effective_source_language(resource_type,field_name));end if;end loop;return new;
end $$;
create or replace function public.translation_challenge_source_delete_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare resource_type text;fields text[];field_name text;
begin
  resource_type:=case tg_table_name when 'challenge_phases' then 'challenge_phase_translation' when 'challenge_variants' then 'challenge_variant_translation' when 'challenge_variant_phases' then 'challenge_variant_phase_translation' when 'account_plans' then 'account_plan_translation' when 'challenge_reward_options' then 'challenge_reward_translation' end;
  fields:=case tg_table_name when 'challenge_phases' then array['name','notes'] when 'challenge_variants' then array['payout_frequency','notes'] when 'challenge_variant_phases' then array['notes'] when 'account_plans' then array['payout_frequency'] when 'challenge_reward_options' then array['name','payout_frequency','notes'] end;
  foreach field_name in array fields loop perform public.translation_invalidate_source_internal(resource_type,old.id::text,field_name,public.translation_effective_source_language(resource_type,field_name),'source_deleted');end loop;return old;
end $$;

create or replace function public.translation_write_challenge_value(
  p_resource_type text,p_resource_id text,p_field_name text,p_language text,p_value jsonb
) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare source_language text; text_value text;
begin
  perform public.translation_assert_field(p_resource_type,p_field_name);
  if jsonb_typeof(p_value)<>'string' or not public.translation_value_present(p_value) then raise exception 'El campo % requiere una cadena JSONB no vacía',p_field_name using errcode='22023'; end if;
  source_language:=public.translation_effective_source_language(p_resource_type,p_field_name);
  if p_language=source_language or p_language='global' then raise exception 'No se puede escribir el idioma fuente mediante traducciones' using errcode='22023'; end if;
  text_value:=p_value#>>'{}';
  if p_resource_type='challenge_phase_translation' then
    insert into public.challenge_phase_translations(phase_id,language,name,notes,updated_at) values(p_resource_id::uuid,p_language,case when p_field_name='name' then text_value end,case when p_field_name='notes' then text_value end,now())
    on conflict(phase_id,language) do update set name=case when p_field_name='name' then excluded.name else challenge_phase_translations.name end,notes=case when p_field_name='notes' then excluded.notes else challenge_phase_translations.notes end,updated_at=now();
  elsif p_resource_type='challenge_variant_translation' then
    insert into public.challenge_variant_translations(variant_id,language,payout_frequency,notes,updated_at) values(p_resource_id::uuid,p_language,case when p_field_name='payout_frequency' then text_value end,case when p_field_name='notes' then text_value end,now())
    on conflict(variant_id,language) do update set payout_frequency=case when p_field_name='payout_frequency' then excluded.payout_frequency else challenge_variant_translations.payout_frequency end,notes=case when p_field_name='notes' then excluded.notes else challenge_variant_translations.notes end,updated_at=now();
  elsif p_resource_type='challenge_variant_phase_translation' then
    insert into public.challenge_variant_phase_translations(variant_phase_id,language,notes,updated_at) values(p_resource_id::uuid,p_language,text_value,now()) on conflict(variant_phase_id,language) do update set notes=excluded.notes,updated_at=now();
  elsif p_resource_type='account_plan_translation' then
    insert into public.account_plan_translations(account_plan_id,language,payout_frequency,updated_at) values(p_resource_id::uuid,p_language,text_value,now()) on conflict(account_plan_id,language) do update set payout_frequency=excluded.payout_frequency,updated_at=now();
  elsif p_resource_type='challenge_reward_translation' then
    insert into public.challenge_reward_translations(reward_option_id,language,name,payout_frequency,notes,updated_at) values(p_resource_id::uuid,p_language,case when p_field_name='name' then text_value end,case when p_field_name='payout_frequency' then text_value end,case when p_field_name='notes' then text_value end,now())
    on conflict(reward_option_id,language) do update set name=case when p_field_name='name' then excluded.name else challenge_reward_translations.name end,payout_frequency=case when p_field_name='payout_frequency' then excluded.payout_frequency else challenge_reward_translations.payout_frequency end,notes=case when p_field_name='notes' then excluded.notes else challenge_reward_translations.notes end,updated_at=now();
  else raise exception 'Adaptador de challenge no implementado' using errcode='0A000'; end if;
end $$;

-- Reconcile only non-empty sources. Historical EN states are retained as audit
-- evidence but become inapplicable because EN is now the effective source.
-- These locks close the gap between hash validation and reconciliation while
-- allowing public readers to continue. Runtime changes remain trigger-driven.
lock table public.account_plans in share mode;
lock table public.translation_field_state in share row exclusive mode;
lock table public.translation_jobs in share row exclusive mode;

do $$ declare bad bigint;
begin
  select count(*) into bad from public.translation_field_state s join public.account_plans ap on ap.id::text=s.resource_id
  where s.resource_type='account_plan_translation' and s.field_name='payout_frequency' and s.target_language='pt'
    and nullif(btrim(ap.payout_frequency),'') is not null and s.source_hash<>public.translation_hash(to_jsonb(ap.payout_frequency));
  if bad>0 then raise exception 'Existen % estados PT cuyo hash no coincide con la fuente',bad using errcode='55000'; end if;
end $$;

update public.translation_field_state s set source_language='en',updated_at=now()
from public.account_plans ap where ap.id::text=s.resource_id and s.resource_type='account_plan_translation'
  and s.field_name='payout_frequency' and s.target_language='pt' and nullif(btrim(ap.payout_frequency),'') is not null;

do $$
begin
  if exists(select 1 from public.translation_field_state where resource_type='account_plan_translation' and field_name='payout_frequency' and target_language='es' and(is_protected or publication_status='published' or workflow_status<>'none')) then
    raise exception 'Existen estados ES protegidos o activos; se requiere revisión manual' using errcode='55000';
  end if;
end $$;

insert into public.translation_field_state(resource_type,resource_id,field_name,source_language,target_language,
  source_hash,source_revision,status,publication_status,workflow_status,is_protected,lock_version,updated_at)
select 'account_plan_translation',ap.id::text,'payout_frequency','en','es',public.translation_hash(to_jsonb(ap.payout_frequency)),1,
  'missing','unpublished','none',false,1,now()
from public.account_plans ap where nullif(btrim(ap.payout_frequency),'') is not null
on conflict(resource_type,resource_id,field_name,target_language) do update set
  source_language='en',source_hash=excluded.source_hash,
  source_revision=case when translation_field_state.source_hash<>excluded.source_hash then translation_field_state.source_revision+1 else translation_field_state.source_revision end,
  status=case when translation_field_state.source_hash=excluded.source_hash then translation_field_state.status else 'stale' end,
  updated_at=now();

update public.translation_jobs set status='cancelled',completed_at=now(),updated_at=now(),
  error_code='source_language_reclassified',last_error='El campo fue reclasificado como fuente EN; no requiere traducción a EN.',
  locked_at=null,locked_by=null,lease_expires_at=null
where resource_type='account_plan_translation' and field_name='payout_frequency' and target_language='en'
  and status in('queued','running','retry_wait');

-- Effective-source enforcement for automatic batches.
create or replace function public.translation_batch_evaluate_state(p_state_id uuid,p_expected_lock_version bigint)
returns table(state_id uuid,resource_type text,resource_id text,field_name text,source_language text,target_language text,request_mode text,eligible boolean,reason text,input_characters integer,source_hash text,source_revision bigint,state_lock_version bigint,existing_job_id uuid)
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare s public.translation_field_state%rowtype; source_value jsonb; lang public.languages%rowtype; effective_source text;
begin
  select * into s from public.translation_field_state where id=p_state_id;
  if not found then raise exception 'Estado de traduccion no encontrado' using errcode='P0002'; end if;
  perform public.translation_assert_admin_permission(s.resource_type);
  effective_source:=public.translation_effective_source_language(s.resource_type,s.field_name);
  select * into lang from public.languages where code=s.target_language;
  source_value:=public.translation_read_value(s.resource_type,s.resource_id,s.field_name,effective_source);
  existing_job_id:=null;
  select j.id into existing_job_id from public.translation_jobs j where j.resource_type=s.resource_type and j.resource_id=s.resource_id and j.field_name=s.field_name and j.target_language=s.target_language and j.source_hash=s.source_hash and j.source_revision=s.source_revision and j.status in('queued','running','retry_wait') order by j.created_at desc limit 1;
  state_id:=s.id;resource_type:=s.resource_type;resource_id:=s.resource_id;field_name:=s.field_name;source_language:=s.source_language;target_language:=s.target_language;
  request_mode:=case when s.status='stale' then 'regenerate' else 'generate' end;source_hash:=s.source_hash;source_revision:=s.source_revision;state_lock_version:=s.lock_version;
  input_characters:=case when public.translation_value_present(source_value) then public.translation_batch_input_characters(source_value) else 0 end;
  eligible:=false;reason:=case
    when s.target_language=effective_source then 'source_language_target'
    when s.source_language<>effective_source then 'source_language_mismatch'
    when p_expected_lock_version is null or s.lock_version<>p_expected_lock_version then 'stale_selection'
    when not public.translation_value_present(source_value) then 'source_unavailable'
    when public.translation_hash(source_value)<>s.source_hash then 'source_changed'
    when s.target_language not in('en','pt') and not(s.resource_type='account_plan_translation' and s.field_name='payout_frequency' and s.target_language='es') then 'unsupported_target_language'
    when lang.code is null or not lang.is_active or not lang.auto_translate or lang.libretranslate_status<>'supported' then 'language_not_ready'
    when s.is_protected then 'protected' when s.publication_status='published' then 'published'
    when s.workflow_status<>'none' then 'editorial_workflow_active' when existing_job_id is not null then 'active_job_reusable'
    when s.status not in('missing','error','stale') then 'state_not_eligible' when input_characters<1 or input_characters>100000 then 'invalid_source_size' else null end;
  eligible:=reason is null or reason='active_job_reusable';return next;
end $$;

revoke all on function public.translation_batch_evaluate_state(uuid,bigint) from public,anon,authenticated,service_role;

create or replace function public.translation_request_ai_draft(p_state_id uuid,p_expected_lock_version bigint,p_input_characters integer,p_max_attempts integer default 3,p_daily_request_limit integer default 20,p_daily_character_limit integer default 100000,p_force boolean default false)
returns public.translation_jobs language plpgsql security definer set search_path=pg_catalog,public as $$
declare s public.translation_field_state%rowtype;existing public.translation_jobs%rowtype;created public.translation_jobs%rowtype;logical_identity text;next_generation integer;daily_requests bigint;daily_characters bigint;effective_source text;
begin
  select * into s from public.translation_field_state where id=p_state_id for update;
  if not found then raise exception 'Estado no encontrado' using errcode='P0002';end if;
  perform public.translation_assert_admin_permission(s.resource_type);perform public.translation_editor_assert_version(s,p_expected_lock_version);perform public.translation_editor_assert_source(s);
  effective_source:=public.translation_effective_source_language(s.resource_type,s.field_name);
  if s.source_language<>effective_source or s.target_language=effective_source then raise exception 'El estado no representa una traducción aplicable' using errcode='22023';end if;
  if s.target_language not in('en','pt') and not(s.resource_type='account_plan_translation' and s.field_name='payout_frequency' and s.target_language='es') then raise exception 'Idioma de generación automática no permitido para el campo' using errcode='22023';end if;
  if s.is_protected then raise exception 'La traducción está protegida y no puede sobrescribirse automáticamente' using errcode='42501';end if;
  if s.workflow_status<>'none' and not(p_force and s.workflow_status='draft' and s.translation_method='libretranslate') then raise exception 'Existe un borrador o revisión en curso' using errcode='55000';end if;
  if p_input_characters is null or p_input_characters<1 or p_input_characters>100000 or p_max_attempts not between 1 and 5 or p_daily_request_limit not between 1 and 100 or p_daily_character_limit not between 1 and 1000000 then raise exception 'Límites de consumo no permitidos' using errcode='22023';end if;
  select * into existing from public.translation_jobs where resource_type=s.resource_type and resource_id=s.resource_id and field_name=s.field_name and target_language=s.target_language and source_hash=s.source_hash and source_revision=s.source_revision and status in('queued','running','retry_wait') order by created_at desc limit 1 for update;
  if found then return existing;end if;
  perform pg_advisory_xact_lock(hashtextextended('translation-ai-budget',0));
  select count(*),coalesce(sum(input_characters),0) into daily_requests,daily_characters from public.translation_jobs where metadata->>'engine'='3e3' and created_at>=date_trunc('day',now());
  if daily_requests>=p_daily_request_limit or daily_characters+p_input_characters>p_daily_character_limit then raise exception 'Límite diario de traducción alcanzado' using errcode='54000';end if;
  if p_force and s.workflow_status='draft' and s.translation_method='libretranslate' then update public.translation_field_state set workflow_status='none',draft_value=null,draft_source_hash=null,draft_source_revision=null,draft_updated_at=null,draft_updated_by=null,submitted_at=null,submitted_by=null,approved_at=null,approved_by=null,lock_version=lock_version+1,updated_at=now() where id=s.id returning * into s;end if;
  logical_identity:=encode(extensions.digest(concat_ws('|',s.resource_type,s.resource_id,s.field_name,s.source_language,s.target_language),'sha256'),'hex');
  select coalesce(max(generation),0)+1 into next_generation from public.translation_jobs where logical_key=logical_identity;
  insert into public.translation_jobs(logical_key,generation,idempotency_key,resource_type,resource_id,field_name,source_language,target_language,source_hash,source_revision,status,requested_provider,max_attempts,input_characters,created_by,metadata)
  values(logical_identity,next_generation,encode(extensions.digest(concat_ws('|',logical_identity,next_generation::text,s.source_hash,s.source_revision::text),'sha256'),'hex'),s.resource_type,s.resource_id,s.field_name,s.source_language,s.target_language,s.source_hash,s.source_revision,'queued','libretranslate',p_max_attempts,p_input_characters,auth.uid(),jsonb_build_object('engine','3e3','state_id',s.id,'expected_lock_version',s.lock_version)) returning * into created;
  return created;
end $$;

create or replace function public.translation_admin_language_coverage(p_allowed_resource_types text[])
returns table(resource_type text,target_language text,total_fields bigint,completed_fields bigint,pending_fields bigint,
  automatic_review_fields bigint,stale_fields bigint,protected_fields bigint,error_fields bigint)
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if coalesce(array_length(p_allowed_resource_types,1),0)=0 then raise exception 'Recursos requeridos' using errcode='22023'; end if;
  return query select s.resource_type,s.target_language,count(*)::bigint,
    count(*) filter(where s.publication_status='published' and s.translated_source_hash=s.source_hash and s.translated_revision=s.source_revision and (s.status='reviewed' or(s.status='imported_unreviewed' and s.is_protected)))::bigint,
    count(*) filter(where(s.publication_status='published' and s.translated_source_hash=s.source_hash and s.translated_revision=s.source_revision and(s.status='reviewed' or(s.status='imported_unreviewed' and s.is_protected))) is not true)::bigint,
    count(*) filter(where s.status='machine_translated' or(s.workflow_status='draft' and s.translation_method='libretranslate'))::bigint,
    count(*) filter(where s.status='stale' or(s.translated_source_hash is not null and s.translated_revision is not null and(s.translated_source_hash is distinct from s.source_hash or s.translated_revision is distinct from s.source_revision)))::bigint,
    count(*) filter(where s.is_protected)::bigint,count(*) filter(where s.status='error')::bigint
  from public.translation_field_state s join public.languages l on l.code=s.target_language
  where s.resource_type=any(p_allowed_resource_types) and l.is_active and l.publication_status='published'
    and s.target_language<>public.translation_effective_source_language(s.resource_type,s.field_name)
    and(s.resource_type<>'account_plan_translation' or s.field_name<>'payout_frequency' or exists(select 1 from public.account_plans ap where ap.id::text=s.resource_id and nullif(btrim(ap.payout_frequency),'') is not null))
  group by s.resource_type,s.target_language order by s.resource_type,s.target_language;
end $$;
revoke all on function public.translation_admin_language_coverage(text[]) from public,anon,authenticated;
grant execute on function public.translation_admin_language_coverage(text[]) to service_role;

create or replace function public.translation_admin_content_center_summary(p_allowed_resource_types text[])
returns table(resources bigint,fields bigint,pending bigint,draft bigint,in_review bigint,approved bigint,published bigint,partial bigint,stale bigint,error bigint,queued_jobs bigint,running_jobs bigint,retry_jobs bigint,failed_jobs bigint)
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if coalesce(array_length(p_allowed_resource_types,1),0)=0 then raise exception 'Recursos requeridos' using errcode='22023'; end if;
  return query with applicable as(
    select s.* from public.translation_field_state s join public.languages l on l.code=s.target_language
    where s.resource_type=any(p_allowed_resource_types) and l.is_active and l.publication_status='published'
      and s.target_language<>public.translation_effective_source_language(s.resource_type,s.field_name)
      and(s.resource_type<>'account_plan_translation' or s.field_name<>'payout_frequency' or exists(select 1 from public.account_plans ap where ap.id::text=s.resource_id and nullif(btrim(ap.payout_frequency),'') is not null))
  ),grouped as(
    select s.resource_type,s.resource_id,count(*) total,
      count(*) filter(where(s.publication_status='published' and s.translated_source_hash=s.source_hash and s.translated_revision=s.source_revision and(s.status='reviewed' or(s.status='imported_unreviewed' and s.is_protected))) is not true) pending_count,
      count(*) filter(where s.workflow_status='draft') draft_count,count(*) filter(where s.workflow_status='in_review') review_count,
      count(*) filter(where s.workflow_status='approved') approved_count,
      count(*) filter(where s.publication_status='published' and s.translated_source_hash=s.source_hash and s.translated_revision=s.source_revision and(s.status='reviewed' or(s.status='imported_unreviewed' and s.is_protected))) published_count,
      count(*) filter(where s.status='stale' or(s.translated_source_hash is not null and s.translated_revision is not null and(s.translated_source_hash is distinct from s.source_hash or s.translated_revision is distinct from s.source_revision))) stale_count,
      count(*) filter(where s.status='error') error_count from applicable s group by s.resource_type,s.resource_id
  ),jobs as(select count(*) filter(where status='queued') queued,count(*) filter(where status='running') running,count(*) filter(where status='retry_wait') retry,count(*) filter(where status='failed') failed from public.translation_jobs where resource_type=any(p_allowed_resource_types))
  select count(*),coalesce(sum(g.total),0)::bigint,count(*) filter(where g.pending_count>0),count(*) filter(where g.draft_count>0),count(*) filter(where g.review_count>0),count(*) filter(where g.approved_count>0),count(*) filter(where g.total>0 and g.published_count=g.total),count(*) filter(where g.published_count>0 and g.published_count<g.total),count(*) filter(where g.stale_count>0),count(*) filter(where g.error_count>0),coalesce(max(j.queued),0),coalesce(max(j.running),0),coalesce(max(j.retry),0),coalesce(max(j.failed),0) from grouped g cross join jobs j;
end $$;
revoke all on function public.translation_admin_content_center_summary(text[]) from public,anon,authenticated;
grant execute on function public.translation_admin_content_center_summary(text[]) to service_role;

create or replace function public.translation_admin_content_center_inventory(
  p_allowed_resource_types text[],p_resource_type text default null,p_target_language text default null,p_bucket text default null,p_query text default null,p_page integer default 1,p_page_size integer default 25)
returns table(resource_type text,resource_id text,resource_label text,origin_href text,updated_at timestamptz,total_fields bigint,pending_count bigint,translated_count bigint,reviewed_count bigint,published_count bigint,stale_count bigint,protected_count bigint,en_total bigint,en_published bigint,pt_total bigint,pt_published bigint,draft_count bigint,in_review_count bigint,approved_count bigint,error_count bigint,language_progress jsonb,total_count bigint)
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if coalesce(array_length(p_allowed_resource_types,1),0)=0 or p_page<1 or p_page_size not between 1 and 100 or(p_bucket is not null and p_bucket not in('pending','draft','in_review','approved','published','partial','stale','error')) then raise exception 'Parámetros del Centro inválidos' using errcode='22023'; end if;
  return query with scoped as(
    select s.* from public.translation_field_state s join public.languages l on l.code=s.target_language
    where s.resource_type=any(p_allowed_resource_types) and l.is_active and l.publication_status='published'
      and s.target_language<>public.translation_effective_source_language(s.resource_type,s.field_name)
      and(s.resource_type<>'account_plan_translation' or s.field_name<>'payout_frequency' or exists(select 1 from public.account_plans ap where ap.id::text=s.resource_id and nullif(btrim(ap.payout_frequency),'') is not null))
      and(p_resource_type is null or s.resource_type=p_resource_type) and(p_target_language is null or s.target_language=p_target_language)
  ),g as(
    select s.resource_type,s.resource_id,max(s.updated_at) updated_at,count(*) total_fields,
      count(*) filter(where(s.publication_status='published' and s.translated_source_hash=s.source_hash and s.translated_revision=s.source_revision and(s.status='reviewed' or(s.status='imported_unreviewed' and s.is_protected))) is not true) pending_count,
      count(*) filter(where s.status not in('missing','queued')) translated_count,count(*) filter(where s.status='reviewed' or s.workflow_status='approved') reviewed_count,
      count(*) filter(where s.publication_status='published' and s.translated_source_hash=s.source_hash and s.translated_revision=s.source_revision and(s.status='reviewed' or(s.status='imported_unreviewed' and s.is_protected))) published_count,
      count(*) filter(where s.status='stale' or(s.translated_source_hash is not null and s.translated_revision is not null and(s.translated_source_hash is distinct from s.source_hash or s.translated_revision is distinct from s.source_revision))) stale_count,
      count(*) filter(where s.is_protected) protected_count,count(*) filter(where s.target_language='en') en_total,
      count(*) filter(where s.target_language='en' and s.publication_status='published') en_published,count(*) filter(where s.target_language='pt') pt_total,
      count(*) filter(where s.target_language='pt' and s.publication_status='published') pt_published,count(*) filter(where s.workflow_status='draft') draft_count,
      count(*) filter(where s.workflow_status='in_review') in_review_count,count(*) filter(where s.workflow_status='approved') approved_count,count(*) filter(where s.status='error') error_count,
      coalesce((select jsonb_object_agg(p.target_language,jsonb_build_object('total',p.total,'published',p.published)) from(select x.target_language,count(*) total,count(*) filter(where x.publication_status='published' and x.translated_source_hash=x.source_hash and x.translated_revision=x.source_revision and(x.status='reviewed' or(x.status='imported_unreviewed' and x.is_protected))) published from scoped x where x.resource_type=s.resource_type and x.resource_id=s.resource_id group by x.target_language)p),'{}'::jsonb) language_progress
    from scoped s group by s.resource_type,s.resource_id
  ),labeled as(
    select g.*,
      case g.resource_type
        when 'site_content' then g.resource_id
        when 'platform_translation' then coalesce((select p.name from public.platforms p where p.id::text=g.resource_id),'Plataforma · '||left(g.resource_id,8))
        when 'broker_detail_translation' then coalesce((select p.name from public.platforms p where p.id::text=g.resource_id),'Broker · '||left(g.resource_id,8))
        when 'exchange_detail_translation' then coalesce((select p.name from public.platforms p where p.id::text=g.resource_id),'Exchange · '||left(g.resource_id,8))
        when 'offer_translation' then coalesce((select o.title from public.offers o where o.id::text=g.resource_id),'Oferta · '||left(g.resource_id,8))
        when 'challenge_phase_translation' then coalesce((select 'Fase '||cp.phase_number::text from public.challenge_phases cp where cp.id::text=g.resource_id),'Fase · '||left(g.resource_id,8))
        when 'challenge_variant_translation' then coalesce((select cv.name from public.challenge_variants cv where cv.id::text=g.resource_id),'Variante · '||left(g.resource_id,8))
        when 'challenge_variant_phase_translation' then coalesce((select coalesce(cv.name,'Variante')||' · Fase '||cvp.phase_number::text from public.challenge_variant_phases cvp left join public.challenge_variants cv on cv.id=cvp.variant_id where cvp.id::text=g.resource_id),'Override · '||left(g.resource_id,8))
        when 'account_plan_translation' then coalesce((select 'Plan '||coalesce(ap.account_size::text,'sin tamaño')||coalesce(' '||ap.currency,'') from public.account_plans ap where ap.id::text=g.resource_id),'Plan · '||left(g.resource_id,8))
        when 'challenge_reward_translation' then coalesce((select cro.name from public.challenge_reward_options cro where cro.id::text=g.resource_id),'Reward · '||left(g.resource_id,8))
        when 'tool_translation' then coalesce((select t.name from public.tools t where t.id::text=g.resource_id),'Herramienta · '||left(g.resource_id,8))
        when 'community_translation' then coalesce((select c.name from public.communities c where c.id::text=g.resource_id),'Comunidad · '||left(g.resource_id,8))
        when 'giveaway_translation' then coalesce((select gv.title from public.giveaways gv where gv.id::text=g.resource_id),'Giveaway · '||left(g.resource_id,8))
        when 'blog_post_translation' then coalesce((select bp.title from public.blog_posts bp where bp.id::text=g.resource_id),'Artículo · '||left(g.resource_id,8)) else g.resource_type||' · '||left(g.resource_id,8) end resource_label,
      case g.resource_type when 'site_content' then '/admin/content/'||split_part(g.resource_id,'.',1) when 'platform_translation' then '/admin/platforms/'||g.resource_id||'/edit' when 'broker_detail_translation' then '/admin/brokers/'||g.resource_id||'/edit' when 'exchange_detail_translation' then '/admin/exchanges/'||g.resource_id||'/edit' when 'offer_translation' then '/admin/offers/'||g.resource_id when 'tool_translation' then '/admin/tools/'||g.resource_id||'/edit' when 'community_translation' then '/admin/communities/'||g.resource_id||'/edit' when 'giveaway_translation' then '/admin/giveaways/'||g.resource_id||'/edit' when 'blog_post_translation' then '/admin/blog/'||g.resource_id||'/edit' else '/admin/challenges' end origin_href
    from g
  ),filtered as(select * from labeled x where(nullif(btrim(p_query),'') is null or x.resource_label ilike '%'||replace(replace(p_query,'%',''),'_','')||'%' or x.resource_id ilike '%'||replace(replace(p_query,'%',''),'_','')||'%') and(p_bucket is null or(p_bucket='pending' and x.pending_count>0)or(p_bucket='draft' and x.draft_count>0)or(p_bucket='in_review' and x.in_review_count>0)or(p_bucket='approved' and x.approved_count>0)or(p_bucket='published' and x.total_fields>0 and x.published_count=x.total_fields)or(p_bucket='partial' and x.published_count>0 and x.published_count<x.total_fields)or(p_bucket='stale' and x.stale_count>0)or(p_bucket='error' and x.error_count>0)))
  select f.resource_type,f.resource_id,f.resource_label,f.origin_href,f.updated_at,f.total_fields,f.pending_count,f.translated_count,f.reviewed_count,f.published_count,f.stale_count,f.protected_count,f.en_total,f.en_published,f.pt_total,f.pt_published,f.draft_count,f.in_review_count,f.approved_count,f.error_count,f.language_progress,count(*) over() from filtered f order by f.updated_at desc,f.resource_type,f.resource_id offset(p_page-1)*p_page_size limit p_page_size;
end $$;
revoke all on function public.translation_admin_content_center_inventory(text[],text,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.translation_admin_content_center_inventory(text[],text,text,text,text,integer,integer) to service_role;

commit;
