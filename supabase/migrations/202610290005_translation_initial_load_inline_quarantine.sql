begin;

-- Mantiene la firma ya expuesta por PostgREST e integra la cuarentena en la
-- misma transaccion del lote. No depende de que aparezca una RPC adicional en
-- la cache de esquema durante la carga inicial.
create or replace function public.translation_initial_load_publish(p_run_id uuid,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare run_row public.translation_initial_load_runs%rowtype;state_row public.translation_field_state%rowtype;platform_row record;
  next_lock bigint;published_count integer:=0;failed_count integer:=0;quarantined_count integer:=0;remaining_count bigint:=0;
  short_value jsonb;description_value jsonb;pros_value jsonb;cons_value jsonb;seo_title_value jsonb;seo_description_value jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501';end if;
  if p_run_id is null or p_limit not between 1 and 100 then raise exception 'Parámetros inválidos' using errcode='22023';end if;
  select * into run_row from public.translation_initial_load_runs where id=p_run_id;
  if not found then raise exception 'Ejecución no encontrada' using errcode='P0002';end if;
  if not exists(select 1 from public.profiles where id=run_row.actor_user_id and role='super_admin') then raise exception 'La publicación inicial requiere un superadministrador' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended('translation-initial-load-publish-'||p_run_id::text,0));
  perform set_config('request.jwt.claim.sub',run_row.actor_user_id::text,true);perform set_config('request.jwt.claim.role','authenticated',true);

  for platform_row in
    select s.resource_id,s.target_language,jsonb_agg(s.id::text) state_ids
    from public.translation_field_state s
    where s.resource_type='platform_translation' and s.publication_status='unpublished'
      and s.workflow_status in('draft','in_review','approved') and s.draft_value is not null
      and s.draft_source_hash=s.source_hash and s.draft_source_revision=s.source_revision
      and s.status='machine_translated' and s.translation_method='libretranslate' and not s.is_protected
      and exists(select 1 from public.translation_initial_load_groups g where g.run_id=p_run_id and g.status='applied'
        and g.resource_type=s.resource_type and g.field_name=s.field_name and g.source_hash=s.source_hash and g.target_language=s.target_language
        and coalesce(g.qa_codes,'{}')<@array['commercial_sensitive','translation_unchanged']::text[])
      and not exists(select 1 from public.platform_translations pt where pt.platform_id=s.resource_id::uuid and pt.language=s.target_language)
    group by s.resource_id,s.target_language
  loop
    select
      (array_agg(draft_value) filter(where field_name='short_description'))[1],
      (array_agg(draft_value) filter(where field_name='description'))[1],
      (array_agg(draft_value) filter(where field_name='pros'))[1],
      (array_agg(draft_value) filter(where field_name='cons'))[1],
      (array_agg(draft_value) filter(where field_name='seo_title'))[1],
      (array_agg(draft_value) filter(where field_name='seo_description'))[1]
    into short_value,description_value,pros_value,cons_value,seo_title_value,seo_description_value
    from public.translation_field_state where id in(select (jsonb_array_elements_text(platform_row.state_ids))::uuid);
    perform set_config('app.translation_editor_publish_batch',platform_row.state_ids::text,true);
    insert into public.platform_translations(platform_id,language,short_description,description,pros,cons,seo_title,seo_description)
    values(platform_row.resource_id::uuid,platform_row.target_language,short_value#>>'{}',description_value#>>'{}',coalesce(pros_value,'[]'),coalesce(cons_value,'[]'),seo_title_value#>>'{}',seo_description_value#>>'{}')
    on conflict(platform_id,language) do nothing;
    perform set_config('app.translation_editor_publish_batch','',true);
  end loop;

  for state_row in select s.* from public.translation_field_state s where s.publication_status='unpublished'
    and s.workflow_status in('draft','in_review','approved') and s.draft_value is not null
    and s.draft_source_hash=s.source_hash and s.draft_source_revision=s.source_revision
    and s.status='machine_translated' and s.translation_method='libretranslate' and not s.is_protected
    and exists(select 1 from public.translation_initial_load_groups g where g.run_id=p_run_id and g.status='applied'
      and g.resource_type=s.resource_type and g.field_name=s.field_name and g.source_hash=s.source_hash and g.target_language=s.target_language
      and coalesce(g.qa_codes,'{}')<@array['commercial_sensitive','translation_unchanged']::text[])
    order by s.id for update of s skip locked limit p_limit
  loop begin
    perform public.translation_editor_assert_source(state_row);perform public.translation_validate_editor_value(state_row.resource_type,state_row.field_name,state_row.draft_value);next_lock:=state_row.lock_version;
    if state_row.workflow_status='draft' then next_lock:=public.translation_submit_review(state_row.id,next_lock);end if;
    if state_row.workflow_status in('draft','in_review') then next_lock:=public.translation_approve_draft(state_row.id,next_lock);end if;
    next_lock:=public.translation_publish_draft(state_row.id,next_lock);
    insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value) values(run_row.actor_user_id,'translation.initial_load.publish','translations',jsonb_build_object('state_id',state_row.id,'lock_version',state_row.lock_version,'workflow_status',state_row.workflow_status),jsonb_build_object('state_id',state_row.id,'lock_version',next_lock,'run_id',p_run_id,'publication_status','published'));
    published_count:=published_count+1;
  exception when serialization_failure or check_violation or not_null_violation or invalid_parameter_value or no_data_found then
    failed_count:=failed_count+1;
    update public.translation_field_state set status='error',last_error_code='initial_load_publish_revalidation_failed',
      last_error='La publicación inicial omitió este borrador por un conflicto de integridad. Requiere revisión.',
      lock_version=lock_version+1,updated_at=now()
    where id=state_row.id and publication_status='unpublished' and status='machine_translated';
    if found then quarantined_count:=quarantined_count+1;end if;
    insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value) values(run_row.actor_user_id,'translation.initial_load.publish_skipped','translations',jsonb_build_object('state_id',state_row.id,'lock_version',state_row.lock_version),jsonb_build_object('state_id',state_row.id,'run_id',p_run_id,'reason','revalidation_failed','quarantined',true));
  end;end loop;
  select count(*) into remaining_count from public.translation_field_state s where s.publication_status='unpublished' and s.workflow_status in('draft','in_review','approved') and s.draft_value is not null and s.draft_source_hash=s.source_hash and s.draft_source_revision=s.source_revision and s.status='machine_translated' and s.translation_method='libretranslate' and not s.is_protected and exists(select 1 from public.translation_initial_load_groups g where g.run_id=p_run_id and g.status='applied' and g.resource_type=s.resource_type and g.field_name=s.field_name and g.source_hash=s.source_hash and g.target_language=s.target_language and coalesce(g.qa_codes,'{}')<@array['commercial_sensitive','translation_unchanged']::text[]);
  return jsonb_build_object('published',published_count,'failed',failed_count,'quarantined',quarantined_count,'remaining',remaining_count);
end $$;

revoke all on function public.translation_initial_load_publish(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.translation_initial_load_publish(uuid,integer) to service_role;

commit;
