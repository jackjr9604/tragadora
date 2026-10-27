begin;

create index if not exists translation_field_state_exact_group_idx
  on public.translation_field_state(resource_type,field_name,target_language,source_hash);

create or replace function public.translation_admin_exact_group_inventory(
  p_allowed_resource_types text[],p_resource_type text default null,p_field_name text default null,
  p_target_language text default null,p_status text default 'pending',p_query text default null,
  p_page integer default 1,p_page_size integer default 25
)
returns table(
  resource_type text,field_name text,source_hash text,source_language text,target_language text,
  source_value jsonb,resource_count bigint,eligible_count bigint,draft_count bigint,
  review_count bigint,approved_count bigint,published_count bigint,protected_count bigint,
  stale_count bigint,error_count bigint,active_job_count bigint,failed_job_count bigint,
  representative_state_id uuid,representative_lock_version bigint,sensitivity text,total_count bigint
)
language plpgsql stable security definer
set search_path=pg_catalog,public
as $$
declare allowed text[]; clean_query text;
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_page<1 or p_page_size not between 1 and 100 then raise exception 'Paginación inválida' using errcode='22023'; end if;
  if p_status is not null and p_status not in ('pending','draft','in_review','approved','published','stale','error','all') then
    raise exception 'Estado inválido' using errcode='22023';
  end if;
  select coalesce(array_agg(distinct requested order by requested),'{}'::text[]) into allowed
  from unnest(coalesce(p_allowed_resource_types,'{}'::text[])) requested
  join public.translation_resource_types registered on registered.resource_type=requested and registered.enabled;
  if cardinality(allowed)>14 then raise exception 'Recursos inválidos' using errcode='22023'; end if;
  clean_query:=nullif(pg_catalog.left(btrim(coalesce(p_query,'')),100),'');
  return query
  with candidates as materialized(
    select s.* from public.translation_field_state s
    where s.resource_type=any(allowed)
      and (p_resource_type is null or s.resource_type=p_resource_type)
      and (p_field_name is null or s.field_name=p_field_name)
      and (p_target_language is null or s.target_language=p_target_language)
      and s.target_language<>public.translation_effective_source_language(s.resource_type,s.field_name)
      and case coalesce(p_status,'pending')
        when 'pending' then not (s.publication_status='published' and s.translated_source_hash=s.source_hash and s.translated_revision=s.source_revision and (s.status='reviewed' or (s.status='imported_unreviewed' and s.is_protected)))
        when 'draft' then s.workflow_status='draft'
        when 'in_review' then s.workflow_status='in_review'
        when 'approved' then s.workflow_status='approved'
        when 'published' then s.publication_status='published'
        when 'stale' then s.status='stale' or s.translated_source_hash is distinct from s.source_hash or s.translated_revision is distinct from s.source_revision
        when 'error' then s.status='error'
        else true end
  ), grouped as(
    select s.resource_type,s.field_name,s.source_hash,min(s.source_language) source_language,s.target_language,
      count(*) resource_count,
      count(*) filter(where not s.is_protected and s.publication_status<>'published' and s.workflow_status='none' and s.status in('missing','error','stale') and s.field_name!~*'(^|_)(slug|code|id|brand|product_name)($|_)') eligible_count,
      count(*) filter(where s.workflow_status='draft') draft_count,
      count(*) filter(where s.workflow_status='in_review') review_count,
      count(*) filter(where s.workflow_status='approved') approved_count,
      count(*) filter(where s.publication_status='published') published_count,
      count(*) filter(where s.is_protected) protected_count,
      count(*) filter(where s.status='stale' or s.translated_source_hash is distinct from s.source_hash or s.translated_revision is distinct from s.source_revision) stale_count,
      count(*) filter(where s.status='error') error_count,
      min(s.id::text)::uuid representative_state_id
    from candidates s group by s.resource_type,s.field_name,s.source_hash,s.target_language
  ), enriched as(
    select g.*,
      (select s.lock_version from public.translation_field_state s where s.id=g.representative_state_id) representative_lock_version,
      public.translation_read_value(g.resource_type,(select s.resource_id from public.translation_field_state s where s.id=g.representative_state_id),g.field_name,g.source_language) source_value,
      (select count(*) from public.translation_jobs j where j.resource_type=g.resource_type and j.field_name=g.field_name and j.target_language=g.target_language and j.source_hash=g.source_hash and j.status in('queued','running','retry_wait')) active_job_count,
      (select count(*) from public.translation_jobs j where j.resource_type=g.resource_type and j.field_name=g.field_name and j.target_language=g.target_language and j.source_hash=g.source_hash and j.status='failed') failed_job_count,
      case
        when g.resource_type in('account_plan_translation','challenge_phase_translation','challenge_variant_phase_translation','challenge_reward_translation') then 'commercial_sensitive'
        when g.field_name~*'(payout|profit|drawdown|restriction|rule|condition|target|fee|price)' then 'commercial_sensitive'
        when g.field_name~*'(^|_)(slug|code|id|brand|product_name)($|_)' then 'identifier_or_brand'
        else 'editorial_general' end sensitivity
    from grouped g
  ), filtered as(
    select e.* from enriched e
    where clean_query is null or e.field_name ilike '%'||clean_query||'%' or e.source_value::text ilike '%'||clean_query||'%'
  ), counted as(select f.*,count(*) over() total_count from filtered f)
  select c.resource_type,c.field_name,c.source_hash,c.source_language,c.target_language,c.source_value,
    c.resource_count,c.eligible_count,c.draft_count,c.review_count,c.approved_count,c.published_count,
    c.protected_count,c.stale_count,c.error_count,c.active_job_count,c.failed_job_count,
    c.representative_state_id,c.representative_lock_version,c.sensitivity,c.total_count
  from counted c order by c.resource_count desc,c.resource_type,c.field_name,c.target_language,c.source_hash
  offset (p_page-1)*p_page_size limit p_page_size;
end $$;

create or replace function public.translation_admin_exact_group_members(
  p_allowed_resource_types text[],p_resource_type text,p_field_name text,p_source_hash text,
  p_target_language text,p_page integer default 1,p_page_size integer default 50
)
returns table(
  state_id uuid,resource_id text,status text,workflow_status text,publication_status text,
  is_protected boolean,source_revision bigint,lock_version bigint,draft_value jsonb,
  translation_method text,job_status text,proposal_state_id uuid,
  proposal_lock_version bigint,proposal_draft_value jsonb,total_count bigint
)
language plpgsql stable security definer
set search_path=pg_catalog,public
as $$
declare allowed text[];
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_page<1 or p_page_size not between 1 and 100 or p_source_hash!~'^[0-9a-f]{64}$' then raise exception 'Parámetros inválidos' using errcode='22023'; end if;
  select coalesce(array_agg(distinct requested),'{}'::text[]) into allowed
  from unnest(coalesce(p_allowed_resource_types,'{}'::text[])) requested
  join public.translation_resource_types registered on registered.resource_type=requested and registered.enabled;
  if not p_resource_type=any(allowed) then return; end if;
  return query
  select s.id,s.resource_id,s.status,s.workflow_status,s.publication_status,s.is_protected,
    s.source_revision,s.lock_version,s.draft_value,s.translation_method,
    (select j.status from public.translation_jobs j where j.resource_type=s.resource_type and j.resource_id=s.resource_id and j.field_name=s.field_name and j.target_language=s.target_language and j.source_hash=s.source_hash order by j.created_at desc limit 1),
    proposal.id,proposal.lock_version,proposal.draft_value,
    count(*) over()
  from public.translation_field_state s
  left join lateral(
    select candidate.id,candidate.lock_version,candidate.draft_value
    from public.translation_field_state candidate
    where candidate.resource_type=s.resource_type and candidate.field_name=s.field_name
      and candidate.source_hash=s.source_hash and candidate.target_language=s.target_language
      and candidate.workflow_status='draft' and candidate.translation_method='libretranslate'
      and candidate.draft_value is not null and candidate.draft_source_hash=candidate.source_hash
      and candidate.draft_source_revision=candidate.source_revision
      and exists(
        select 1 from public.translation_jobs successful_job
        where successful_job.resource_type=candidate.resource_type and successful_job.resource_id=candidate.resource_id
          and successful_job.field_name=candidate.field_name and successful_job.target_language=candidate.target_language
          and successful_job.source_hash=candidate.source_hash and successful_job.status='succeeded'
      )
    order by candidate.draft_updated_at desc nulls last,candidate.id
    limit 1
  ) proposal on true
  where s.resource_type=p_resource_type and s.field_name=p_field_name and s.source_hash=p_source_hash
    and s.target_language=p_target_language
    and s.target_language<>public.translation_effective_source_language(s.resource_type,s.field_name)
  order by s.resource_id,s.id offset (p_page-1)*p_page_size limit p_page_size;
end $$;

create or replace function public.translation_admin_apply_exact_group_proposal(
  p_proposal_state_id uuid,p_expected_proposal_lock_version bigint,p_selection jsonb
)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public
as $$
declare proposal public.translation_field_state%rowtype; selected record; current public.translation_field_state%rowtype;
  items jsonb:='[]'::jsonb; applied integer:=0;skipped integer:=0;conflicts integer:=0;actor uuid;
begin
  actor:=auth.uid();
  if actor is null or auth.role()<>'authenticated' then raise exception 'Forbidden' using errcode='42501'; end if;
  if jsonb_typeof(p_selection)<>'array' or jsonb_array_length(p_selection) not between 1 and 100 then raise exception 'Selección inválida' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_selection) item where jsonb_typeof(item)<>'object' or not(item?'state_id') or not(item?'expected_lock_version') or coalesce(item->>'state_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or coalesce(item->>'expected_lock_version','')!~'^[1-9][0-9]*$') then raise exception 'Selección inválida' using errcode='22023'; end if;
  if (select count(*) from jsonb_array_elements(p_selection))<>(select count(distinct item->>'state_id') from jsonb_array_elements(p_selection) item) then raise exception 'La selección contiene duplicados' using errcode='22023'; end if;
  select * into proposal from public.translation_field_state where id=p_proposal_state_id for update;
  if not found then raise exception 'Propuesta no encontrada' using errcode='P0002'; end if;
  perform public.translation_assert_admin_permission(proposal.resource_type);
  perform public.translation_editor_assert_version(proposal,p_expected_proposal_lock_version);
  perform public.translation_editor_assert_source(proposal);
  if proposal.workflow_status<>'draft' or proposal.draft_value is null or proposal.draft_source_hash<>proposal.source_hash or proposal.draft_source_revision<>proposal.source_revision or proposal.translation_method<>'libretranslate' then
    raise exception 'La propuesta automática no está lista o quedó obsoleta' using errcode='55000';
  end if;
  if proposal.is_protected or proposal.publication_status='published' then raise exception 'La propuesta está protegida o publicada' using errcode='42501'; end if;
  if proposal.field_name~*'(^|_)(slug|code|id|brand|product_name)($|_)' then raise exception 'El campo es un identificador o marca y no admite reutilización automática' using errcode='22023'; end if;
  for selected in
    select (value->>'state_id')::uuid state_id,(value->>'expected_lock_version')::bigint expected_lock_version
    from jsonb_array_elements(p_selection)
    where jsonb_typeof(value)='object' and value?'state_id' and value?'expected_lock_version'
    order by (value->>'state_id')::uuid
  loop
    select * into current from public.translation_field_state where id=selected.state_id for update;
    if not found then skipped:=skipped+1;items:=items||jsonb_build_array(jsonb_build_object('state_id',selected.state_id,'outcome','skipped','reason','not_found'));continue;end if;
    perform public.translation_assert_admin_permission(current.resource_type);
    if current.lock_version<>selected.expected_lock_version then conflicts:=conflicts+1;items:=items||jsonb_build_array(jsonb_build_object('state_id',current.id,'outcome','conflict','reason','lock_version'));continue;end if;
    if current.resource_type<>proposal.resource_type or current.field_name<>proposal.field_name or current.source_hash<>proposal.source_hash or current.target_language<>proposal.target_language then
      conflicts:=conflicts+1;items:=items||jsonb_build_array(jsonb_build_object('state_id',current.id,'outcome','conflict','reason','group_changed'));continue;
    end if;
    if current.id=proposal.id then skipped:=skipped+1;items:=items||jsonb_build_array(jsonb_build_object('state_id',current.id,'outcome','skipped','reason','proposal'));continue;end if;
    if current.is_protected or current.publication_status='published' or current.workflow_status<>'none' or current.status not in('missing','error','stale') then
      skipped:=skipped+1;items:=items||jsonb_build_array(jsonb_build_object('state_id',current.id,'outcome','skipped','reason','editorial_protection'));continue;
    end if;
    begin perform public.translation_editor_assert_source(current); exception when serialization_failure then conflicts:=conflicts+1;items:=items||jsonb_build_array(jsonb_build_object('state_id',current.id,'outcome','conflict','reason','source_changed'));continue;end;
    perform public.translation_validate_editor_value(current.resource_type,current.field_name,proposal.draft_value);
    update public.translation_field_state set draft_value=proposal.draft_value,draft_source_hash=source_hash,draft_source_revision=source_revision,
      workflow_status='draft',draft_updated_at=now(),draft_updated_by=actor,submitted_at=null,submitted_by=null,approved_at=null,approved_by=null,
      status='machine_translated',translation_method='libretranslate',provider=proposal.provider,last_error_code=null,last_error=null,
      lock_version=lock_version+1,updated_at=now() where id=current.id;
    insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value)
    values(actor,'translation.exact_group.apply','translations',jsonb_build_object('state_id',current.id,'lock_version',current.lock_version),jsonb_build_object('state_id',current.id,'proposal_state_id',proposal.id,'source_hash',proposal.source_hash,'target_language',proposal.target_language));
    applied:=applied+1;items:=items||jsonb_build_array(jsonb_build_object('state_id',current.id,'outcome','draft','reason',null));
  end loop;
  return jsonb_build_object('selected',jsonb_array_length(p_selection),'applied',applied,'skipped',skipped,'conflicts',conflicts,'items',items);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'Selección inválida' using errcode='22023';
end $$;

revoke all on function public.translation_admin_exact_group_inventory(text[],text,text,text,text,text,integer,integer) from public,anon,authenticated,service_role;
revoke all on function public.translation_admin_exact_group_members(text[],text,text,text,text,integer,integer) from public,anon,authenticated,service_role;
revoke all on function public.translation_admin_apply_exact_group_proposal(uuid,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.translation_admin_exact_group_inventory(text[],text,text,text,text,text,integer,integer) to service_role;
grant execute on function public.translation_admin_exact_group_members(text[],text,text,text,text,integer,integer) to service_role;
grant execute on function public.translation_admin_apply_exact_group_proposal(uuid,bigint,jsonb) to authenticated;

commit;
