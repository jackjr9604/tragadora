begin;

-- 3E.8.4B: encolado limitado, seguimiento persistente y reanudacion segura.
-- No cambia translation_jobs, el worker ni el workflow editorial.

do $$
begin
  if to_regclass('public.translation_batches') is null
     or to_regclass('public.translation_batch_items') is null
     or to_regprocedure('public.translation_request_ai_draft(uuid,bigint,integer,integer,integer,integer,boolean)') is null then
    raise exception 'Faltan dependencias de 3E.8.4A o del motor local';
  end if;
end
$$;

alter table public.translation_batch_items
  add column if not exists result_code text;

alter table public.translation_batch_items
  drop constraint if exists translation_batch_items_result_code_check;
alter table public.translation_batch_items
  add constraint translation_batch_items_result_code_check check(
    result_code is null or result_code ~ '^[a-z][a-z0-9_]{1,99}$');

create index if not exists translation_batch_items_pending_idx
  on public.translation_batch_items(batch_id,created_at,id)
  where status='pending';

create or replace function public.translation_batch_can_manage_resource(p_resource_type text)
returns boolean language sql stable security definer
set search_path=pg_catalog,public as $$
  select public.has_admin_permission(case
    when p_resource_type='site_content' then 'content.update'
    when p_resource_type in ('platform_translation','broker_detail_translation','exchange_detail_translation') then 'platforms.update'
    when p_resource_type='offer_translation' then 'offers.update'
    when p_resource_type in ('challenge_phase_translation','challenge_variant_translation',
      'challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation') then 'challenges.update'
    when p_resource_type='tool_translation' then 'tools.update'
    when p_resource_type='community_translation' then 'communities.update'
    when p_resource_type='giveaway_translation' then 'giveaways.update'
    when p_resource_type='blog_post_translation' then 'blog.update'
    else '__invalid__' end) is true
$$;

create or replace function public.translation_batch_assert_access(p_batch_id uuid)
returns void language plpgsql stable security definer
set search_path=pg_catalog,public as $$
begin
  if auth.uid() is null or auth.role()<>'authenticated' then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if not exists(select 1 from public.translation_batches where id=p_batch_id) then
    raise exception 'Lote no encontrado' using errcode='P0002';
  end if;
  if exists(select 1 from public.translation_batch_items i where i.batch_id=p_batch_id
    and not public.translation_batch_can_manage_resource(i.resource_type)) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
end
$$;

create or replace function public.translation_batch_safe_job_result(p_status text,p_error_code text)
returns text language sql immutable
set search_path=pg_catalog,public as $$
  select case
    when p_status='succeeded' then 'completed'
    when p_status='cancelled' then 'job_cancelled'
    when p_error_code in ('local_provider_unavailable','lease_expired') then p_error_code
    when p_error_code in ('source_changed','source_deleted','resource_disabled') then 'source_unavailable'
    when p_error_code in ('protected_content_validation','translation_failed') then 'content_validation_failed'
    when p_error_code is null then 'job_failed'
    else 'job_failed' end
$$;

create or replace function public.translation_batch_refresh(p_batch_id uuid)
returns void language plpgsql security definer
set search_path=pg_catalog,public as $$
declare pending_total integer; reusable_total integer; queued_total integer; running_total integer;
  succeeded_total integer; failed_total integer; skipped_total integer; eligible_total integer;
  next_status text; terminal_at timestamptz;
begin
  select b.eligible_count,
    count(*) filter(where i.status='pending'),count(*) filter(where i.status='reusable'),
    count(*) filter(where i.status='queued'),count(*) filter(where i.status='running'),
    count(*) filter(where i.status='succeeded'),count(*) filter(where i.status in ('failed','cancelled')),
    count(*) filter(where i.status='skipped')
  into eligible_total,pending_total,reusable_total,queued_total,running_total,
    succeeded_total,failed_total,skipped_total
  from public.translation_batches b left join public.translation_batch_items i on i.batch_id=b.id
  where b.id=p_batch_id group by b.id,b.eligible_count;
  if not found then return; end if;

  next_status:=case
    when eligible_total=0 then 'prepared'
    when running_total>0 then 'processing'
    when pending_total>0 and (reusable_total+queued_total+succeeded_total+failed_total+skipped_total)>0 then 'partially_queued'
    when pending_total>0 then 'prepared'
    when reusable_total+queued_total>0 then 'queued'
    when succeeded_total=eligible_total then 'completed'
    when succeeded_total>0 then 'partial'
    else 'failed' end;
  terminal_at:=case when next_status in ('completed','partial','failed','cancelled') then now() end;
  update public.translation_batches set status=next_status,queued_count=queued_total+running_total,
    reused_count=reusable_total,succeeded_count=succeeded_total,failed_count=failed_total,
    skipped_count=skipped_total,completed_at=terminal_at,updated_at=now()
  where id=p_batch_id;
end
$$;

create or replace function public.translation_batch_sync_job()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public as $$
declare linked_batch uuid;
begin
  for linked_batch in
    update public.translation_batch_items set
      status=case new.status
        when 'queued' then 'queued' when 'retry_wait' then 'queued'
        when 'running' then 'running' when 'succeeded' then 'succeeded'
        when 'failed' then 'failed' when 'cancelled' then 'cancelled' else status end,
      result_code=case when new.status in ('failed','cancelled','succeeded')
        then public.translation_batch_safe_job_result(new.status,new.error_code) else null end,
      updated_at=now()
    where job_id=new.id and (status,result_code) is distinct from (
      case new.status when 'queued' then 'queued' when 'retry_wait' then 'queued'
        when 'running' then 'running' when 'succeeded' then 'succeeded'
        when 'failed' then 'failed' when 'cancelled' then 'cancelled' else status end,
      case when new.status in ('failed','cancelled','succeeded')
        then public.translation_batch_safe_job_result(new.status,new.error_code) else null end)
    returning batch_id
  loop
    perform public.translation_batch_refresh(linked_batch);
  end loop;
  return new;
end
$$;

drop trigger if exists translation_batch_job_sync on public.translation_jobs;
create trigger translation_batch_job_sync after update of status,error_code,completed_at on public.translation_jobs
for each row when (old.status is distinct from new.status or old.error_code is distinct from new.error_code)
execute function public.translation_batch_sync_job();

create or replace function public.translation_admin_enqueue_batch(
  p_batch_id uuid,p_expected_lock_version bigint,p_limit integer default 20,
  p_max_attempts integer default 3,p_daily_request_limit integer default 20,
  p_daily_character_limit integer default 100000
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public as $$
declare batch_row public.translation_batches%rowtype; item_row public.translation_batch_items%rowtype;
  state_row public.translation_field_state%rowtype; job_row public.translation_jobs%rowtype;
  source_value jsonb; processed integer:=0; queued integer:=0; reused integer:=0;
  skipped integer:=0; failed integer:=0; quota_exhausted boolean:=false; code text;
begin
  if p_limit not between 1 and 50 or p_max_attempts not between 1 and 5
     or p_daily_request_limit not between 1 and 100
     or p_daily_character_limit not between 100 and 1000000 then
    raise exception 'Parametros de encolado invalidos' using errcode='22023';
  end if;
  perform public.translation_batch_assert_access(p_batch_id);
  select * into batch_row from public.translation_batches where id=p_batch_id for update;
  if p_expected_lock_version is null or batch_row.lock_version<>p_expected_lock_version then
    raise exception 'El lote cambio en otra sesion; recargue antes de continuar' using errcode='40001';
  end if;
  if batch_row.status in ('completed','partial','failed','cancelled') then
    return jsonb_build_object('batch_id',batch_row.id,'processed',0,'queued',0,'reused',0,
      'skipped',0,'failed',0,'quota_exhausted',false,'lock_version',batch_row.lock_version);
  end if;

  for item_row in select * from public.translation_batch_items
    where batch_id=p_batch_id and status='pending' order by created_at,id
    for update skip locked limit p_limit
  loop
    processed:=processed+1;
    state_row:=null;
    select * into state_row from public.translation_field_state where id=item_row.state_id for update;
    code:=null;
    if state_row.id is null then code:='state_missing';
    else
      perform public.translation_assert_admin_permission(item_row.resource_type);
    end if;
    if code is not null then null;
    elsif state_row.resource_type<>item_row.resource_type or state_row.resource_id<>item_row.resource_id
       or state_row.field_name<>item_row.field_name or state_row.target_language<>item_row.target_language then code:='identity_changed';
    elsif state_row.lock_version<>item_row.state_lock_version then code:='stale_selection';
    elsif state_row.source_hash<>item_row.source_hash or state_row.source_revision<>item_row.source_revision then code:='source_changed';
    elsif state_row.is_protected then code:='protected';
    elsif state_row.publication_status='published' then code:='published';
    elsif state_row.workflow_status<>'none' then code:='editorial_workflow_active';
    elsif state_row.status not in ('missing','error','stale') then code:='state_not_eligible';
    else
      source_value:=public.translation_read_value(state_row.resource_type,state_row.resource_id,
        state_row.field_name,state_row.source_language);
      if not public.translation_value_present(source_value) then code:='source_unavailable';
      elsif public.translation_hash(source_value)<>state_row.source_hash then code:='source_changed';
      elsif public.translation_batch_input_characters(source_value)<>item_row.input_characters then code:='source_changed';
      end if;
    end if;
    if code is not null then
      update public.translation_batch_items set status='skipped',result_code=code,updated_at=now()
      where id=item_row.id;
      skipped:=skipped+1; continue;
    end if;

    select * into job_row from public.translation_jobs j where
      j.resource_type=state_row.resource_type and j.resource_id=state_row.resource_id
      and j.field_name=state_row.field_name and j.target_language=state_row.target_language
      and j.source_hash=state_row.source_hash and j.source_revision=state_row.source_revision
      and j.status in ('queued','running','retry_wait') order by j.created_at desc limit 1 for update;
    if found then
      update public.translation_batch_items set job_id=job_row.id,status='reusable',result_code=null,updated_at=now()
      where id=item_row.id;
      reused:=reused+1; continue;
    end if;

    begin
      job_row:=public.translation_request_ai_draft(state_row.id,state_row.lock_version,
        item_row.input_characters,p_max_attempts,p_daily_request_limit,p_daily_character_limit,false);
      update public.translation_batch_items set job_id=job_row.id,
        status=case when job_row.status='running' then 'running' else 'queued' end,
        result_code=null,updated_at=now() where id=item_row.id;
      queued:=queued+1;
    exception
      when sqlstate '54000' then quota_exhausted:=true; processed:=processed-1; exit;
      when serialization_failure then
        update public.translation_batch_items set status='skipped',result_code='concurrent_change',updated_at=now()
        where id=item_row.id; skipped:=skipped+1;
      when insufficient_privilege then raise;
      when others then
        update public.translation_batch_items set status='failed',result_code='enqueue_failed',updated_at=now()
        where id=item_row.id; failed:=failed+1;
    end;
  end loop;

  perform public.translation_batch_refresh(p_batch_id);
  update public.translation_batches set lock_version=lock_version+1,updated_at=now()
  where id=p_batch_id returning * into batch_row;
  insert into public.admin_audit_log(actor_user_id,action,module,new_value)
  values(auth.uid(),'translation_batch.enqueue','translations',jsonb_build_object(
    'batch_id',p_batch_id,'processed',processed,'queued',queued,'reused',reused,
    'skipped',skipped,'failed',failed,'quota_exhausted',quota_exhausted));
  return jsonb_build_object('batch_id',p_batch_id,'processed',processed,'queued',queued,
    'reused',reused,'skipped',skipped,'failed',failed,'quota_exhausted',quota_exhausted,
    'lock_version',batch_row.lock_version,'status',batch_row.status);
end
$$;

create or replace function public.translation_admin_batches_inventory(
  p_status text default null,p_page integer default 1,p_page_size integer default 25
)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public as $$
declare payload jsonb;
begin
  if auth.uid() is null or auth.role()<>'authenticated' then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_page<1 or p_page_size not in (25,50,100)
     or (p_status is not null and p_status not in ('prepared','partially_queued','queued','processing','completed','partial','failed','cancelled')) then
    raise exception 'Filtros de lotes invalidos' using errcode='22023';
  end if;
  with allowed as (
    select b.* from public.translation_batches b where (p_status is null or b.status=p_status)
      and not exists(select 1 from public.translation_batch_items i where i.batch_id=b.id
        and not public.translation_batch_can_manage_resource(i.resource_type))
  ), page_rows as (
    select id,status,requested_languages,selection_count,eligible_count,excluded_count,
      estimated_characters,queued_count,reused_count,succeeded_count,failed_count,skipped_count,
      lock_version,created_at,updated_at,completed_at
    from allowed order by created_at desc,id offset (p_page-1)*p_page_size limit p_page_size
  ) select jsonb_build_object('total',(select count(*) from allowed),'page',p_page,
    'page_size',p_page_size,'pages',ceil((select count(*) from allowed)::numeric/p_page_size)::integer,
    'items',coalesce((select jsonb_agg(to_jsonb(page_rows) order by created_at desc,id) from page_rows),'[]'::jsonb))
  into payload;
  return payload;
end
$$;

create or replace function public.translation_admin_batch_detail(
  p_batch_id uuid,p_item_status text default null,p_page integer default 1,p_page_size integer default 50
)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public as $$
declare payload jsonb;
begin
  perform public.translation_batch_assert_access(p_batch_id);
  if p_page<1 or p_page_size not in (25,50,100)
     or (p_item_status is not null and p_item_status not in
       ('pending','reusable','excluded','queued','running','succeeded','failed','skipped','cancelled')) then
    raise exception 'Filtros de detalle invalidos' using errcode='22023';
  end if;
  with filtered as (
    select i.id,i.resource_type,i.resource_id,i.field_name,i.source_language,i.target_language,
      i.request_mode,i.status,i.exclusion_reason,i.result_code,i.input_characters,i.job_id,
      i.created_at,i.updated_at
    from public.translation_batch_items i where i.batch_id=p_batch_id
      and (p_item_status is null or i.status=p_item_status)
  ), page_rows as (
    select * from filtered order by created_at,id offset (p_page-1)*p_page_size limit p_page_size
  ) select jsonb_build_object('batch',(select to_jsonb(b)-'created_by'-'idempotency_key'
      from public.translation_batches b where b.id=p_batch_id),
    'total',(select count(*) from filtered),'page',p_page,'page_size',p_page_size,
    'pages',ceil((select count(*) from filtered)::numeric/p_page_size)::integer,
    'items',coalesce((select jsonb_agg(to_jsonb(page_rows) order by created_at,id) from page_rows),'[]'::jsonb))
  into payload;
  return payload;
end
$$;

revoke all on function public.translation_batch_can_manage_resource(text) from public,anon,authenticated,service_role;
revoke all on function public.translation_batch_assert_access(uuid) from public,anon,authenticated,service_role;
revoke all on function public.translation_batch_safe_job_result(text,text) from public,anon,authenticated,service_role;
revoke all on function public.translation_batch_refresh(uuid) from public,anon,authenticated,service_role;
revoke all on function public.translation_batch_sync_job() from public,anon,authenticated,service_role;
revoke all on function public.translation_admin_enqueue_batch(uuid,bigint,integer,integer,integer,integer) from public,anon,authenticated,service_role;
revoke all on function public.translation_admin_batches_inventory(text,integer,integer) from public,anon,authenticated,service_role;
revoke all on function public.translation_admin_batch_detail(uuid,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.translation_admin_enqueue_batch(uuid,bigint,integer,integer,integer,integer) to authenticated;
grant execute on function public.translation_admin_batches_inventory(text,integer,integer) to authenticated;
grant execute on function public.translation_admin_batch_detail(uuid,text,integer,integer) to authenticated;

commit;
