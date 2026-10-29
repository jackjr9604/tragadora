begin;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('a5270000-0000-4000-8000-000000000099','authenticated','authenticated','initial-load@local.invalid',crypt('LocalOnly!',gen_salt('bf')),now(),'{}','{}',now(),now()) on conflict(id) do nothing;
select set_config('request.jwt.claim.role','service_role',true);
update public.profiles set role='super_admin' where id='a5270000-0000-4000-8000-000000000099';
set local role service_role;
select public.translation_initial_load_start('a5271000-0000-4000-8000-000000000001','a5270000-0000-4000-8000-000000000099',3500,10000000);
select public.translation_initial_load_enqueue('a5271000-0000-4000-8000-000000000001',100);
select public.translation_initial_load_enqueue('a5271000-0000-4000-8000-000000000001',100);
reset role;

do $$
declare group_count bigint;job_count bigint;
begin
  select count(*),count(distinct job_id) into group_count,job_count from public.translation_initial_load_groups where run_id='a5271000-0000-4000-8000-000000000001';
  if group_count=0 or group_count<>job_count then raise exception 'Encolado exacto no idempotente';end if;
  if exists(select 1 from public.translation_jobs j join public.translation_initial_load_groups g on g.job_id=j.id where g.run_id='a5271000-0000-4000-8000-000000000001' and (j.metadata->>'budget_scope'<>'initial_exact_group_load' or j.metadata->>'engine'<>'3e3')) then raise exception 'Metadata intensiva incorrecta';end if;
end $$;

do $$
declare g public.translation_initial_load_groups%rowtype;worker text:='local-test-worker';source jsonb;
begin
  select * into g from public.translation_initial_load_groups where run_id='a5271000-0000-4000-8000-000000000001' and status='queued' order by created_at limit 1;
  update public.translation_jobs set status='running',attempt_count=1,locked_by=worker,locked_at=now(),lease_expires_at=now()+interval '2 minutes' where id=g.job_id;
  source:=public.translation_read_value(g.resource_type,(select resource_id from public.translation_field_state where id=g.representative_state_id),g.field_name,g.source_language);
  perform set_config('request.jwt.claim.role','service_role',true);
  perform public.translation_complete_ai_job(g.job_id,worker,case when jsonb_typeof(source)='array' then source else to_jsonb('Traducción sintética 14 días'::text) end,'local-test','{"output_characters":30}'::jsonb);
end $$;

set local role service_role;
select public.translation_initial_load_refresh('a5271000-0000-4000-8000-000000000001');
do $$ declare c record;begin
  select * into c from public.translation_initial_load_qa_candidates('a5271000-0000-4000-8000-000000000001',1);
  perform public.translation_initial_load_record_qa('a5271000-0000-4000-8000-000000000001',c.resource_type,c.field_name,c.source_hash,c.target_language,'requires_review',array['commercial_sensitive']);
end $$;
select public.translation_initial_load_fanout('a5271000-0000-4000-8000-000000000001',1,100);
reset role;

do $$
begin
  if exists(select 1 from public.admin_audit_log a join public.translation_field_state s on s.id=(a.new_value->>'state_id')::uuid where a.actor_user_id='a5270000-0000-4000-8000-000000000099' and a.action='translation.initial_load.apply' and s.publication_status='published') then raise exception 'La carga publicó contenido';end if;
  if not exists(select 1 from public.admin_audit_log where actor_user_id='a5270000-0000-4000-8000-000000000099' and action='translation.initial_load.apply') then raise exception 'Falta auditoría de fan-out';end if;
  if exists(select 1 from public.translation_field_state s join public.translation_initial_load_groups g on g.resource_type=s.resource_type and g.field_name=s.field_name and g.source_hash=s.source_hash and g.target_language=s.target_language where g.run_id='a5271000-0000-4000-8000-000000000001' and s.workflow_status='approved') then raise exception 'La carga aprobó contenido';end if;
end $$;

set local role service_role;
do $$
declare result jsonb;
begin
  perform set_config('request.jwt.claim.role','service_role',true);
  result:=public.translation_initial_load_publish('a5271000-0000-4000-8000-000000000001',100);
  if coalesce((result->>'published')::integer,0)<1 or coalesce((result->>'remaining')::integer,-1)<>0 then raise exception 'Publicación incompleta: %',result;end if;
end $$;
reset role;
do $$
begin
  if not exists(select 1 from public.admin_audit_log where action='translation.initial_load.publish' and new_value->>'run_id'='a5271000-0000-4000-8000-000000000001') then raise exception 'Falta auditoría de publicación';end if;
  if exists(select 1 from public.translation_field_state s join public.translation_initial_load_groups g on g.run_id='a5271000-0000-4000-8000-000000000001' and g.resource_type=s.resource_type and g.field_name=s.field_name and g.source_hash=s.source_hash and g.target_language=s.target_language where g.status='applied' and (s.publication_status<>'published' or s.status<>'reviewed' or not s.is_protected or s.translated_source_hash<>s.source_hash or s.translated_revision<>s.source_revision)) then raise exception 'Estado publicado incoherente';end if;
end $$;
set local role service_role;
do $$
declare result jsonb;
begin
  perform set_config('request.jwt.claim.role','service_role',true);
  result:=public.translation_initial_load_publish('a5271000-0000-4000-8000-000000000001',100);
  if coalesce((result->>'published')::integer,-1)<>0 or coalesce((result->>'remaining')::integer,-1)<>0 then raise exception 'Replay no idempotente: %',result;end if;
end $$;
reset role;

set local role anon;
do $$begin begin perform public.translation_initial_load_status('a5271000-0000-4000-8000-000000000001');raise exception 'anon ejecutó RPC';exception when insufficient_privilege then null;end;end$$;
reset role;
set local role authenticated;
do $$begin begin perform public.translation_initial_load_enqueue('a5271000-0000-4000-8000-000000000001',1);raise exception 'authenticated ejecutó RPC';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
select 'translation_initial_load_postgres_test: PASS' result;
