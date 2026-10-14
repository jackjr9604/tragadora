\set ON_ERROR_STOP on

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(current_setting('app.test_role',true),'authenticated')
$$;
select set_config('app.test_role','service_role',false);

-- El reporte funciona bajo safe-update porque conserva un WHERE explícito.
select public.translation_worker_report_languages(array['es','en','pt']);
do $$ begin
  if exists(select 1 from public.languages where code in ('es','en','pt') and libretranslate_status<>'supported') then
    raise exception 'Compatibilidad de idiomas incorrecta';
  end if;
end $$;

-- Construye un fallo legacy elegible sin tocar textos ni estados editoriales.
do $$
declare s public.translation_field_state%rowtype; logical text; next_generation integer;
begin
  select * into s from public.translation_field_state
  where not is_protected and workflow_status='none' and publication_status<>'published'
  order by created_at limit 1 for update;
  if not found then raise exception 'El fixture no contiene un estado recuperable'; end if;
  logical:=encode(extensions.digest(convert_to('worker-recovery-'||s.id::text,'UTF8'),'sha256'),'hex');
  select coalesce(max(generation),0)+1 into next_generation from public.translation_jobs where logical_key=logical;
  insert into public.translation_jobs(logical_key,generation,idempotency_key,resource_type,resource_id,field_name,
    source_language,target_language,source_hash,source_revision,status,requested_provider,attempt_count,max_attempts,
    completed_at,error_code,last_error,input_characters,estimated_cost_usd,metadata)
  values(logical,next_generation,encode(extensions.digest(convert_to(logical||next_generation::text,'UTF8'),'sha256'),'hex'),
    s.resource_type,s.resource_id,s.field_name,s.source_language,s.target_language,s.source_hash,s.source_revision,
    'failed','libretranslate',3,3,now(),'local_provider_unavailable','PC apagado',10,0,
    jsonb_build_object('engine','3e3','state_id',s.id,'expected_lock_version',s.lock_version,'postgres_recovery_test',true));
end $$;

do $$
declare recovered public.translation_jobs; recovered_again public.translation_jobs; claimed public.translation_jobs;
  before_state jsonb; after_state jsonb;
begin
  select to_jsonb(s) into before_state from public.translation_field_state s
  join public.translation_jobs j on (j.metadata->>'state_id')::uuid=s.id
  where j.metadata->>'postgres_recovery_test'='true';

  select * into recovered from public.translation_recover_local_provider_jobs(50)
  where metadata->>'postgres_recovery_test'='true';
  if recovered.status<>'queued' or recovered.attempt_count<>0 or recovered.error_code is not null then
    raise exception 'La recuperación no restauró el job pendiente';
  end if;
  select * into recovered_again from public.translation_recover_local_provider_jobs(50)
  where metadata->>'postgres_recovery_test'='true';
  if found then raise exception 'La recuperación idempotente devolvió el job dos veces'; end if;

  select * into claimed from public.translation_claim_ready_ai_jobs('postgres-worker',array['es','en','pt'],10,90)
  where metadata->>'postgres_recovery_test'='true';
  if claimed.status<>'running' or claimed.attempt_count<>1 then raise exception 'Claim inesperado'; end if;
  perform public.translation_release_ai_job_provider_unavailable(claimed.id,'postgres-worker','provider offline');
  select * into claimed from public.translation_jobs where id=claimed.id;
  if claimed.status<>'queued' or claimed.attempt_count<>0 or claimed.error_code<>'local_provider_unavailable' then
    raise exception 'La caída local consumió un intento';
  end if;

  select to_jsonb(s) into after_state from public.translation_field_state s
  where s.id=(claimed.metadata->>'state_id')::uuid;
  if before_state is distinct from after_state then raise exception 'El worker modificó el estado editorial'; end if;
end $$;

-- Sin compatibilidad para ambos extremos, el trabajo permanece pendiente.
do $$
declare claimed public.translation_jobs;
begin
  select * into claimed from public.translation_claim_ready_ai_jobs('unsupported-worker',array['fr'],10,90)
  where metadata->>'postgres_recovery_test'='true';
  if found then raise exception 'Se reclamó un idioma no soportado'; end if;
  if not exists(select 1 from public.translation_jobs where metadata->>'postgres_recovery_test'='true' and status='queued' and attempt_count=0) then
    raise exception 'El job no permaneció pendiente';
  end if;
end $$;

do $$ begin
  if has_function_privilege('anon','public.translation_recover_local_provider_jobs(integer)','EXECUTE')
     or has_function_privilege('authenticated','public.translation_recover_local_provider_jobs(integer)','EXECUTE')
     or has_function_privilege('authenticated','public.translation_claim_ready_ai_jobs(text,text[],integer,integer)','EXECUTE')
     or has_function_privilege('authenticated','public.translation_release_ai_job_provider_unavailable(uuid,text,text)','EXECUTE') then
    raise exception 'RPC del worker expuesta al cliente';
  end if;
  if exists(select 1 from public.translation_jobs where metadata->>'postgres_recovery_test'='true' and coalesce(estimated_cost_usd,0)<>0) then
    raise exception 'Se registró costo no permitido';
  end if;
end $$;

select 'translation worker recovery postgres tests passed' result;
