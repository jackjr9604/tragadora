\set ON_ERROR_STOP on

-- Local-only synthetic fixture for 3E.8.4.6. This file is never part of the
-- production migration chain and must run only against the isolated stack.
set role supabase_admin;

do $$ begin
  if to_regclass('public.tradagora_local_e2e_guard') is null then
    raise exception 'ABORTADO: esta prueba solo puede ejecutarse sobre el baseline E2E local';
  end if;
end $$;

insert into auth.users(
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated',
  'e2e-admin@local.invalid',crypt('LocalOnly-3E8!',gen_salt('bf')),now(),
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()
) on conflict(id) do nothing;

select set_config('request.jwt.claim.role','service_role',false);
update public.profiles set role='super_admin'
where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select public.translation_worker_report_languages(array['es','en','pt']::text[]);
-- Production metadata confirms EN/PT auto_translate=true. Historical seeds do
-- not reproduce that data-level configuration, so the local fixture does.
update public.languages set auto_translate=(code in ('en','pt')) where code in ('es','en','pt');

insert into public.blog_posts(
  id,slug,title,excerpt,body_markdown,category,tags,author_name,status
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','e2e-bulk-local-only',
  'Guía local de gestión de riesgo',
  'Contenido sintético para validar lotes sin tocar datos reales.',
  E'# Gestión de riesgo\n\nConserva el enlace [Tradagora](https://tradagora.com) y `risk_limit`.\n\n- Primer paso\n- Segundo paso',
  'Educación',array['riesgo','prueba'],'E2E local','draft'
) on conflict(id) do nothing;

select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);

do $$
declare selection jsonb; preview jsonb; v_batch_id uuid; lock_value bigint; first_run jsonb; second_run jsonb;
begin
  select jsonb_agg(jsonb_build_object('state_id',id,'expected_lock_version',lock_version)
    order by field_name,target_language) into selection
  from public.translation_field_state
  where resource_type='blog_post_translation'
    and resource_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    and target_language in ('en','pt')
    and status in ('missing','error','stale') and workflow_status='none'
    and publication_status='unpublished' and not is_protected;

  if jsonb_array_length(coalesce(selection,'[]'::jsonb)) <> 10 then
    raise exception 'Expected 10 synthetic translation states, got %',jsonb_array_length(coalesce(selection,'[]'::jsonb));
  end if;

  preview:=public.translation_admin_bulk_preview(selection,1,25,100,1000000);
  if (preview->>'eligible_count')::integer<>10 or (preview->>'excluded_count')::integer<>0 then
    raise exception 'Unexpected preview: %',preview;
  end if;

  v_batch_id:=public.translation_admin_create_batch(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',selection,100,1000000);
  if v_batch_id<>public.translation_admin_create_batch(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',selection,100,1000000) then
    raise exception 'Batch creation is not idempotent';
  end if;

  select lock_version into lock_value from public.translation_batches where id=v_batch_id;
  first_run:=public.translation_admin_enqueue_batch(v_batch_id,lock_value,4,3,100,1000000);
  second_run:=public.translation_admin_enqueue_batch(v_batch_id,
    (first_run->>'lock_version')::bigint,50,3,100,1000000);

  if (select count(distinct job_id) from public.translation_batch_items i where i.batch_id=v_batch_id)<>10
     or (select count(*) from public.translation_batch_items i where i.batch_id=v_batch_id and i.status='pending')<>0 then
    raise exception 'Initial enqueue did not create exactly one job per item';
  end if;
  if exists(select 1 from public.translation_jobs where estimated_cost_usd<>0) then
    raise exception 'A local job registered non-zero cost';
  end if;
end $$;

-- Two real PostgreSQL sessions race on the same already-enqueued batch. Both
-- must converge without creating another generation or duplicate job.
create extension if not exists dblink;
create or replace function public.e2e_enqueue_same_batch() returns text
language plpgsql as $$
declare payload jsonb; current_lock bigint;
begin
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
  select lock_version into current_lock from public.translation_batches
    where id=(select id from public.translation_batches where idempotency_key='cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  payload:=public.translation_admin_enqueue_batch(
    (select id from public.translation_batches where idempotency_key='cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
    current_lock,50,3,100,1000000);
  return payload::text;
exception when serialization_failure then return 'concurrency_conflict';
end $$;

select dblink_connect('e2e_a','host=127.0.0.1 port=5432 dbname='||current_database()||' user=supabase_admin');
select dblink_connect('e2e_b','host=127.0.0.1 port=5432 dbname='||current_database()||' user=supabase_admin');
select dblink_send_query('e2e_a','select public.e2e_enqueue_same_batch()');
select dblink_send_query('e2e_b','select public.e2e_enqueue_same_batch()');
select * from dblink_get_result('e2e_a') as t(result text);
select * from dblink_get_result('e2e_b') as t(result text);
select dblink_disconnect('e2e_a');
select dblink_disconnect('e2e_b');
drop function public.e2e_enqueue_same_batch();

do $$
declare v_batch_id uuid;
begin
  select id into v_batch_id from public.translation_batches
  where idempotency_key='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  if (select count(*) from public.translation_jobs j where j.resource_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>10
     or (select count(distinct job_id) from public.translation_batch_items i where i.batch_id=v_batch_id)<>10 then
    raise exception 'Concurrent resume duplicated jobs';
  end if;

  -- Quota exhaustion must leave a fresh eligible item pending.
  update public.translation_field_state set status='missing',workflow_status='none',publication_status='unpublished'
  where resource_type='blog_post_translation' and resource_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  if has_table_privilege('authenticated','public.translation_batches','SELECT')
     or has_table_privilege('authenticated','public.translation_batch_items','SELECT') then
    raise exception 'Batch tables are exposed directly';
  end if;
  if has_function_privilege('anon','public.translation_admin_enqueue_batch(uuid,bigint,integer,integer,integer,integer)','EXECUTE')
     or has_function_privilege('service_role','public.translation_admin_enqueue_batch(uuid,bigint,integer,integer,integer,integer)','EXECUTE') then
    raise exception 'Batch enqueue RPC has unsafe grants';
  end if;
end $$;

select id as e2e_batch_id,lock_version,status from public.translation_batches
where idempotency_key='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
select count(*) as queued_jobs from public.translation_jobs
where resource_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and status='queued';
