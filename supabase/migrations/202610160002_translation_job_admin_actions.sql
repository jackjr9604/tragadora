begin;

-- 3E.8 Fase 3.2C.2: reintentos y cancelaciones administrativas seguras.
-- Las acciones conservan el historial: un reintento siempre crea (o reutiliza)
-- una generación nueva y nunca reabre el trabajo terminal original.

create or replace function public.translation_admin_retry_job(
  p_job_id uuid,
  p_expected_job_updated_at timestamptz,
  p_expected_state_lock_version bigint,
  p_daily_request_limit integer default 20,
  p_daily_character_limit integer default 100000
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  initial_job public.translation_jobs%rowtype;
  job_row public.translation_jobs%rowtype;
  state_row public.translation_field_state%rowtype;
  new_job public.translation_jobs%rowtype;
  actor uuid:=auth.uid();
  recoverable boolean;
begin
  if auth.role()<>'authenticated' or actor is null then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if p_job_id is null or p_expected_job_updated_at is null
     or p_expected_state_lock_version is null or p_expected_state_lock_version<1 then
    raise exception 'Parámetros de concurrencia obligatorios' using errcode='22023';
  end if;
  if p_daily_request_limit not between 1 and 100
     or p_daily_character_limit not between 1 and 1000000 then
    raise exception 'Límites de consumo no permitidos' using errcode='22023';
  end if;

  -- Lectura inicial sin lock para localizar el estado. Después se respeta el
  -- mismo orden state -> job utilizado por complete/fail.
  select * into initial_job from public.translation_jobs where id=p_job_id;
  if not found then raise exception 'Trabajo no encontrado' using errcode='P0002'; end if;
  perform public.translation_assert_admin_permission(initial_job.resource_type);

  select * into state_row from public.translation_field_state
  where resource_type=initial_job.resource_type and resource_id=initial_job.resource_id
    and field_name=initial_job.field_name and target_language=initial_job.target_language
  for update;
  if not found then raise exception 'Estado editorial no encontrado' using errcode='P0002'; end if;

  select * into job_row from public.translation_jobs where id=p_job_id for update;
  if not found then raise exception 'Trabajo no encontrado' using errcode='P0002'; end if;
  if job_row.resource_type<>state_row.resource_type or job_row.resource_id<>state_row.resource_id
     or job_row.field_name<>state_row.field_name or job_row.target_language<>state_row.target_language then
    raise exception 'El trabajo cambió durante la operación' using errcode='40001';
  end if;
  if job_row.updated_at<>p_expected_job_updated_at
     or state_row.lock_version<>p_expected_state_lock_version then
    raise exception 'El trabajo o la traducción cambió en otra sesión' using errcode='40001';
  end if;

  recoverable := job_row.metadata->>'engine'='3e3'
    and job_row.requested_provider='libretranslate'
    and (
      (job_row.status='failed' and (
        job_row.error_code in ('local_provider_unavailable','lease_expired')
        or (job_row.error_code='translation_failed' and job_row.last_error='fetch failed')
      ))
      or (job_row.status='cancelled' and job_row.error_code='admin_cancelled')
    );
  if not recoverable then
    raise exception 'Este trabajo no admite un reintento administrativo seguro' using errcode='55000';
  end if;
  if state_row.source_hash<>job_row.source_hash
     or state_row.source_revision<>job_row.source_revision
     or coalesce(job_row.metadata->>'expected_lock_version','')!~'^[0-9]+$'
     or (job_row.metadata->>'expected_lock_version')::bigint<>state_row.lock_version then
    raise exception 'La fuente o su revisión cambió; solicita una traducción desde el recurso actual' using errcode='40001';
  end if;
  if state_row.is_protected or state_row.workflow_status<>'none'
     or state_row.publication_status='published' then
    raise exception 'La traducción está protegida o tiene un estado editorial activo' using errcode='42501';
  end if;
  if job_row.input_characters is null or job_row.input_characters<1 then
    raise exception 'El trabajo no conserva un tamaño de entrada válido' using errcode='55000';
  end if;

  perform public.translation_editor_assert_source(state_row);
  if not exists(
    select 1 from public.languages l
    where l.code=state_row.source_language and l.is_active
  ) or not exists(
    select 1 from public.languages l
    where l.code=state_row.target_language and l.is_active and l.auto_translate
      and coalesce(l.publication_status,'published')='published'
  ) then
    raise exception 'El idioma fuente o destino no está habilitado para traducción automática' using errcode='55000';
  end if;

  -- La función existente conserva cuotas, idempotencia y el índice único de
  -- trabajos activos. Una llamada concurrente reutiliza la generación creada.
  new_job:=public.translation_request_ai_draft(
    state_row.id,state_row.lock_version,job_row.input_characters,
    least(job_row.max_attempts,5),p_daily_request_limit,p_daily_character_limit,false
  );

  insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value)
  values(
    actor,'translation_job_retry','translations',
    jsonb_build_object('job_id',job_row.id,'status',job_row.status),
    jsonb_build_object('job_id',new_job.id,'status',new_job.status,
      'resource_type',job_row.resource_type)
  );
  return new_job.id;
end
$$;

create or replace function public.translation_admin_cancel_job(
  p_job_id uuid,
  p_expected_job_updated_at timestamptz,
  p_expected_state_lock_version bigint
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  initial_job public.translation_jobs%rowtype;
  job_row public.translation_jobs%rowtype;
  state_row public.translation_field_state%rowtype;
  actor uuid:=auth.uid();
  restored_status text;
begin
  if auth.role()<>'authenticated' or actor is null then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if p_job_id is null or p_expected_job_updated_at is null
     or p_expected_state_lock_version is null or p_expected_state_lock_version<1 then
    raise exception 'Parámetros de concurrencia obligatorios' using errcode='22023';
  end if;

  select * into initial_job from public.translation_jobs where id=p_job_id;
  if not found then raise exception 'Trabajo no encontrado' using errcode='P0002'; end if;
  perform public.translation_assert_admin_permission(initial_job.resource_type);

  select * into state_row from public.translation_field_state
  where resource_type=initial_job.resource_type and resource_id=initial_job.resource_id
    and field_name=initial_job.field_name and target_language=initial_job.target_language
  for update;
  if not found then raise exception 'Estado editorial no encontrado' using errcode='P0002'; end if;

  select * into job_row from public.translation_jobs where id=p_job_id for update;
  if not found then raise exception 'Trabajo no encontrado' using errcode='P0002'; end if;
  if job_row.resource_type<>state_row.resource_type or job_row.resource_id<>state_row.resource_id
     or job_row.field_name<>state_row.field_name or job_row.target_language<>state_row.target_language then
    raise exception 'El trabajo cambió durante la operación' using errcode='40001';
  end if;

  -- Una segunda solicitud de cancelación es un no-op seguro aunque conserve
  -- los tokens de concurrencia originales.
  if job_row.status='cancelled' and job_row.error_code='admin_cancelled' then
    return job_row.id;
  end if;
  if job_row.updated_at<>p_expected_job_updated_at
     or state_row.lock_version<>p_expected_state_lock_version then
    raise exception 'El trabajo o la traducción cambió en otra sesión' using errcode='40001';
  end if;
  if state_row.is_protected or state_row.workflow_status<>'none'
     or state_row.publication_status='published' then
    raise exception 'No se puede cancelar sobre contenido protegido, aprobado o publicado' using errcode='42501';
  end if;
  if job_row.status not in ('queued','retry_wait','running') then
    raise exception 'El trabajo ya terminó y no puede cancelarse' using errcode='55000';
  end if;
  if job_row.status='running' and (job_row.lease_expires_at is null or job_row.lease_expires_at>now()) then
    raise exception 'El trabajo tiene un lease vigente; espera a que termine o venza' using errcode='55000';
  end if;

  update public.translation_jobs set
    status='cancelled',completed_at=now(),error_code='admin_cancelled',
    last_error='Cancelado por un administrador autorizado.',
    locked_at=null,locked_by=null,lease_expires_at=null,updated_at=now()
  where id=job_row.id;

  -- Los jobs 3E.3 no cambian el estado a queued. Esta restauración solo cubre
  -- generaciones antiguas que sí lo hacían y únicamente si no queda otra activa.
  if state_row.status='queued' and not exists(
    select 1 from public.translation_jobs active
    where active.id<>job_row.id and active.resource_type=job_row.resource_type
      and active.resource_id=job_row.resource_id and active.field_name=job_row.field_name
      and active.target_language=job_row.target_language
      and active.status in ('queued','running','retry_wait')
  ) then
    restored_status:=case
      when state_row.translated_revision is null then 'missing'
      when state_row.translated_source_hash is distinct from state_row.source_hash
        or state_row.translated_revision is distinct from state_row.source_revision then 'stale'
      when state_row.reviewed_at is not null then 'reviewed'
      when state_row.translation_method='libretranslate' then 'machine_translated'
      else 'imported_unreviewed'
    end;
    update public.translation_field_state set status=restored_status,
      last_error_code=null,last_error=null,updated_at=now()
    where id=state_row.id and status='queued';
  end if;

  insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value)
  values(
    actor,'translation_job_cancel','translations',
    jsonb_build_object('job_id',job_row.id,'status',job_row.status),
    jsonb_build_object('job_id',job_row.id,'status','cancelled',
      'resource_type',job_row.resource_type)
  );
  return job_row.id;
end
$$;

revoke all on function public.translation_admin_retry_job(uuid,timestamptz,bigint,integer,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.translation_admin_retry_job(uuid,timestamptz,bigint,integer,integer)
  to authenticated;
revoke all on function public.translation_admin_cancel_job(uuid,timestamptz,bigint)
  from public,anon,authenticated,service_role;
grant execute on function public.translation_admin_cancel_job(uuid,timestamptz,bigint)
  to authenticated;

commit;
