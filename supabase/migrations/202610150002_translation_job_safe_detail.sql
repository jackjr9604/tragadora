begin;

-- 3E.8 Fase 3.2A: detalle administrativo seguro y de solo lectura.
-- No modifica translation_jobs, translation_field_state ni el comportamiento de la cola.

create or replace function public.translation_admin_job_detail(
  p_job_id uuid,
  p_allowed_resource_types text[]
)
returns table(
  id uuid,
  resource_type text,
  resource_id text,
  field_name text,
  source_language text,
  target_language text,
  status text,
  requested_provider text,
  provider_used text,
  priority smallint,
  attempt_count integer,
  max_attempts integer,
  next_attempt_at timestamptz,
  lease_expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  input_characters integer,
  output_characters integer,
  duration_seconds bigint,
  error_code text,
  error_category text,
  error_summary text,
  error_recoverable boolean,
  requires_human_review boolean,
  editorial_state_exists boolean,
  editorial_status text,
  workflow_status text,
  publication_status text,
  is_protected boolean,
  source_is_current boolean,
  editorial_updated_at timestamptz
)
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
begin
  if p_job_id is null then
    raise exception 'Job obligatorio' using errcode='22023';
  end if;

  -- Reutiliza la validación del inventario. La autorización real se deriva en
  -- servidor de los permisos del usuario; el navegador nunca controla esta lista.
  perform public.translation_admin_jobs_validate_filters(
    p_allowed_resource_types,null,null,null,null,null,null,null,null,null,
    'created_desc',1,25
  );

  return query
  select
    j.id,j.resource_type,j.resource_id,j.field_name,j.source_language,j.target_language,
    j.status,j.requested_provider,j.provider_used,j.priority,j.attempt_count,j.max_attempts,
    j.next_attempt_at,j.lease_expires_at,j.started_at,j.completed_at,j.created_at,j.updated_at,
    j.input_characters,j.output_characters,
    case when j.started_at is null then null
      else greatest(0,extract(epoch from (coalesce(j.completed_at,j.updated_at)-j.started_at))::bigint)
    end,
    j.error_code,
    case
      when j.error_code='local_provider_unavailable'
        or (j.error_code='translation_failed' and j.last_error='fetch failed' and j.requested_provider='libretranslate')
        then 'recoverable_connectivity'
      when j.error_code='lease_expired' then 'lease_expired'
      when j.error_code in ('source_changed','source_state_mismatch','source_language_disabled','field_disabled','language_became_source')
        then 'source_unavailable'
      when j.error_code in ('protected','manual_override','manual_draft')
        then 'editorial_conflict'
      when j.error_code='translation_failed' and (
        lower(coalesce(j.last_error,'')) like any(array[
          '%markdown%','%enlace%','%link%','%código%','%codigo%','%variable%',
          '%marcador%','%estructura%','%contenido protegido%'
        ])
      ) then 'protected_content_validation'
      when j.error_code is null then null
      else 'unknown'
    end,
    case
      when j.error_code='local_provider_unavailable'
        or (j.error_code='translation_failed' and j.last_error='fetch failed' and j.requested_provider='libretranslate')
        then 'LibreTranslate local no estuvo disponible. El trabajo puede recuperarse cuando el proveedor vuelva a responder.'
      when j.error_code='lease_expired'
        then 'El worker no terminó dentro del lease. Puede reanudarse de forma segura si la fuente continúa vigente.'
      when j.error_code in ('source_changed','source_state_mismatch')
        then 'El contenido fuente cambió después de crear el trabajo. Debe solicitarse una traducción para la revisión vigente.'
      when j.error_code in ('source_language_disabled','field_disabled','language_became_source')
        then 'El recurso, campo o idioma dejó de ser traducible para este trabajo.'
      when j.error_code='protected'
        then 'La traducción está protegida y el resultado automático fue descartado.'
      when j.error_code in ('manual_override','manual_draft')
        then 'Una edición manual o un borrador editorial sustituyó este trabajo.'
      when j.error_code='translation_failed' and (
        lower(coalesce(j.last_error,'')) like any(array[
          '%markdown%','%enlace%','%link%','%código%','%codigo%','%variable%',
          '%marcador%','%estructura%','%contenido protegido%'
        ])
      ) then 'El resultado alteró estructura o contenido protegido y fue rechazado. Requiere revisión humana.'
      when j.error_code is null then null
      else 'El trabajo terminó con un error no clasificado. Requiere revisión humana antes de reintentarlo.'
    end,
    case
      when j.error_code='lease_expired' and j.status='retry_wait' then true
      when (
        j.error_code='local_provider_unavailable'
        or (j.error_code='translation_failed' and j.last_error='fetch failed')
      ) and j.requested_provider='libretranslate' and j.metadata->>'engine'='3e3'
        and (
          j.status in ('queued','retry_wait')
          or (
            j.status='failed'
            and s.id is not null
            and s.source_hash=j.source_hash and s.source_revision=j.source_revision
            and s.lock_version=case
              when coalesce(j.metadata->>'expected_lock_version','')~'^[0-9]+$'
              then (j.metadata->>'expected_lock_version')::bigint else null end
            and not s.is_protected and s.workflow_status='none' and s.publication_status<>'published'
            and not exists(
              select 1 from public.translation_jobs active
              where active.id<>j.id and active.resource_type=j.resource_type
                and active.resource_id=j.resource_id and active.field_name=j.field_name
                and active.target_language=j.target_language and active.source_hash=j.source_hash
                and active.source_revision=j.source_revision
                and active.status in ('queued','running','retry_wait')
            )
          )
        ) then true
      else false
    end,
    case
      when j.error_code is null then false
      when j.error_code='lease_expired' and j.status='retry_wait' then false
      when (
        j.error_code='local_provider_unavailable'
        or (j.error_code='translation_failed' and j.last_error='fetch failed')
      ) and j.requested_provider='libretranslate' and j.metadata->>'engine'='3e3'
        and (
          j.status in ('queued','retry_wait')
          or (
            j.status='failed'
            and s.id is not null
            and s.source_hash=j.source_hash and s.source_revision=j.source_revision
            and s.lock_version=case
              when coalesce(j.metadata->>'expected_lock_version','')~'^[0-9]+$'
              then (j.metadata->>'expected_lock_version')::bigint else null end
            and not s.is_protected and s.workflow_status='none' and s.publication_status<>'published'
            and not exists(
              select 1 from public.translation_jobs active
              where active.id<>j.id and active.resource_type=j.resource_type
                and active.resource_id=j.resource_id and active.field_name=j.field_name
                and active.target_language=j.target_language and active.source_hash=j.source_hash
                and active.source_revision=j.source_revision
                and active.status in ('queued','running','retry_wait')
            )
          )
        ) then false
      else true
    end,
    s.id is not null,
    s.status,
    s.workflow_status,
    s.publication_status,
    coalesce(s.is_protected,false),
    coalesce(s.source_hash=j.source_hash and s.source_revision=j.source_revision,false),
    s.updated_at
  from public.translation_jobs j
  left join public.translation_field_state s
    on s.resource_type=j.resource_type and s.resource_id=j.resource_id
    and s.field_name=j.field_name and s.target_language=j.target_language
  where j.id=p_job_id and j.resource_type=any(p_allowed_resource_types);
end
$$;

revoke all on function public.translation_admin_job_detail(uuid,text[]) from public,anon,authenticated;
grant execute on function public.translation_admin_job_detail(uuid,text[]) to service_role;

commit;
