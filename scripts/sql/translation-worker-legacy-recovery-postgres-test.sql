\set ON_ERROR_STOP on

select set_config('app.test_role','service_role',false);

-- Once fallos legacy exactos de conectividad.
do $$
declare i integer; state_id uuid; resource text; logical text;
begin
  for i in 1..11 loop
    resource:=extensions.gen_random_uuid()::text;
    insert into public.translation_field_state(resource_type,resource_id,field_name,source_language,target_language,
      source_hash,source_revision,status,workflow_status,publication_status,is_protected,lock_version)
    values('blog_post_translation',resource,'title','es','en',repeat(substr(to_hex(i),1,1),64),1,
      'error','none','unpublished',false,1) returning id into state_id;
    logical:=encode(extensions.digest(convert_to('legacy-fetch-'||i::text,'UTF8'),'sha256'),'hex');
    insert into public.translation_jobs(logical_key,generation,idempotency_key,resource_type,resource_id,field_name,
      source_language,target_language,source_hash,source_revision,status,requested_provider,attempt_count,max_attempts,
      completed_at,error_code,last_error,input_characters,estimated_cost_usd,metadata)
    values(logical,1,encode(extensions.digest(convert_to(logical||'-1','UTF8'),'sha256'),'hex'),
      'blog_post_translation',resource,'title','es','en',repeat(substr(to_hex(i),1,1),64),1,
      'failed','libretranslate',3,3,now(),'translation_failed','fetch failed',10,0,
      jsonb_build_object('engine','3e3','state_id',state_id,'expected_lock_version',1,'legacy_recovery_test','connectivity'));
  end loop;
end $$;

-- Dos fallos de protección con el mismo error_code general: nunca son elegibles.
do $$
declare message text; state_id uuid; resource text; logical text; i integer:=0;
begin
  foreach message in array array[
    'La traducción alteró código, enlaces o variables protegidas.',
    'La traducción alteró estructura Markdown protegida.'
  ] loop
    i:=i+1; resource:=extensions.gen_random_uuid()::text;
    insert into public.translation_field_state(resource_type,resource_id,field_name,source_language,target_language,
      source_hash,source_revision,status,workflow_status,publication_status,is_protected,lock_version)
    values('blog_post_translation',resource,'body_markdown','es','en',repeat('f',63)||i::text,1,
      'error','none','unpublished',false,1) returning id into state_id;
    logical:=encode(extensions.digest(convert_to('legacy-protection-'||i::text,'UTF8'),'sha256'),'hex');
    insert into public.translation_jobs(logical_key,generation,idempotency_key,resource_type,resource_id,field_name,
      source_language,target_language,source_hash,source_revision,status,requested_provider,attempt_count,max_attempts,
      completed_at,error_code,last_error,input_characters,estimated_cost_usd,metadata)
    values(logical,1,encode(extensions.digest(convert_to(logical||'-1','UTF8'),'sha256'),'hex'),
      'blog_post_translation',resource,'body_markdown','es','en',repeat('f',63)||i::text,1,
      'failed','libretranslate',3,3,now(),'translation_failed',message,100,0,
      jsonb_build_object('engine','3e3','state_id',state_id,'expected_lock_version',1,'legacy_recovery_test','protection'));
  end loop;
end $$;

do $$
declare recovered_count integer; recovered_again integer;
begin
  select count(*) into recovered_count from public.translation_recover_local_provider_jobs(50)
  where metadata->>'legacy_recovery_test'='connectivity';
  if recovered_count<>11 then raise exception 'Se esperaban 11 recuperaciones legacy, se obtuvieron %',recovered_count; end if;

  if exists(select 1 from public.translation_jobs
    where metadata->>'legacy_recovery_test'='connectivity'
      and (status<>'queued' or attempt_count<>0 or error_code is not null or last_error is not null
        or metadata->>'recovered_from'<>'legacy_translation_failed_fetch')) then
    raise exception 'La recuperación legacy produjo un estado incorrecto';
  end if;
  if exists(select 1 from public.translation_jobs
    where metadata->>'legacy_recovery_test'='protection'
      and (status<>'failed' or error_code<>'translation_failed' or last_error='fetch failed')) then
    raise exception 'Un fallo de protección fue modificado';
  end if;

  select count(*) into recovered_again from public.translation_recover_local_provider_jobs(50)
  where metadata->>'legacy_recovery_test' in ('connectivity','protection');
  if recovered_again<>0 then raise exception 'La segunda recuperación no fue idempotente'; end if;
end $$;

do $$ begin
  if exists(select 1 from public.translation_field_state s
    join public.translation_jobs j on (j.metadata->>'state_id')::uuid=s.id
    where j.metadata ? 'legacy_recovery_test'
      and (s.workflow_status<>'none' or s.publication_status='published' or s.is_protected)) then
    raise exception 'La prueba alteró protección o workflow editorial';
  end if;
  if exists(select 1 from public.translation_jobs where metadata ? 'legacy_recovery_test' and coalesce(estimated_cost_usd,0)<>0) then
    raise exception 'La recuperación registró costos';
  end if;
end $$;

select 'legacy local provider recovery postgres tests passed' result;
