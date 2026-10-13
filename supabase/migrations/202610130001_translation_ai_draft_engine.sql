begin;

-- Etapa 2 / Bloque 3E.3. LibreTranslate local solo produce borradores editoriales.
-- No se escriben tablas funcionales ni se publican traducciones.

create or replace function public.translation_request_ai_draft(
  p_state_id uuid,
  p_expected_lock_version bigint,
  p_input_characters integer,
  p_max_attempts integer default 3,
  p_daily_request_limit integer default 20,
  p_daily_character_limit integer default 100000,
  p_force boolean default false
)
returns public.translation_jobs
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  state_row public.translation_field_state%rowtype;
  existing_job public.translation_jobs%rowtype;
  created_job public.translation_jobs%rowtype;
  logical_identity text;
  next_generation integer;
  daily_requests bigint;
  daily_characters bigint;
begin
  select * into state_row from public.translation_field_state where id=p_state_id for update;
  if not found then raise exception 'Estado no encontrado' using errcode='P0002'; end if;
  perform public.translation_assert_admin_permission(state_row.resource_type);
  perform public.translation_editor_assert_version(state_row,p_expected_lock_version);
  perform public.translation_editor_assert_source(state_row);

  if state_row.target_language not in ('en','pt') then
    raise exception 'La generación automática está habilitada únicamente para EN/PT' using errcode='22023';
  end if;
  if state_row.is_protected then
    raise exception 'La traducción está protegida y no puede sobrescribirse automáticamente' using errcode='42501';
  end if;
  if state_row.workflow_status <> 'none' and not (
    p_force and state_row.workflow_status='draft' and state_row.translation_method='libretranslate'
  ) then
    raise exception 'Existe un borrador o revisión en curso' using errcode='55000';
  end if;
  if p_input_characters is null or p_input_characters < 1 or p_input_characters > 100000 then
    raise exception 'Tamaño de entrada no permitido' using errcode='22023';
  end if;
  if p_max_attempts not between 1 and 5
     or p_daily_request_limit not between 1 and 100
     or p_daily_character_limit not between 1 and 1000000 then
    raise exception 'Límites de consumo no permitidos' using errcode='22023';
  end if;

  select * into existing_job from public.translation_jobs
  where resource_type=state_row.resource_type and resource_id=state_row.resource_id
    and field_name=state_row.field_name and target_language=state_row.target_language
    and source_hash=state_row.source_hash and source_revision=state_row.source_revision
    and status in ('queued','running','retry_wait')
  order by created_at desc limit 1 for update;
  if found then return existing_job; end if;

  perform pg_advisory_xact_lock(hashtextextended('translation-ai-budget',0));
  select count(*),coalesce(sum(input_characters),0)
    into daily_requests,daily_characters
  from public.translation_jobs
  where metadata->>'engine'='3e3'
    and created_at >= date_trunc('day',now());
  if daily_requests >= p_daily_request_limit then raise exception 'Límite diario de solicitudes alcanzado' using errcode='54000'; end if;
  if daily_characters + p_input_characters > p_daily_character_limit then raise exception 'Límite diario de caracteres alcanzado' using errcode='54000'; end if;

  if p_force and state_row.workflow_status='draft' and state_row.translation_method='libretranslate' then
    update public.translation_field_state set
      workflow_status='none',draft_value=null,draft_source_hash=null,draft_source_revision=null,
      draft_updated_at=null,draft_updated_by=null,submitted_at=null,submitted_by=null,
      approved_at=null,approved_by=null,lock_version=lock_version+1,updated_at=now()
    where id=state_row.id returning * into state_row;
  end if;

  logical_identity := encode(extensions.digest(concat_ws('|',state_row.resource_type,state_row.resource_id,
    state_row.field_name,state_row.source_language,state_row.target_language),'sha256'),'hex');
  select coalesce(max(generation),0)+1 into next_generation
  from public.translation_jobs where logical_key=logical_identity;

  insert into public.translation_jobs(
    logical_key,generation,idempotency_key,resource_type,resource_id,field_name,
    source_language,target_language,source_hash,source_revision,status,requested_provider,
    max_attempts,input_characters,created_by,metadata
  ) values (
    logical_identity,next_generation,
    encode(extensions.digest(concat_ws('|',logical_identity,next_generation::text,state_row.source_hash,state_row.source_revision::text),'sha256'),'hex'),
    state_row.resource_type,state_row.resource_id,state_row.field_name,state_row.source_language,
    state_row.target_language,state_row.source_hash,state_row.source_revision,'queued','libretranslate',
    p_max_attempts,p_input_characters,auth.uid(),
    jsonb_build_object('engine','3e3','state_id',state_row.id,'expected_lock_version',state_row.lock_version)
  ) returning * into created_job;
  return created_job;
end $$;

create or replace function public.translation_claim_ai_jobs(
  p_worker_id text,p_limit integer default 5,p_lease_seconds integer default 90
)
returns setof public.translation_jobs
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if nullif(btrim(p_worker_id),'') is null or p_limit not between 1 and 20 or p_lease_seconds not between 15 and 300 then
    raise exception 'Parámetros de worker inválidos' using errcode='22023';
  end if;
  update public.translation_jobs set status=case when attempt_count < max_attempts then 'retry_wait' else 'failed' end,
    next_attempt_at=now(),completed_at=case when attempt_count >= max_attempts then now() else null end,
    error_code='lease_expired',last_error='El worker perdió el lease; el trabajo puede retomarse.',
    locked_at=null,locked_by=null,lease_expires_at=null,updated_at=now()
  where metadata->>'engine'='3e3' and status='running' and lease_expires_at <= now();

  return query
  with candidates as (
    select id from public.translation_jobs
    where metadata->>'engine'='3e3' and requested_provider='libretranslate'
      and status in ('queued','retry_wait') and next_attempt_at <= now()
      and attempt_count < max_attempts
    order by priority desc,created_at
    for update skip locked limit p_limit
  )
  update public.translation_jobs j set status='running',attempt_count=j.attempt_count+1,
    locked_at=now(),locked_by=p_worker_id,lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
    started_at=coalesce(j.started_at,now()),updated_at=now()
  from candidates c where j.id=c.id returning j.*;
end $$;

create or replace function public.translation_read_ai_job_source(p_job_id uuid,p_worker_id text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare job_row public.translation_jobs%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into job_row from public.translation_jobs where id=p_job_id;
  if not found or job_row.metadata->>'engine' <> '3e3' or job_row.status <> 'running'
    or job_row.locked_by is distinct from p_worker_id or job_row.lease_expires_at <= now() then
    raise exception 'Lease inválido o vencido' using errcode='55000';
  end if;
  return public.translation_read_value(job_row.resource_type,job_row.resource_id,job_row.field_name,job_row.source_language);
end $$;

create or replace function public.translation_claim_ai_job(
  p_job_id uuid,p_worker_id text,p_lease_seconds integer default 90
)
returns public.translation_jobs
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare job_row public.translation_jobs%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if nullif(btrim(p_worker_id),'') is null or p_lease_seconds not between 15 and 300 then
    raise exception 'Parámetros de lease inválidos' using errcode='22023';
  end if;
  select * into job_row from public.translation_jobs where id=p_job_id for update;
  if not found then raise exception 'Trabajo no encontrado' using errcode='P0002'; end if;
  if job_row.metadata->>'engine' <> '3e3' or job_row.status not in ('queued','retry_wait')
     or job_row.next_attempt_at > now() then
    raise exception 'Trabajo no reclamable' using errcode='55000';
  end if;
  update public.translation_jobs set status='running',attempt_count=attempt_count+1,
    locked_at=now(),locked_by=p_worker_id,lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
    started_at=coalesce(started_at,now()),updated_at=now()
  where id=p_job_id returning * into job_row;
  return job_row;
end $$;

create or replace function public.translation_complete_ai_job(
  p_job_id uuid,p_worker_id text,p_draft_value jsonb,p_model text,
  p_usage jsonb default '{}'::jsonb
)
returns bigint
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  job_row public.translation_jobs%rowtype;
  state_row public.translation_field_state%rowtype;
  new_version bigint;
  expected_version bigint;
begin
  if auth.role() <> 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  select s.* into state_row from public.translation_field_state s
  join public.translation_jobs j on j.resource_type=s.resource_type and j.resource_id=s.resource_id
    and j.field_name=s.field_name and j.target_language=s.target_language
  where j.id=p_job_id for update of s;
  if not found then raise exception 'Estado no encontrado' using errcode='P0002'; end if;
  select * into job_row from public.translation_jobs where id=p_job_id for update;
  expected_version := (job_row.metadata->>'expected_lock_version')::bigint;
  if job_row.metadata->>'engine' <> '3e3' or job_row.status <> 'running'
     or job_row.locked_by is distinct from p_worker_id or job_row.lease_expires_at <= now() then
    raise exception 'Lease inválido o vencido' using errcode='55000';
  end if;
  if state_row.lock_version <> expected_version or state_row.source_hash <> job_row.source_hash
     or state_row.source_revision <> job_row.source_revision then
    raise exception 'La traducción cambió durante la generación' using errcode='40001';
  end if;
  if state_row.is_protected or state_row.workflow_status <> 'none' then
    raise exception 'La traducción quedó protegida o entró en revisión' using errcode='42501';
  end if;
  perform public.translation_editor_assert_source(state_row);
  perform public.translation_validate_editor_value(state_row.resource_type,state_row.field_name,p_draft_value);

  update public.translation_field_state set
    draft_value=p_draft_value,draft_source_hash=source_hash,draft_source_revision=source_revision,
    workflow_status='draft',draft_updated_at=now(),draft_updated_by=job_row.created_by,
    submitted_at=null,submitted_by=null,approved_at=null,approved_by=null,
    status=case when publication_status='published' then status else 'machine_translated' end,
    translation_method='libretranslate',provider='libretranslate-local',
    last_error_code=null,last_error=null,lock_version=lock_version+1,updated_at=now()
  where id=state_row.id returning lock_version into new_version;

  update public.translation_jobs set status='succeeded',provider_used='libretranslate-local',
    output_characters=coalesce((p_usage->>'output_characters')::integer,0),
    input_tokens=coalesce((p_usage->>'input_tokens')::integer,0),
    output_tokens=coalesce((p_usage->>'output_tokens')::integer,0),
    -- El motor 3E.3 es exclusivamente local y nunca registra coste comercial.
    estimated_cost_usd=0,
    metadata=metadata||jsonb_build_object(
      'model',nullif(btrim(p_model),''),
      'usage',coalesce(p_usage,'{}'::jsonb)||jsonb_build_object('estimated_cost_usd',0)
    ),
    completed_at=now(),locked_at=null,locked_by=null,lease_expires_at=null,updated_at=now()
  where id=job_row.id;
  return new_version;
end $$;

create or replace function public.translation_fail_ai_job(
  p_job_id uuid,p_worker_id text,p_error_code text,p_error text,p_retry boolean default false
)
returns text
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare job_row public.translation_jobs%rowtype; state_row public.translation_field_state%rowtype; next_status text;
begin
  if auth.role() <> 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  select s.* into state_row from public.translation_field_state s
  join public.translation_jobs j on j.resource_type=s.resource_type and j.resource_id=s.resource_id
    and j.field_name=s.field_name and j.target_language=s.target_language
  where j.id=p_job_id for update of s;
  if not found then raise exception 'Estado no encontrado' using errcode='P0002'; end if;
  select * into job_row from public.translation_jobs where id=p_job_id for update;
  if not found then raise exception 'Trabajo no encontrado' using errcode='P0002'; end if;
  if job_row.metadata->>'engine' <> '3e3' or job_row.status <> 'running'
     or job_row.locked_by is distinct from p_worker_id or job_row.lease_expires_at <= now() then
    raise exception 'Lease inválido o vencido' using errcode='55000';
  end if;
  next_status := case when p_retry and job_row.attempt_count < job_row.max_attempts then 'retry_wait' else 'failed' end;
  update public.translation_jobs set status=next_status,error_code=left(coalesce(p_error_code,'provider_error'),100),
    last_error=left(coalesce(p_error,'Error del proveedor'),2000),
    next_attempt_at=case when next_status='retry_wait' then now()+make_interval(secs=>least(300,15*job_row.attempt_count)) else next_attempt_at end,
    completed_at=case when next_status='failed' then now() else null end,
    locked_at=null,locked_by=null,lease_expires_at=null,updated_at=now()
  where id=job_row.id;
  update public.translation_field_state set last_error_code=left(coalesce(p_error_code,'provider_error'),100),
    last_error=left(coalesce(p_error,'Error del proveedor'),2000),updated_at=now()
  where resource_type=job_row.resource_type and resource_id=job_row.resource_id
    and field_name=job_row.field_name and target_language=job_row.target_language
    and source_hash=job_row.source_hash and source_revision=job_row.source_revision
    and lock_version=(job_row.metadata->>'expected_lock_version')::bigint;
  return next_status;
end $$;

revoke all on function public.translation_request_ai_draft(uuid,bigint,integer,integer,integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.translation_request_ai_draft(uuid,bigint,integer,integer,integer,integer,boolean) to authenticated;
revoke all on function public.translation_claim_ai_jobs(text,integer,integer) from public,anon,authenticated;
revoke all on function public.translation_read_ai_job_source(uuid,text) from public,anon,authenticated;
revoke all on function public.translation_claim_ai_job(uuid,text,integer) from public,anon,authenticated;
revoke all on function public.translation_complete_ai_job(uuid,text,jsonb,text,jsonb) from public,anon,authenticated;
revoke all on function public.translation_fail_ai_job(uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.translation_claim_ai_job(uuid,text,integer) to service_role;
grant execute on function public.translation_claim_ai_jobs(text,integer,integer) to service_role;
grant execute on function public.translation_read_ai_job_source(uuid,text) to service_role;
grant execute on function public.translation_complete_ai_job(uuid,text,jsonb,text,jsonb) to service_role;
grant execute on function public.translation_fail_ai_job(uuid,text,text,text,boolean) to service_role;

-- Evita que el flujo administrativo antiguo solicite trabajos que escriben
-- directamente en las tablas funcionales. Los workers existentes conservan
-- sus grants para compatibilidad, pero ya no hay una entrada autenticada.
revoke execute on function public.translation_request_regeneration(text,text,text,text,text,boolean) from authenticated;

commit;
