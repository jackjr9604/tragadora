\set ON_ERROR_STOP on
set role supabase_admin;

do $$ begin
  if to_regclass('public.tradagora_local_e2e_guard') is null then
    raise exception 'ABORTADO: esta prueba solo puede ejecutarse sobre el baseline E2E local';
  end if;
end $$;

select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);

insert into public.blog_posts(id,slug,title,excerpt,body_markdown,category,tags,author_name,status)
values(
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd','e2e-resume-local-only',
  'Reanudación segura','Prueba sintética de interrupción.',
  E'# Reanudación\n\nEl trabajo debe continuar una sola vez.','Pruebas',array['e2e'],'E2E local','draft'
) on conflict(id) do nothing;

-- Two different batches select the same state. Concurrent enqueue must yield
-- one job generation and one reusable link, never duplicate jobs.
do $$
declare selection jsonb; state_row public.translation_field_state%rowtype;
begin
  select * into state_row from public.translation_field_state
  where resource_type='blog_post_translation'
    and resource_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    and field_name='title' and target_language='en';
  selection:=jsonb_build_array(jsonb_build_object(
    'state_id',state_row.id,'expected_lock_version',state_row.lock_version));
  perform public.translation_admin_create_batch(
    'dddddddd-0000-4000-8000-000000000001',selection,100,1000000);
  perform public.translation_admin_create_batch(
    'dddddddd-0000-4000-8000-000000000002',selection,100,1000000);
end $$;

create or replace function public.e2e_enqueue_overlap(p_key uuid) returns text
language plpgsql as $$
declare v_batch_id uuid; v_lock bigint; payload jsonb;
begin
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
  select id,lock_version into v_batch_id,v_lock from public.translation_batches
    where idempotency_key=p_key;
  payload:=public.translation_admin_enqueue_batch(v_batch_id,v_lock,1,3,100,1000000);
  return payload::text;
exception when serialization_failure or unique_violation then return 'concurrency_conflict';
end $$;

select dblink_connect('overlap_a','host=127.0.0.1 port=5432 dbname='||current_database()||' user=supabase_admin');
select dblink_connect('overlap_b','host=127.0.0.1 port=5432 dbname='||current_database()||' user=supabase_admin');
select dblink_send_query('overlap_a',$query$select public.e2e_enqueue_overlap('dddddddd-0000-4000-8000-000000000001')$query$);
select dblink_send_query('overlap_b',$query$select public.e2e_enqueue_overlap('dddddddd-0000-4000-8000-000000000002')$query$);
select * from dblink_get_result('overlap_a') as t(result text);
select * from dblink_get_result('overlap_b') as t(result text);
select dblink_disconnect('overlap_a');
select dblink_disconnect('overlap_b');
drop function public.e2e_enqueue_overlap(uuid);

do $$
declare jobs integer; links integer;
begin
  select count(*) into jobs from public.translation_jobs
  where resource_type='blog_post_translation'
    and resource_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    and field_name='title' and target_language='en';
  select count(*) into links from public.translation_batch_items
  where resource_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    and field_name='title' and target_language='en' and job_id is not null;
  if jobs<>1 or links<>2 then
    raise exception 'Overlapping batches produced jobs %, links %',jobs,links;
  end if;
end $$;

-- Simulate a worker interruption after claim. No attempt is changed manually;
-- only the local test clock/lease is expired so the real recovery RPC handles it.
select set_config('request.jwt.claim.role','service_role',false);
select * from public.translation_claim_ready_ai_jobs(
  'e2e-interrupted-worker',array['es','en','pt']::text[],1,30);
update public.translation_jobs set lease_expires_at=now()-interval '1 second'
where resource_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' and status='running';

-- Quota exhaustion preserves pending items, while protected content is excluded.
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
insert into public.blog_posts(id,slug,title,excerpt,body_markdown,category,tags,author_name,status)
values(
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','e2e-quota-local-only',
  'Control de cuota','No debe consumirse al agotarse la cuota.',
  E'# Cuota\n\nContenido sintético.','Pruebas',array['e2e'],'E2E local','draft'
) on conflict(id) do nothing;

do $$
declare eligible public.translation_field_state%rowtype; protected public.translation_field_state%rowtype;
  selection jsonb; protected_selection jsonb; v_batch_id uuid; payload jsonb; before_pending integer;
begin
  select * into eligible from public.translation_field_state
  where resource_type='blog_post_translation' and resource_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    and field_name='title' and target_language='en';
  selection:=jsonb_build_array(jsonb_build_object('state_id',eligible.id,'expected_lock_version',eligible.lock_version));
  v_batch_id:=public.translation_admin_create_batch('eeeeeeee-0000-4000-8000-000000000001',selection,1,1000000);
  select count(*) into before_pending from public.translation_batch_items i where i.batch_id=v_batch_id and i.status='pending';
  payload:=public.translation_admin_enqueue_batch(v_batch_id,
    (select lock_version from public.translation_batches where id=v_batch_id),1,3,1,1000000);
  if (payload->>'quota_exhausted')::boolean is not true
     or (select count(*) from public.translation_batch_items i where i.batch_id=v_batch_id and i.status='pending')<>before_pending then
    raise exception 'Quota exhaustion consumed a pending item';
  end if;

  select * into protected from public.translation_field_state
  where resource_type='blog_post_translation' and resource_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    and field_name='excerpt' and target_language='pt';
  update public.translation_field_state set is_protected=true,protection_reason='manual'
    where id=protected.id returning * into protected;
  protected_selection:=jsonb_build_array(jsonb_build_object(
    'state_id',protected.id,'expected_lock_version',protected.lock_version));
  payload:=public.translation_admin_bulk_preview(protected_selection,1,25,100,1000000);
  if payload#>>'{items,0,reason}'<>'protected' then
    raise exception 'Protected content was considered eligible: %',payload;
  end if;
end $$;

select status,attempt_count,lease_expires_at from public.translation_jobs
where resource_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
