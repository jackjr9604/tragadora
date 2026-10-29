create extension if not exists dblink with schema extensions;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('a5270000-0000-4000-8000-000000000098','authenticated','authenticated','initial-race@local.invalid',crypt('LocalOnly!',gen_salt('bf')),now(),'{}','{}',now(),now()) on conflict(id) do nothing;
select set_config('request.jwt.claim.role','service_role',false);
update public.profiles set role='super_admin' where id='a5270000-0000-4000-8000-000000000098';
set role service_role;
select public.translation_initial_load_start('a5271000-0000-4000-8000-000000000002','a5270000-0000-4000-8000-000000000098',3500,10000000);
reset role;

select extensions.dblink_connect('initial_a','dbname='||current_database());
select extensions.dblink_connect('initial_b','dbname='||current_database());
select extensions.dblink_exec('initial_a','set statement_timeout=''15s'';set role service_role;set request.jwt.claim.role=''service_role''');
select extensions.dblink_exec('initial_b','set statement_timeout=''15s'';set role service_role;set request.jwt.claim.role=''service_role''');
select extensions.dblink_send_query('initial_a',$q$select public.translation_initial_load_enqueue('a5271000-0000-4000-8000-000000000002',100)::text$q$);
select extensions.dblink_send_query('initial_b',$q$select public.translation_initial_load_enqueue('a5271000-0000-4000-8000-000000000002',100)::text$q$);

do $$declare deadline timestamptz:=clock_timestamp()+interval '20 seconds';begin
  while extensions.dblink_is_busy('initial_a')=1 or extensions.dblink_is_busy('initial_b')=1 loop
    if clock_timestamp()>deadline then raise exception 'Timeout de concurrencia';end if;perform pg_sleep(.05);
  end loop;
end$$;
select * from extensions.dblink_get_result('initial_a') as result(payload text);
select * from extensions.dblink_get_result('initial_b') as result(payload text);
select extensions.dblink_disconnect('initial_a');
select extensions.dblink_disconnect('initial_b');

do $$begin
  if exists(select 1 from public.translation_initial_load_groups where run_id='a5271000-0000-4000-8000-000000000002' group by resource_type,field_name,source_hash,target_language having count(*)>1) then raise exception 'Grupos duplicados bajo concurrencia';end if;
  if exists(select 1 from public.translation_initial_load_groups g1 join public.translation_initial_load_groups g2 on g1.run_id=g2.run_id and g1.job_id=g2.job_id and g1.ctid<>g2.ctid where g1.run_id='a5271000-0000-4000-8000-000000000002') then raise exception 'Job compartido por grupos distintos';end if;
  if (select count(*) from public.translation_initial_load_groups where run_id='a5271000-0000-4000-8000-000000000002')=0 then raise exception 'La carrera no encoló grupos';end if;
end$$;

delete from public.translation_initial_load_groups where run_id='a5271000-0000-4000-8000-000000000002';
delete from public.translation_jobs where metadata->>'initial_load_run_id'='a5271000-0000-4000-8000-000000000002';
delete from public.translation_initial_load_runs where id='a5271000-0000-4000-8000-000000000002';
-- El usuario sintético vive solo en esta base descartable. El trigger impide
-- eliminar al último super_admin; el runner destruye la base completa al salir.
select 'translation_initial_load_concurrency_test: PASS' result;
