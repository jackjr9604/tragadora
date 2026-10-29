begin;

-- El adaptador histórico hace un UPSERT con NULL explícito en pros/cons al
-- publicar campos textuales. PostgreSQL valida los NOT NULL antes del conflicto.
-- Este guard solo actúa dentro de la publicación editorial autorizada.
create or replace function public.translation_platform_publish_defaults()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if nullif(current_setting('app.translation_editor_publish_state',true),'') is not null then
    new.pros:=coalesce(new.pros,'[]'::jsonb);
    new.cons:=coalesce(new.cons,'[]'::jsonb);
  end if;
  return new;
end $$;
drop trigger if exists translation_platform_publish_defaults on public.platform_translations;
create trigger translation_platform_publish_defaults before insert on public.platform_translations
for each row execute function public.translation_platform_publish_defaults();

create or replace function public.translation_initial_load_close_pending(
  p_run_id uuid,p_items jsonb
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare run_row public.translation_initial_load_runs%rowtype;item jsonb;state_row public.translation_field_state%rowtype;
  next_lock bigint;published_count integer:=0;skipped_count integer:=0;error_count integer:=0;
  results jsonb:='[]'::jsonb;error_state text;platform_row record;batch_ids jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501';end if;
  if p_run_id is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Parámetros inválidos' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_items) value where jsonb_typeof(value)<>'object'
    or value-'state_id'-'expected_lock_version'-'source_hash'-'source_revision'-'value'<>'{}'::jsonb
    or coalesce(value->>'state_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(value->>'expected_lock_version','')!~'^[1-9][0-9]*$' or coalesce(value->>'source_revision','')!~'^[1-9][0-9]*$'
    or coalesce(value->>'source_hash','')!~'^[0-9a-f]{64}$' or not(value?'value')) then raise exception 'Payload inválido' using errcode='22023';end if;
  if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct value->>'state_id') from jsonb_array_elements(p_items)) then raise exception 'Payload duplicado' using errcode='22023';end if;
  select * into run_row from public.translation_initial_load_runs where id=p_run_id;
  if not found or not exists(select 1 from public.profiles where id=run_row.actor_user_id and role='super_admin') then raise exception 'Ejecución o actor inválido' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended('translation-initial-load-close-'||p_run_id::text,0));
  perform set_config('request.jwt.claim.sub',run_row.actor_user_id::text,true);perform set_config('request.jwt.claim.role','authenticated',true);

  select jsonb_agg(value->>'state_id') into batch_ids from jsonb_array_elements(p_items) value;
  perform set_config('app.translation_editor_publish_batch',coalesce(batch_ids,'[]'::jsonb)::text,true);
  for platform_row in
    select s.resource_id,s.target_language,
      (array_agg(value->'value') filter(where s.field_name='short_description'))[1] short_description,
      (array_agg(value->'value') filter(where s.field_name='description'))[1] description,
      (array_agg(value->'value') filter(where s.field_name='pros'))[1] pros,
      (array_agg(value->'value') filter(where s.field_name='cons'))[1] cons,
      (array_agg(value->'value') filter(where s.field_name='seo_title'))[1] seo_title,
      (array_agg(value->'value') filter(where s.field_name='seo_description'))[1] seo_description
    from jsonb_array_elements(p_items) value join public.translation_field_state s on s.id=(value->>'state_id')::uuid
    where s.resource_type='platform_translation' and s.publication_status='unpublished' and not s.is_protected
      and s.source_hash=value->>'source_hash' and s.source_revision=(value->>'source_revision')::bigint
    group by s.resource_id,s.target_language
  loop
    insert into public.platform_translations(platform_id,language,short_description,description,pros,cons,seo_title,seo_description)
    values(platform_row.resource_id::uuid,platform_row.target_language,platform_row.short_description#>>'{}',platform_row.description#>>'{}',coalesce(platform_row.pros,'[]'),coalesce(platform_row.cons,'[]'),platform_row.seo_title#>>'{}',platform_row.seo_description#>>'{}')
    on conflict(platform_id,language) do nothing;
  end loop;
  perform set_config('app.translation_editor_publish_batch','',true);

  for item in select value from jsonb_array_elements(p_items) order by value->>'state_id'
  loop begin
    select * into state_row from public.translation_field_state where id=(item->>'state_id')::uuid for update;
    if not found or state_row.publication_status='published' then skipped_count:=skipped_count+1;results:=results||jsonb_build_array(jsonb_build_object('state_id',item->>'state_id','outcome','skipped','reason','not_pending'));continue;end if;
    if state_row.is_protected or state_row.lock_version<>(item->>'expected_lock_version')::bigint or state_row.source_hash<>item->>'source_hash' or state_row.source_revision<>(item->>'source_revision')::bigint then
      skipped_count:=skipped_count+1;results:=results||jsonb_build_array(jsonb_build_object('state_id',state_row.id,'outcome','skipped','reason','snapshot_or_protection'));continue;
    end if;
    perform public.translation_editor_assert_source(state_row);perform public.translation_validate_editor_value(state_row.resource_type,state_row.field_name,item->'value');
    next_lock:=public.translation_save_draft(state_row.id,item->'value',state_row.lock_version);
    next_lock:=public.translation_submit_review(state_row.id,next_lock);
    next_lock:=public.translation_approve_draft(state_row.id,next_lock);
    next_lock:=public.translation_publish_draft(state_row.id,next_lock);
    insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value) values(run_row.actor_user_id,'translation.initial_load.close_pending','translations',jsonb_build_object('state_id',state_row.id,'lock_version',state_row.lock_version),jsonb_build_object('state_id',state_row.id,'lock_version',next_lock,'run_id',p_run_id,'publication_status','published'));
    published_count:=published_count+1;results:=results||jsonb_build_array(jsonb_build_object('state_id',state_row.id,'outcome','published'));
  exception when others then
    get stacked diagnostics error_state=returned_sqlstate;error_count:=error_count+1;
    results:=results||jsonb_build_array(jsonb_build_object('state_id',item->>'state_id','outcome','error','code',error_state));
  end;end loop;
  return jsonb_build_object('selected',jsonb_array_length(p_items),'published',published_count,'skipped',skipped_count,'errors',error_count,'items',results);
end $$;

revoke all on function public.translation_initial_load_close_pending(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.translation_initial_load_close_pending(uuid,jsonb) to service_role;
commit;
