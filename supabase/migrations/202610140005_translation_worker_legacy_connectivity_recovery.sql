begin;

-- Recuperación puntual de fallos legacy creados antes de que el worker
-- distinguiera indisponibilidad local de errores de validación de contenido.
-- No crea jobs, no altera estados editoriales y no recupera fallos de seguridad.

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
    where j.metadata->>'engine'='3e3'
      and j.requested_provider='libretranslate'
      and j.status='failed'
      and (
        j.error_code='local_provider_unavailable'
        or (j.error_code='translation_failed' and j.last_error='fetch failed')
      )
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
  update public.translation_jobs j set
    status='queued',attempt_count=0,next_attempt_at=now(),completed_at=null,
    error_code=null,last_error=null,locked_at=null,locked_by=null,lease_expires_at=null,
    metadata=j.metadata||jsonb_build_object(
      'recovered_from',case
        when j.error_code='local_provider_unavailable' then 'local_provider_unavailable'
        else 'legacy_translation_failed_fetch'
      end,
      'recovered_at',now()
    ),
    updated_at=now()
  from candidates c where j.id=c.id returning j.*;
end $$;

revoke all on function public.translation_recover_local_provider_jobs(integer) from public,anon,authenticated;
grant execute on function public.translation_recover_local_provider_jobs(integer) to service_role;

commit;
