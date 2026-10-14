begin;

-- Bloque 3E.7 / corrección operativa del worker local.
-- LibreTranslate debe estar disponible antes de reclamar trabajos. Las caídas del
-- proveedor no consumen intentos y los fallos legacy pueden recuperarse sin crear
-- jobs nuevos ni tocar borradores/publicaciones.

create or replace function public.translation_worker_report_languages(p_supported_codes text[])
returns void
language plpgsql security definer
set search_path=pg_catalog,public
as $$
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_supported_codes is null or exists(
    select 1 from unnest(p_supported_codes) code
    where code is null or lower(btrim(code)) !~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$'
  ) then
    raise exception 'Catálogo de idiomas inválido' using errcode='22023';
  end if;

  update public.languages set
    libretranslate_status=case when lower(code) in (
      select lower(btrim(item)) from unnest(p_supported_codes) item
    ) then 'supported' else 'unsupported' end,
    libretranslate_checked_at=now(),
    updated_at=case when libretranslate_status is distinct from (case when lower(code) in (
      select lower(btrim(item)) from unnest(p_supported_codes) item
    ) then 'supported' else 'unsupported' end) then now() else updated_at end,
    lock_version=case when libretranslate_status is distinct from (case when lower(code) in (
      select lower(btrim(item)) from unnest(p_supported_codes) item
    ) then 'supported' else 'unsupported' end) then lock_version+1 else lock_version end
  where code is not null and (
    libretranslate_status is distinct from (case when lower(code) in (
      select lower(btrim(item)) from unnest(p_supported_codes) item
    ) then 'supported' else 'unsupported' end)
    or libretranslate_checked_at is null
    or libretranslate_checked_at<now()-interval '5 minutes'
  );
end $$;

create or replace function public.translation_claim_ready_ai_jobs(
  p_worker_id text,p_supported_codes text[],p_limit integer default 5,p_lease_seconds integer default 90
)
returns setof public.translation_jobs
language plpgsql security definer
set search_path=pg_catalog,public
as $$
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if nullif(btrim(p_worker_id),'') is null or p_limit not between 1 and 20
     or p_lease_seconds not between 15 and 300 or p_supported_codes is null
     or exists(select 1 from unnest(p_supported_codes) code where code is null or lower(btrim(code))!~'^[a-z]{2,3}(-[a-z0-9]{2,8})?$') then
    raise exception 'Parámetros de worker inválidos' using errcode='22023';
  end if;

  update public.translation_jobs set
    status=case when attempt_count<max_attempts then 'retry_wait' else 'failed' end,
    next_attempt_at=now(),completed_at=case when attempt_count>=max_attempts then now() else null end,
    error_code='lease_expired',last_error='El worker perdió el lease; el trabajo puede retomarse.',
    locked_at=null,locked_by=null,lease_expires_at=null,updated_at=now()
  where metadata->>'engine'='3e3' and status='running' and lease_expires_at<=now();

  return query
  with candidates as (
    select j.id from public.translation_jobs j
    join public.translation_field_state s
      on s.resource_type=j.resource_type and s.resource_id=j.resource_id
     and s.field_name=j.field_name and s.target_language=j.target_language
    where j.metadata->>'engine'='3e3' and j.requested_provider='libretranslate'
      and j.status in ('queued','retry_wait') and j.next_attempt_at<=now()
      and j.attempt_count<j.max_attempts
      and lower(j.source_language) in (select lower(btrim(code)) from unnest(p_supported_codes) code)
      and lower(j.target_language) in (select lower(btrim(code)) from unnest(p_supported_codes) code)
      and s.source_hash=j.source_hash and s.source_revision=j.source_revision
      and s.lock_version=(j.metadata->>'expected_lock_version')::bigint
      and not s.is_protected and s.workflow_status='none' and s.publication_status<>'published'
    order by j.priority desc,j.created_at
    for update of j skip locked limit p_limit
  )
  update public.translation_jobs j set status='running',attempt_count=j.attempt_count+1,
    locked_at=now(),locked_by=p_worker_id,lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
    started_at=coalesce(j.started_at,now()),updated_at=now()
  from candidates c where j.id=c.id returning j.*;
end $$;

create or replace function public.translation_release_ai_job_provider_unavailable(
  p_job_id uuid,p_worker_id text,p_error text
)
returns void
language plpgsql security definer
set search_path=pg_catalog,public
as $$
declare job_row public.translation_jobs%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into job_row from public.translation_jobs where id=p_job_id for update;
  if not found then raise exception 'Trabajo no encontrado' using errcode='P0002'; end if;
  if job_row.metadata->>'engine'<>'3e3' or job_row.status<>'running'
     or job_row.locked_by is distinct from p_worker_id or job_row.lease_expires_at<=now() then
    raise exception 'Lease inválido o vencido' using errcode='55000';
  end if;
  update public.translation_jobs set status='queued',attempt_count=greatest(0,attempt_count-1),
    next_attempt_at=now()+interval '15 seconds',completed_at=null,
    error_code='local_provider_unavailable',last_error=left(coalesce(p_error,'LibreTranslate local no disponible'),2000),
    locked_at=null,locked_by=null,lease_expires_at=null,updated_at=now()
  where id=job_row.id;
end $$;

create or replace function public.translation_recover_local_provider_jobs(p_limit integer default 50)
returns setof public.translation_jobs
language plpgsql security definer
set search_path=pg_catalog,public
as $$
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_limit not between 1 and 100 then raise exception 'Límite inválido' using errcode='22023'; end if;

  return query
  with candidates as (
    select j.id from public.translation_jobs j
    join public.translation_field_state s
      on s.resource_type=j.resource_type and s.resource_id=j.resource_id
     and s.field_name=j.field_name and s.target_language=j.target_language
    where j.metadata->>'engine'='3e3' and j.requested_provider='libretranslate'
      and j.status='failed' and j.error_code='local_provider_unavailable'
      and s.source_hash=j.source_hash and s.source_revision=j.source_revision
      and s.lock_version=(j.metadata->>'expected_lock_version')::bigint
      and not s.is_protected and s.workflow_status='none' and s.publication_status<>'published'
      and not exists(
        select 1 from public.translation_jobs active
        where active.id<>j.id and active.resource_type=j.resource_type and active.resource_id=j.resource_id
          and active.field_name=j.field_name and active.target_language=j.target_language
          and active.source_hash=j.source_hash and active.source_revision=j.source_revision
          and active.status in ('queued','running','retry_wait')
      )
    order by j.created_at
    for update of j skip locked limit p_limit
  )
  update public.translation_jobs j set status='queued',attempt_count=0,next_attempt_at=now(),
    completed_at=null,error_code=null,last_error=null,locked_at=null,locked_by=null,lease_expires_at=null,
    metadata=j.metadata||jsonb_build_object('recovered_from','local_provider_unavailable','recovered_at',now()),updated_at=now()
  from candidates c where j.id=c.id returning j.*;
end $$;

revoke all on function public.translation_worker_report_languages(text[]) from public,anon,authenticated;
revoke all on function public.translation_claim_ready_ai_jobs(text,text[],integer,integer) from public,anon,authenticated;
revoke all on function public.translation_release_ai_job_provider_unavailable(uuid,text,text) from public,anon,authenticated;
revoke all on function public.translation_recover_local_provider_jobs(integer) from public,anon,authenticated;
grant execute on function public.translation_worker_report_languages(text[]) to service_role;
grant execute on function public.translation_claim_ready_ai_jobs(text,text[],integer,integer) to service_role;
grant execute on function public.translation_release_ai_job_provider_unavailable(uuid,text,text) to service_role;
grant execute on function public.translation_recover_local_provider_jobs(integer) to service_role;

commit;
