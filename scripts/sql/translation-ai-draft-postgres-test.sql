\set ON_ERROR_STOP on

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(current_setting('app.test_role',true),'authenticated')
$$;

select set_config('app.test_permissions','blog.view,blog.update',false);
select set_config('app.test_role','authenticated',false);

do $$
declare sid uuid; version bigint; first_job public.translation_jobs; second_job public.translation_jobs;
begin
  select id,lock_version into sid,version from public.translation_field_state
  where resource_type='blog_post_translation' and field_name='title' and target_language='en'
  order by created_at limit 1;
  first_job := public.translation_request_ai_draft(sid,version,24,3,20,100000,false);
  second_job := public.translation_request_ai_draft(sid,version,24,3,20,100000,false);
  if first_job.id <> second_job.id then raise exception 'La solicitud duplicada creó otro trabajo'; end if;
end $$;

select set_config('app.test_role','service_role',false);
do $$
declare job public.translation_jobs; claimed public.translation_jobs; new_version bigint;
begin
  select * into job from public.translation_jobs where metadata->>'engine'='3e3' order by created_at desc limit 1;
  select * into claimed from public.translation_claim_ai_jobs('postgres-test',1,90);
  if claimed.id <> job.id then raise exception 'El worker reclamó un trabajo inesperado'; end if;
  if public.translation_read_ai_job_source(job.id,'postgres-test') is null then raise exception 'El worker no pudo leer la fuente autorizada'; end if;
  new_version := public.translation_complete_ai_job(job.id,'postgres-test',to_jsonb('AI draft only'::text),'mock-local',
    '{"input_tokens":6,"output_tokens":4,"output_characters":13,"estimated_cost_usd":0}'::jsonb);
  if new_version <= 1 then raise exception 'lock_version no avanzó'; end if;
end $$;

do $$
declare s public.translation_field_state%rowtype;
begin
  select * into s from public.translation_field_state
  where resource_type='blog_post_translation' and field_name='title' and target_language='en'
    and draft_value=to_jsonb('AI draft only'::text);
  if s.workflow_status <> 'draft' or s.publication_status <> 'unpublished' or s.is_protected then
    raise exception 'El resultado IA no quedó como borrador no publicado';
  end if;
  if exists(select 1 from public.blog_post_translations where blog_post_id=s.resource_id::uuid and language='en' and title='AI draft only') then
    raise exception 'La IA escribió la tabla pública';
  end if;
end $$;

-- Una revisión concurrente impide completar un job antiguo.
select set_config('app.test_role','authenticated',false);
do $$
declare sid uuid; version bigint; job public.translation_jobs;
begin
  select id,lock_version into sid,version from public.translation_field_state
  where resource_type='blog_post_translation' and field_name='excerpt' and target_language='en' order by created_at limit 1;
  job := public.translation_request_ai_draft(sid,version,20,2,20,100000,false);
end $$;
select set_config('app.test_role','service_role',false);
do $$
declare job public.translation_jobs;
begin
  select * into job from public.translation_jobs where field_name='excerpt' and metadata->>'engine'='3e3' order by created_at desc limit 1;
  perform public.translation_claim_ai_job(job.id,'stale-worker',90);
  update public.translation_field_state set lock_version=lock_version+1 where id=(job.metadata->>'state_id')::uuid;
  begin
    perform public.translation_complete_ai_job(job.id,'stale-worker',to_jsonb('Must not save'::text),'test','{}'::jsonb);
    raise exception 'El job antiguo sobrescribió una revisión posterior';
  exception when serialization_failure then null;
  end;
end $$;

-- Un lease vencido se recupera sin duplicar el trabajo.
select set_config('app.test_role','authenticated',false);
do $$
declare sid uuid; version bigint;
begin
  select id,lock_version into sid,version from public.translation_field_state
  where resource_type='blog_post_translation' and field_name='category' and target_language='pt' order by created_at limit 1;
  perform public.translation_request_ai_draft(sid,version,12,3,20,100000,false);
end $$;
select set_config('app.test_role','service_role',false);
do $$
declare claimed public.translation_jobs; reclaimed public.translation_jobs;
begin
  select * into claimed from public.translation_claim_ai_jobs('lease-worker',1,30);
  update public.translation_jobs set lease_expires_at=now()-interval '1 second' where id=claimed.id;
  select * into reclaimed from public.translation_claim_ai_jobs('recovery-worker',1,30);
  if reclaimed.id <> claimed.id or reclaimed.attempt_count <> claimed.attempt_count+1 then
    raise exception 'El lease vencido no se recuperó de forma idempotente';
  end if;
end $$;

-- Helpers de worker nunca quedan expuestos al cliente.
do $$
begin
  if has_function_privilege('anon','public.translation_complete_ai_job(uuid,text,jsonb,text,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.translation_complete_ai_job(uuid,text,jsonb,text,jsonb)','EXECUTE') then
    raise exception 'RPC de worker expuesta';
  end if;
  if not has_function_privilege('authenticated','public.translation_request_ai_draft(uuid,bigint,integer,integer,integer,integer,boolean)','EXECUTE') then
    raise exception 'RPC de solicitud no disponible para authenticated';
  end if;
  if has_function_privilege('authenticated','public.translation_claim_ai_jobs(text,integer,integer)','EXECUTE')
     or has_function_privilege('authenticated','public.translation_read_ai_job_source(uuid,text)','EXECUTE') then
    raise exception 'RPC del worker local expuesta a authenticated';
  end if;
end $$;

select 'translation AI draft postgres tests passed' as result;
