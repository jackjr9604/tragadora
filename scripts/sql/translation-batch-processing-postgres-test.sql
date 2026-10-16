\set ON_ERROR_STOP on

-- PostgreSQL 15 isolated regression coverage for 3E.8.4B.
set role postgres;
select set_config('app.test_role','authenticated',false);
select set_config('app.test_user_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select set_config('app.test_permissions','blog.view,blog.update',false);

do $$
declare
  selected jsonb;
  preview jsonb;
  created jsonb;
  v_batch_id uuid;
  batch_lock bigint;
  first_result jsonb;
  second_result jsonb;
  third_result jsonb;
  job_count integer;
  pending_count integer;
begin
  select jsonb_agg(jsonb_build_object('state_id',id,'expected_lock_version',lock_version)
    order by id) into selected
  from (select id,lock_version from public.translation_field_state
    where resource_type='blog_post_translation' and target_language in ('en','pt')
      and status in ('missing','error','stale') and workflow_status='none'
      and publication_status='unpublished' and not is_protected
    order by id limit 4) s;
  if jsonb_array_length(coalesce(selected,'[]'::jsonb))<2 then
    raise exception 'No hay estados elegibles suficientes para la prueba';
  end if;

  preview:=public.translation_admin_bulk_preview(selected,1,50,100,200000);
  v_batch_id:=public.translation_admin_create_batch(
    'aaaaaaaa-0000-4000-8000-000000000001',selected,100,200000);
  select lock_version into batch_lock from public.translation_batches where id=v_batch_id;

  first_result:=public.translation_admin_enqueue_batch(v_batch_id,batch_lock,1,3,100,1000000);
  second_result:=public.translation_admin_enqueue_batch(v_batch_id,(first_result->>'lock_version')::bigint,50,3,100,1000000);
  third_result:=public.translation_admin_enqueue_batch(v_batch_id,(second_result->>'lock_version')::bigint,50,3,100,1000000);

  select count(distinct job_id),count(*) filter(where status='pending')
    into job_count,pending_count from public.translation_batch_items where batch_id=v_batch_id;
  if pending_count<>0 or job_count<>(select eligible_count from public.translation_batches where id=v_batch_id) then
    raise exception 'reanudacion no fue idempotente';
  end if;
  if (third_result->>'queued')::integer<>0 or (third_result->>'reused')::integer<>0 then
    raise exception 'reanudacion duplico trabajos';
  end if;

  update public.translation_jobs set status='succeeded',completed_at=now(),updated_at=now()
    where id in (select job_id from public.translation_batch_items where batch_id=v_batch_id);
  if (select status from public.translation_batches where id=v_batch_id)<>'completed' then
    raise exception 'seguimiento no completo el lote';
  end if;

  if public.translation_admin_batch_detail(v_batch_id,null,1,25)->>'total' is null
     or public.translation_admin_batches_inventory(null,1,25)->>'total' is null then
    raise exception 'consultas paginadas invalidas';
  end if;
end $$;

do $$
declare selected jsonb; preview jsonb; created jsonb; v_batch_id uuid; before_pending integer; result jsonb;
begin
  select jsonb_agg(jsonb_build_object('state_id',id,'expected_lock_version',lock_version)) into selected
  from (select id,lock_version from public.translation_field_state s
    where resource_type='blog_post_translation' and target_language in ('en','pt')
      and status in ('missing','error','stale') and workflow_status='none'
      and publication_status='unpublished' and not is_protected
      and not exists(select 1 from public.translation_jobs j where j.resource_type=s.resource_type
        and j.resource_id=s.resource_id and j.field_name=s.field_name and j.target_language=s.target_language)
    limit 1) q;
  if selected is null then return; end if;
  preview:=public.translation_admin_bulk_preview(selected,1,50,100,200000);
  v_batch_id:=public.translation_admin_create_batch('aaaaaaaa-0000-4000-8000-000000000002',selected,100,200000);
  select count(*) into before_pending from public.translation_batch_items where batch_id=v_batch_id and status='pending';
  result:=public.translation_admin_enqueue_batch(v_batch_id,
    (select lock_version from public.translation_batches where id=v_batch_id),1,3,1,100);
  if (result->>'quota_exhausted')::boolean is not true
     or (select count(*) from public.translation_batch_items where batch_id=v_batch_id and status='pending')<>before_pending then
    raise exception 'cuota consumio elementos pendientes';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon','public.translation_admin_enqueue_batch(uuid,bigint,integer,integer,integer,integer)','EXECUTE')
     or has_function_privilege('service_role','public.translation_admin_enqueue_batch(uuid,bigint,integer,integer,integer,integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.translation_admin_enqueue_batch(uuid,bigint,integer,integer,integer,integer)','EXECUTE') then
    raise exception 'privilegios RPC incorrectos';
  end if;
  if exists(select 1 from public.translation_jobs where estimated_cost_usd<>0) then
    raise exception 'los lotes registraron costos';
  end if;
end $$;

select 'translation batch processing postgres tests passed' as result;
