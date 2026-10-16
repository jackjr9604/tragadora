\set ON_ERROR_STOP on

begin;

do $$
declare
  detail record;
  test_resource_type text;
  test_field_name text;
  other_resource_type text;
  before_jobs jsonb;
  before_states jsonb;
begin
  if has_function_privilege('anon','public.translation_admin_job_detail(uuid,text[])','EXECUTE')
     or has_function_privilege('authenticated','public.translation_admin_job_detail(uuid,text[])','EXECUTE') then
    raise exception 'RPC de detalle expuesta a roles no autorizados';
  end if;
  if not has_function_privilege('service_role','public.translation_admin_job_detail(uuid,text[])','EXECUTE') then
    raise exception 'service_role no puede consultar detalle';
  end if;

  perform set_config('request.jwt.claim.role','service_role',true);

  select f.resource_type,f.field_name into test_resource_type,test_field_name
  from public.translation_resource_fields f
  join public.translation_resource_types r on r.resource_type=f.resource_type and r.enabled
  order by f.resource_type,f.field_name limit 1;
  if test_resource_type is null then raise exception 'No hay campos traducibles para probar'; end if;
  select r.resource_type into other_resource_type
  from public.translation_resource_types r
  where r.enabled and r.resource_type<>test_resource_type order by r.resource_type limit 1;
  if other_resource_type is null then raise exception 'Se requieren dos recursos registrados para probar aislamiento'; end if;

  insert into public.translation_field_state(
    id,resource_type,resource_id,field_name,source_language,target_language,
    source_hash,source_revision,status,workflow_status,publication_status,is_protected,lock_version
  ) values
    ('31000000-0000-4000-8000-000000000001',test_resource_type,'safe-detail-connectivity',test_field_name,'es','en',repeat('a',64),1,'error','none','unpublished',false,1),
    ('31000000-0000-4000-8000-000000000002',test_resource_type,'safe-detail-validation',test_field_name,'es','en',repeat('b',64),1,'error','none','unpublished',false,1),
    ('31000000-0000-4000-8000-000000000003',test_resource_type,'safe-detail-lease',test_field_name,'es','en',repeat('c',64),1,'error','none','unpublished',false,1);

  insert into public.translation_jobs(
    id,logical_key,generation,idempotency_key,resource_type,resource_id,field_name,
    source_language,target_language,source_hash,source_revision,status,requested_provider,
    attempt_count,max_attempts,error_code,last_error,started_at,completed_at,metadata
  ) values
    ('32000000-0000-4000-8000-000000000001',repeat('1',64),1,repeat('2',64),test_resource_type,'safe-detail-connectivity',test_field_name,'es','en',repeat('a',64),1,'failed','libretranslate',3,3,'local_provider_unavailable','endpoint and credential must stay private',now()-interval '2 minutes',now()-interval '1 minute',jsonb_build_object('engine','3e3','expected_lock_version',1)),
    ('32000000-0000-4000-8000-000000000002',repeat('3',64),1,repeat('4',64),test_resource_type,'safe-detail-validation',test_field_name,'es','en',repeat('b',64),1,'failed','libretranslate',1,3,'translation_failed','La traducción alteró código, enlaces o variables protegidas.',now()-interval '2 minutes',now()-interval '1 minute',jsonb_build_object('engine','3e3','expected_lock_version',1)),
    ('32000000-0000-4000-8000-000000000003',repeat('5',64),1,repeat('6',64),test_resource_type,'safe-detail-missing',test_field_name,'es','en',repeat('d',64),1,'cancelled','libretranslate',1,3,'source_changed','raw source data',now()-interval '2 minutes',now()-interval '1 minute','{}'),
    ('32000000-0000-4000-8000-000000000004',repeat('7',64),1,repeat('8',64),test_resource_type,'safe-detail-lease',test_field_name,'es','en',repeat('c',64),1,'failed','libretranslate',3,3,'lease_expired','raw worker data',now()-interval '2 minutes',now()-interval '1 minute',jsonb_build_object('engine','3e3','expected_lock_version',1));

  select jsonb_agg(to_jsonb(j) order by j.id) into before_jobs
  from public.translation_jobs j where j.id::text like '32000000-%';
  select jsonb_agg(to_jsonb(s) order by s.id) into before_states
  from public.translation_field_state s where s.id::text like '31000000-%';

  select * into detail from public.translation_admin_job_detail(
    '32000000-0000-4000-8000-000000000001',array[test_resource_type]
  );
  if detail.error_category<>'recoverable_connectivity' or not detail.error_recoverable
     or detail.requires_human_review or not detail.editorial_state_exists
     or not detail.source_is_current or detail.error_summary like '%endpoint%'
     or detail.error_summary like '%credential%' then
    raise exception 'Clasificación de conectividad insegura o incorrecta';
  end if;

  select * into detail from public.translation_admin_job_detail(
    '32000000-0000-4000-8000-000000000002',array[test_resource_type]
  );
  if detail.error_category<>'protected_content_validation' or detail.error_recoverable
     or not detail.requires_human_review then
    raise exception 'Fallo de contenido protegido clasificado incorrectamente';
  end if;

  select * into detail from public.translation_admin_job_detail(
    '32000000-0000-4000-8000-000000000003',array[test_resource_type]
  );
  if detail.error_category<>'source_unavailable' or detail.editorial_state_exists
     or detail.source_is_current or detail.error_recoverable then
    raise exception 'Trabajo antiguo o sin estado clasificado incorrectamente';
  end if;

  select * into detail from public.translation_admin_job_detail(
    '32000000-0000-4000-8000-000000000004',array[test_resource_type]
  );
  if detail.error_category<>'lease_expired' or detail.error_recoverable
     or not detail.requires_human_review then
    raise exception 'Lease agotado se consideró recuperable';
  end if;

  select * into detail from public.translation_admin_job_detail(
    '32000000-0000-4000-8000-000000000001',array[other_resource_type]
  );
  if found then raise exception 'La RPC filtró incorrectamente recursos no autorizados'; end if;

  select * into detail from public.translation_admin_job_detail(
    '00000000-0000-0000-0000-000000000000',
    array['blog_post_translation']
  );
  if found then raise exception 'La RPC inventó un trabajo inexistente'; end if;

  begin
    perform public.translation_admin_job_detail(
      '00000000-0000-0000-0000-000000000000',
      array['unknown_resource']
    );
    raise exception 'Aceptó un recurso no registrado';
  exception when sqlstate '22023' then null;
  end;

  if before_jobs is distinct from (
    select jsonb_agg(to_jsonb(j) order by j.id) from public.translation_jobs j where j.id::text like '32000000-%'
  ) or before_states is distinct from (
    select jsonb_agg(to_jsonb(s) order by s.id) from public.translation_field_state s where s.id::text like '31000000-%'
  ) then raise exception 'La RPC de detalle modificó datos'; end if;
end
$$;

select 'translation job safe detail postgres tests passed' result;

-- Los fixtures y cualquier cambio accidental se revierten íntegramente.
rollback;
