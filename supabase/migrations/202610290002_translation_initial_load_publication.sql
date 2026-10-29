begin;

create or replace function public.translation_initial_load_publish(
  p_run_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  run_row public.translation_initial_load_runs%rowtype;
  state_row public.translation_field_state%rowtype;
  next_lock bigint;
  published_count integer:=0;
  skipped_count integer:=0;
  failed_count integer:=0;
  remaining_count bigint:=0;
begin
  if auth.role()<>'service_role' then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if p_run_id is null or p_limit not between 1 and 100 then
    raise exception 'Parámetros inválidos' using errcode='22023';
  end if;

  select * into run_row
  from public.translation_initial_load_runs
  where id=p_run_id;
  if not found then raise exception 'Ejecución no encontrada' using errcode='P0002'; end if;
  if not exists(select 1 from public.profiles where id=run_row.actor_user_id and role='super_admin') then
    raise exception 'La publicación inicial requiere un superadministrador' using errcode='42501';
  end if;

  -- Las funciones editoriales existentes leen auth.uid()/auth.role(). La
  -- identidad se fija solo para esta transacción y siempre corresponde al
  -- actor super_admin inmutable del run.
  perform set_config('request.jwt.claim.sub',run_row.actor_user_id::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  for state_row in
    select s.*
    from public.translation_field_state s
    where s.publication_status='unpublished'
      and s.workflow_status in('draft','in_review','approved')
      and s.draft_value is not null
      and s.draft_source_hash=s.source_hash
      and s.draft_source_revision=s.source_revision
      and s.status='machine_translated'
      and s.translation_method='libretranslate'
      and not s.is_protected
      and exists(
        select 1
        from public.translation_initial_load_groups g
        where g.run_id=p_run_id
          and g.status='applied'
          and g.resource_type=s.resource_type
          and g.field_name=s.field_name
          and g.source_hash=s.source_hash
          and g.target_language=s.target_language
          and coalesce(g.qa_codes,'{}'::text[]) <@ array['commercial_sensitive','translation_unchanged']::text[]
      )
    order by s.id
    for update of s skip locked
    limit p_limit
  loop
    begin
      perform public.translation_editor_assert_source(state_row);
      perform public.translation_validate_editor_value(state_row.resource_type,state_row.field_name,state_row.draft_value);
      next_lock:=state_row.lock_version;
      if state_row.workflow_status='draft' then
        next_lock:=public.translation_submit_review(state_row.id,next_lock);
      end if;
      if state_row.workflow_status in('draft','in_review') then
        next_lock:=public.translation_approve_draft(state_row.id,next_lock);
      end if;
      next_lock:=public.translation_publish_draft(state_row.id,next_lock);
      insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value)
      values(run_row.actor_user_id,'translation.initial_load.publish','translations',
        jsonb_build_object('state_id',state_row.id,'lock_version',state_row.lock_version,'workflow_status',state_row.workflow_status),
        jsonb_build_object('state_id',state_row.id,'lock_version',next_lock,'run_id',p_run_id,'publication_status','published'));
      published_count:=published_count+1;
    exception
      when serialization_failure or check_violation or invalid_parameter_value or no_data_found then
        failed_count:=failed_count+1;
        insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value)
        values(run_row.actor_user_id,'translation.initial_load.publish_skipped','translations',
          jsonb_build_object('state_id',state_row.id,'lock_version',state_row.lock_version),
          jsonb_build_object('state_id',state_row.id,'run_id',p_run_id,'reason','revalidation_failed'));
    end;
  end loop;

  select count(*) into remaining_count
  from public.translation_field_state s
  where s.publication_status='unpublished'
    and s.workflow_status in('draft','in_review','approved')
    and s.draft_value is not null
    and s.draft_source_hash=s.source_hash
    and s.draft_source_revision=s.source_revision
    and s.status='machine_translated'
    and s.translation_method='libretranslate'
    and not s.is_protected
    and exists(
      select 1 from public.translation_initial_load_groups g
      where g.run_id=p_run_id and g.status='applied'
        and g.resource_type=s.resource_type and g.field_name=s.field_name
        and g.source_hash=s.source_hash and g.target_language=s.target_language
        and coalesce(g.qa_codes,'{}'::text[]) <@ array['commercial_sensitive','translation_unchanged']::text[]
    );

  return jsonb_build_object('published',published_count,'skipped',skipped_count,'failed',failed_count,'remaining',remaining_count);
end $$;

revoke all on function public.translation_initial_load_publish(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.translation_initial_load_publish(uuid,integer) to service_role;

commit;
