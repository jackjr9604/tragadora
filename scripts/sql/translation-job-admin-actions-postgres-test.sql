\set ON_ERROR_STOP on

select set_config('app.test_role','authenticated',false);
select set_config('app.test_user_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select set_config('app.test_permissions','blog.view,blog.update',false);

do $$
declare
  state_row public.translation_field_state%rowtype;
  original_job public.translation_jobs%rowtype;
  retried_id uuid;
  repeated_id uuid;
  queued_job public.translation_jobs%rowtype;
begin
  if has_function_privilege('anon','public.translation_admin_retry_job(uuid,timestamptz,bigint,integer,integer)','EXECUTE')
     or has_function_privilege('service_role','public.translation_admin_retry_job(uuid,timestamptz,bigint,integer,integer)','EXECUTE')
     or has_function_privilege('anon','public.translation_admin_cancel_job(uuid,timestamptz,bigint)','EXECUTE')
     or has_function_privilege('service_role','public.translation_admin_cancel_job(uuid,timestamptz,bigint)','EXECUTE') then
    raise exception 'RPC administrativas expuestas a roles incorrectos';
  end if;
  if not has_function_privilege('authenticated','public.translation_admin_retry_job(uuid,timestamptz,bigint,integer,integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.translation_admin_cancel_job(uuid,timestamptz,bigint)','EXECUTE') then
    raise exception 'authenticated no puede ejecutar las RPC';
  end if;

  select * into state_row from public.translation_field_state
  where resource_type='blog_post_translation' and field_name='title' and target_language='en'
  order by created_at limit 1;
  original_job:=public.translation_request_ai_draft(state_row.id,state_row.lock_version,24,3,20,100000,false);
  update public.translation_jobs set status='failed',attempt_count=max_attempts,
    error_code='local_provider_unavailable',last_error='Proveedor local no disponible',
    completed_at=now(),updated_at=clock_timestamp() where id=original_job.id returning * into original_job;

  retried_id:=public.translation_admin_retry_job(original_job.id,original_job.updated_at,state_row.lock_version,20,100000);
  repeated_id:=public.translation_admin_retry_job(original_job.id,original_job.updated_at,state_row.lock_version,20,100000);
  if retried_id<>repeated_id or retried_id=original_job.id then raise exception 'Reintento no idempotente o reabrió el job original'; end if;
  if (select status from public.translation_jobs where id=original_job.id)<>'failed'
     or (select status from public.translation_jobs where id=retried_id)<>'queued' then
    raise exception 'Estados incorrectos tras reintento';
  end if;
  if (select count(*) from public.translation_jobs where resource_type=original_job.resource_type
      and resource_id=original_job.resource_id and field_name=original_job.field_name
      and target_language=original_job.target_language and status in ('queued','running','retry_wait'))<>1 then
    raise exception 'El reintento duplicó generaciones activas';
  end if;

  select * into state_row from public.translation_field_state
  where resource_type='blog_post_translation' and field_name='excerpt' and target_language='pt'
  order by created_at limit 1;
  queued_job:=public.translation_request_ai_draft(state_row.id,state_row.lock_version,20,3,20,100000,false);
  perform public.translation_admin_cancel_job(queued_job.id,queued_job.updated_at,state_row.lock_version);
  perform public.translation_admin_cancel_job(queued_job.id,queued_job.updated_at,state_row.lock_version);
  if (select status from public.translation_jobs where id=queued_job.id)<>'cancelled'
     or (select error_code from public.translation_jobs where id=queued_job.id)<>'admin_cancelled' then
    raise exception 'Cancelación no fue idempotente';
  end if;
  if not exists(select 1 from public.admin_audit_log where actor_user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and action in ('translation_job_retry','translation_job_cancel')) then
    raise exception 'No se registró auditoría administrativa';
  end if;
end
$$;

-- Permisos por módulo.
select set_config('app.test_permissions','blog.view',false);
do $$
declare j public.translation_jobs%rowtype; s public.translation_field_state%rowtype;
begin
  select * into j from public.translation_jobs where status='failed' and error_code='local_provider_unavailable' limit 1;
  select * into s from public.translation_field_state where resource_type=j.resource_type and resource_id=j.resource_id
    and field_name=j.field_name and target_language=j.target_language;
  begin
    perform public.translation_admin_retry_job(j.id,j.updated_at,s.lock_version,20,100000);
    raise exception 'Usuario sin update pudo reintentar';
  exception when insufficient_privilege then null;
  end;
end
$$;
select set_config('app.test_permissions','blog.view,blog.update',false);

-- Lease vivo rechazado; lease vencido cancelable.
do $$
declare s public.translation_field_state%rowtype; j public.translation_jobs%rowtype;
begin
  select * into s from public.translation_field_state where resource_type='blog_post_translation'
    and field_name='category' and target_language='en' order by created_at limit 1;
  j:=public.translation_request_ai_draft(s.id,s.lock_version,12,3,20,100000,false);
  update public.translation_jobs set status='running',attempt_count=1,locked_by='test-worker',
    lease_expires_at=now()+interval '2 minutes',updated_at=clock_timestamp() where id=j.id returning * into j;
  begin
    perform public.translation_admin_cancel_job(j.id,j.updated_at,s.lock_version);
    raise exception 'Se canceló un lease vigente';
  exception when object_not_in_prerequisite_state then null;
  end;
  update public.translation_jobs set lease_expires_at=now()-interval '1 second',updated_at=clock_timestamp()
    where id=j.id returning * into j;
  perform public.translation_admin_cancel_job(j.id,j.updated_at,s.lock_version);
  if (select status from public.translation_jobs where id=j.id)<>'cancelled' then raise exception 'Lease vencido no cancelado'; end if;
end
$$;

-- Protección editorial y concurrencia optimista.
do $$
declare s public.translation_field_state%rowtype; j public.translation_jobs%rowtype;
begin
  select * into s from public.translation_field_state where resource_type='blog_post_translation'
    and field_name='tags' and target_language='pt' order by created_at limit 1;
  j:=public.translation_request_ai_draft(s.id,s.lock_version,12,3,100,1000000,false);
  update public.translation_jobs set status='failed',error_code='lease_expired',completed_at=now(),updated_at=clock_timestamp()
    where id=j.id returning * into j;
  update public.translation_field_state set is_protected=true,protection_reason='manual'
    where id=s.id returning * into s;
  begin
    perform public.translation_admin_retry_job(j.id,j.updated_at,s.lock_version,100,1000000);
    raise exception 'Se reintentó contenido protegido';
  exception when insufficient_privilege then null;
  end;
  update public.translation_field_state set is_protected=false,protection_reason=null,
    lock_version=lock_version+1 where id=s.id returning * into s;
  begin
    perform public.translation_admin_retry_job(j.id,j.updated_at,s.lock_version-1,100,1000000);
    raise exception 'Se ignoró lock_version obsoleto';
  exception when serialization_failure then null;
  end;
end
$$;

-- Cuota: el límite se comprueba antes de crear otra generación.
do $$
declare s public.translation_field_state%rowtype; j public.translation_jobs%rowtype;
begin
  select * into s from public.translation_field_state where resource_type='blog_post_translation'
    and field_name='body_markdown' and target_language='pt' order by created_at limit 1;
  j:=public.translation_request_ai_draft(s.id,s.lock_version,50,3,100,1000000,false);
  update public.translation_jobs set status='failed',error_code='lease_expired',completed_at=now(),updated_at=clock_timestamp()
    where id=j.id returning * into j;
  begin
    perform public.translation_admin_retry_job(j.id,j.updated_at,s.lock_version,1,1000000);
    raise exception 'El reintento evitó la cuota diaria';
  exception when program_limit_exceeded then null;
  end;
end
$$;

-- Carreras reales en conexiones PostgreSQL independientes.
create extension if not exists dblink;
create table public.translation_admin_concurrency_fixture(kind text primary key,job_id uuid,job_updated_at timestamptz,state_lock bigint);
create table public.translation_admin_concurrency_result(test text,connection text,result text);

create function public.test_admin_retry(p_job uuid,p_updated timestamptz,p_lock bigint) returns text
language plpgsql as $$ begin
  perform set_config('app.test_role','authenticated',true);
  perform set_config('app.test_user_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
  perform set_config('app.test_permissions','blog.view,blog.update',true);
  return public.translation_admin_retry_job(p_job,p_updated,p_lock,100,1000000)::text;
exception when others then return 'error:'||sqlstate; end $$;
create function public.test_admin_cancel(p_job uuid,p_updated timestamptz,p_lock bigint) returns text
language plpgsql as $$ begin
  perform set_config('app.test_role','authenticated',true);
  perform set_config('app.test_user_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
  perform set_config('app.test_permissions','blog.view,blog.update',true);
  return public.translation_admin_cancel_job(p_job,p_updated,p_lock)::text;
exception when others then return 'error:'||sqlstate; end $$;
create function public.test_worker_claim(p_job uuid) returns text
language plpgsql as $$ begin
  perform set_config('app.test_role','service_role',true);
  return (public.translation_claim_ai_job(p_job,'race-worker',90)).id::text;
exception when others then return 'error:'||sqlstate; end $$;
create function public.test_worker_complete(p_job uuid) returns text
language plpgsql as $$ begin
  perform set_config('app.test_role','service_role',true);
  return public.translation_complete_ai_job(p_job,'race-worker',to_jsonb('Safe translated draft'::text),'mock','{"estimated_cost_usd":0}'::jsonb)::text;
exception when others then return 'error:'||sqlstate; end $$;
create function public.test_worker_fail(p_job uuid) returns text
language plpgsql as $$ begin
  perform set_config('app.test_role','service_role',true);
  return public.translation_fail_ai_job(p_job,'race-worker','translation_failed','safe test failure',false);
exception when others then return 'error:'||sqlstate; end $$;

do $$
declare s public.translation_field_state%rowtype; j public.translation_jobs%rowtype;
begin
  select * into s from public.translation_field_state where resource_type='blog_post_translation' and field_name='title' and target_language='pt' order by created_at limit 1;
  j:=public.translation_request_ai_draft(s.id,s.lock_version,20,3,100,1000000,false);
  update public.translation_jobs set status='failed',attempt_count=max_attempts,error_code='local_provider_unavailable',last_error='offline',completed_at=now(),updated_at=clock_timestamp() where id=j.id returning * into j;
  insert into public.translation_admin_concurrency_fixture values('retry',j.id,j.updated_at,s.lock_version);

  select * into s from public.translation_field_state where resource_type='blog_post_translation' and field_name='excerpt' and target_language='en' order by created_at limit 1;
  j:=public.translation_request_ai_draft(s.id,s.lock_version,20,3,100,1000000,false);
  insert into public.translation_admin_concurrency_fixture values('claim_cancel',j.id,j.updated_at,s.lock_version);

  select * into s from public.translation_field_state where resource_type='blog_post_translation' and field_name='category' and target_language='pt' order by created_at limit 1;
  j:=public.translation_request_ai_draft(s.id,s.lock_version,20,3,100,1000000,false);
  perform set_config('app.test_role','service_role',true);
  perform public.translation_claim_ai_job(j.id,'race-worker',90);
  perform set_config('app.test_role','authenticated',true);
  select * into j from public.translation_jobs where id=j.id;
  insert into public.translation_admin_concurrency_fixture values('complete_cancel',j.id,j.updated_at,s.lock_version);

  select * into s from public.translation_field_state where resource_type='blog_post_translation' and field_name='tags' and target_language='en' order by created_at limit 1;
  j:=public.translation_request_ai_draft(s.id,s.lock_version,20,3,100,1000000,false);
  perform set_config('app.test_role','service_role',true);
  perform public.translation_claim_ai_job(j.id,'race-worker',90);
  perform set_config('app.test_role','authenticated',true);
  select * into j from public.translation_jobs where id=j.id;
  insert into public.translation_admin_concurrency_fixture values('fail_cancel',j.id,j.updated_at,s.lock_version);
end $$;

select dblink_connect('race_a','dbname='||current_database());
select dblink_connect('race_b','dbname='||current_database());

select dblink_send_query('race_a',format('select public.test_admin_retry(%L,%L,%s)',job_id,job_updated_at,state_lock)) from public.translation_admin_concurrency_fixture where kind='retry';
select dblink_send_query('race_b',format('select public.test_admin_retry(%L,%L,%s)',job_id,job_updated_at,state_lock)) from public.translation_admin_concurrency_fixture where kind='retry';
insert into public.translation_admin_concurrency_result select 'retry','a',result from dblink_get_result('race_a') as t(result text);
insert into public.translation_admin_concurrency_result select 'retry','b',result from dblink_get_result('race_b') as t(result text);
do $$ begin
  if (select count(distinct result) from public.translation_admin_concurrency_result where test='retry')<>1
     or (select count(*) from public.translation_jobs j join public.translation_admin_concurrency_fixture f on f.kind='retry' and j.resource_id=(select resource_id from public.translation_jobs where id=f.job_id) and j.field_name=(select field_name from public.translation_jobs where id=f.job_id) and j.target_language=(select target_language from public.translation_jobs where id=f.job_id) where j.status in ('queued','running','retry_wait'))<>1 then
    raise exception 'Los reintentos simultáneos no fueron idempotentes';
  end if;
end $$;
select dblink_disconnect('race_a');
select dblink_disconnect('race_b');
select dblink_connect('race_a','dbname='||current_database());
select dblink_connect('race_b','dbname='||current_database());

select dblink_send_query('race_a',format('select public.test_worker_claim(%L)',job_id)) from public.translation_admin_concurrency_fixture where kind='claim_cancel';
select dblink_send_query('race_b',format('select public.test_admin_cancel(%L,%L,%s)',job_id,job_updated_at,state_lock)) from public.translation_admin_concurrency_fixture where kind='claim_cancel';
insert into public.translation_admin_concurrency_result select 'claim_cancel','a',result from dblink_get_result('race_a') as t(result text);
insert into public.translation_admin_concurrency_result select 'claim_cancel','b',result from dblink_get_result('race_b') as t(result text);
do $$ begin
  if (select status from public.translation_jobs where id=(select job_id from public.translation_admin_concurrency_fixture where kind='claim_cancel')) not in ('running','cancelled') then
    raise exception 'Claim vs cancel produjo estado inválido';
  end if;
end $$;
select dblink_disconnect('race_a');
select dblink_disconnect('race_b');
select dblink_connect('race_a','dbname='||current_database());
select dblink_connect('race_b','dbname='||current_database());

select dblink_send_query('race_a',format('select public.test_worker_complete(%L)',job_id)) from public.translation_admin_concurrency_fixture where kind='complete_cancel';
select dblink_send_query('race_b',format('select public.test_admin_cancel(%L,%L,%s)',job_id,job_updated_at,state_lock)) from public.translation_admin_concurrency_fixture where kind='complete_cancel';
insert into public.translation_admin_concurrency_result select 'complete_cancel','a',result from dblink_get_result('race_a') as t(result text);
insert into public.translation_admin_concurrency_result select 'complete_cancel','b',result from dblink_get_result('race_b') as t(result text);
do $$ begin
  if (select status from public.translation_jobs where id=(select job_id from public.translation_admin_concurrency_fixture where kind='complete_cancel'))<>'succeeded' then
    raise exception 'Complete vs cancel no preservó el resultado del worker';
  end if;
end $$;
select dblink_disconnect('race_a');
select dblink_disconnect('race_b');
select dblink_connect('race_a','dbname='||current_database());
select dblink_connect('race_b','dbname='||current_database());

select dblink_send_query('race_a',format('select public.test_worker_fail(%L)',job_id)) from public.translation_admin_concurrency_fixture where kind='fail_cancel';
select dblink_send_query('race_b',format('select public.test_admin_cancel(%L,%L,%s)',job_id,job_updated_at,state_lock)) from public.translation_admin_concurrency_fixture where kind='fail_cancel';
insert into public.translation_admin_concurrency_result select 'fail_cancel','a',result from dblink_get_result('race_a') as t(result text);
insert into public.translation_admin_concurrency_result select 'fail_cancel','b',result from dblink_get_result('race_b') as t(result text);
do $$ begin
  if (select status from public.translation_jobs where id=(select job_id from public.translation_admin_concurrency_fixture where kind='fail_cancel'))<>'failed' then
    raise exception 'Fail vs cancel no preservó el resultado del worker';
  end if;
end $$;

select dblink_disconnect('race_a');
select dblink_disconnect('race_b');
drop function public.test_admin_retry(uuid,timestamptz,bigint);
drop function public.test_admin_cancel(uuid,timestamptz,bigint);
drop function public.test_worker_claim(uuid);
drop function public.test_worker_complete(uuid);
drop function public.test_worker_fail(uuid);
drop table public.translation_admin_concurrency_result;
drop table public.translation_admin_concurrency_fixture;

select 'translation job admin actions: ok' as result;
