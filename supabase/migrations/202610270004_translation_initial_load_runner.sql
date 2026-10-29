begin;

-- Infraestructura temporal y eliminable para la carga inicial exacta ES/EN/PT.
-- No altera cuotas normales, no aprueba y no publica contenido.
create table public.translation_initial_load_runs (
  id uuid primary key,
  actor_user_id uuid not null references public.profiles(id),
  status text not null default 'running' check(status in('running','paused','completed','failed')),
  max_groups integer not null check(max_groups between 1 and 4000),
  max_characters bigint not null check(max_characters between 1 and 10000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.translation_initial_load_groups (
  run_id uuid not null references public.translation_initial_load_runs(id) on delete restrict,
  resource_type text not null,
  field_name text not null,
  source_hash text not null check(source_hash~'^[0-9a-f]{64}$'),
  source_language text not null,
  target_language text not null,
  representative_state_id uuid not null references public.translation_field_state(id) on delete restrict,
  job_id uuid references public.translation_jobs(id) on delete restrict,
  status text not null check(status in('queued','processing','proposal_ready','qa_passed','qa_review','qa_failed','applying','applied','failed','skipped')),
  sensitivity text not null check(sensitivity in('editorial_general','commercial_sensitive')),
  input_characters integer not null check(input_characters>0),
  eligible_count integer not null check(eligible_count>0),
  applied_count integer not null default 0 check(applied_count>=0),
  conflict_count integer not null default 0 check(conflict_count>=0),
  qa_codes text[] not null default '{}',
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(run_id,resource_type,field_name,source_hash,target_language)
);
create index translation_initial_load_groups_status_idx on public.translation_initial_load_groups(run_id,status,updated_at);
alter table public.translation_initial_load_runs enable row level security;
alter table public.translation_initial_load_groups enable row level security;
revoke all on public.translation_initial_load_runs,public.translation_initial_load_groups from public,anon,authenticated,service_role;

create or replace function public.translation_initial_load_start(p_run_id uuid,p_actor_user_id uuid,p_max_groups integer default 3500,p_max_characters bigint default 10000000)
returns public.translation_initial_load_runs language plpgsql security definer set search_path=pg_catalog,public as $$
declare result public.translation_initial_load_runs%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501';end if;
  if p_run_id is null or p_actor_user_id is null or p_max_groups not between 1 and 4000 or p_max_characters not between 1 and 10000000 then raise exception 'Parámetros inválidos' using errcode='22023';end if;
  if not exists(select 1 from public.profiles where id=p_actor_user_id and role='super_admin') then raise exception 'La carga inicial requiere un superadministrador' using errcode='42501';end if;
  insert into public.translation_initial_load_runs(id,actor_user_id,max_groups,max_characters) values(p_run_id,p_actor_user_id,p_max_groups,p_max_characters)
  on conflict(id) do nothing;
  select * into result from public.translation_initial_load_runs where id=p_run_id;
  if result.actor_user_id<>p_actor_user_id or result.max_groups<>p_max_groups or result.max_characters<>p_max_characters then raise exception 'El identificador pertenece a otra ejecución' using errcode='22023';end if;
  return result;
end $$;

create or replace function public.translation_initial_load_enqueue(p_run_id uuid,p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare run_row public.translation_initial_load_runs%rowtype; candidate record; state_row public.translation_field_state%rowtype;
  source_value jsonb; characters integer; logical_identity text; generation_value integer; created_job uuid; existing_job uuid;
  queued integer:=0;reused integer:=0;skipped integer:=0;used_groups bigint;used_characters bigint;
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501';end if;
  if p_limit not between 1 and 100 then raise exception 'Límite inválido' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended('translation-initial-load-'||p_run_id::text,0));
  select * into run_row from public.translation_initial_load_runs where id=p_run_id for update;
  if not found or run_row.status<>'running' then raise exception 'Ejecución no disponible' using errcode='55000';end if;
  select count(*),coalesce(sum(input_characters),0) into used_groups,used_characters from public.translation_initial_load_groups where run_id=p_run_id;
  for candidate in
    with eligible as materialized(
      select s.*,row_number() over(partition by s.resource_type,s.field_name,s.source_hash,s.target_language order by s.id) ordinal,
        count(*) over(partition by s.resource_type,s.field_name,s.source_hash,s.target_language) eligible_count
      from public.translation_field_state s join public.languages l on l.code=s.target_language
      where l.is_active and l.publication_status='published'
        and s.target_language<>public.translation_effective_source_language(s.resource_type,s.field_name)
        and not s.is_protected and s.publication_status<>'published' and s.workflow_status='none'
        and s.status in('missing','error','stale') and s.field_name!~*'(^|_)(slug|code|id|brand|product_name)($|_)'
    )
    select e.* from eligible e where e.ordinal=1 and not exists(
      select 1 from public.translation_initial_load_groups g where g.run_id=p_run_id and g.resource_type=e.resource_type and g.field_name=e.field_name and g.source_hash=e.source_hash and g.target_language=e.target_language)
    order by e.resource_type,e.field_name,e.target_language,e.source_hash limit p_limit
  loop
    exit when used_groups>=run_row.max_groups;
    select * into state_row from public.translation_field_state where id=candidate.id for update;
    source_value:=public.translation_read_value(state_row.resource_type,state_row.resource_id,state_row.field_name,state_row.source_language);
    if not public.translation_value_present(source_value) or public.translation_hash(source_value)<>state_row.source_hash then skipped:=skipped+1;continue;end if;
    characters:=case when jsonb_typeof(source_value)='string' then length(source_value#>>'{}') when jsonb_typeof(source_value)='array' then length(array_to_string(array(select jsonb_array_elements_text(source_value)),' ')) else 0 end;
    if characters<1 or used_characters+characters>run_row.max_characters then exit;end if;
    select j.id into existing_job from public.translation_jobs j where j.resource_type=state_row.resource_type and j.resource_id=state_row.resource_id and j.field_name=state_row.field_name and j.target_language=state_row.target_language and j.source_hash=state_row.source_hash and j.source_revision=state_row.source_revision and (j.status in('queued','running','retry_wait') or (j.status='succeeded' and state_row.workflow_status='draft' and state_row.draft_value is not null and state_row.draft_source_hash=state_row.source_hash and state_row.draft_source_revision=state_row.source_revision)) order by case when j.status='succeeded' then 0 else 1 end,j.created_at desc limit 1 for update;
    if existing_job is null then
      logical_identity:=encode(extensions.digest(convert_to(concat_ws('|',state_row.resource_type,state_row.resource_id,state_row.field_name,state_row.source_language,state_row.target_language),'UTF8'),'sha256'),'hex');
      perform pg_advisory_xact_lock(hashtextextended(logical_identity,0));
      select coalesce(max(generation),0)+1 into generation_value from public.translation_jobs where logical_key=logical_identity;
      insert into public.translation_jobs(logical_key,generation,idempotency_key,resource_type,resource_id,field_name,source_language,target_language,source_hash,source_revision,status,requested_provider,priority,max_attempts,input_characters,created_by,metadata)
      values(logical_identity,generation_value,encode(extensions.digest(convert_to(concat_ws('|',logical_identity,generation_value::text,state_row.source_hash,state_row.source_revision::text),'UTF8'),'sha256'),'hex'),state_row.resource_type,state_row.resource_id,state_row.field_name,state_row.source_language,state_row.target_language,state_row.source_hash,state_row.source_revision,'queued','libretranslate',60,3,characters,run_row.actor_user_id,jsonb_build_object('engine','3e3','budget_scope','initial_exact_group_load','initial_load_run_id',p_run_id,'state_id',state_row.id,'expected_lock_version',state_row.lock_version)) returning id into created_job;
      existing_job:=created_job;queued:=queued+1;
    else reused:=reused+1;end if;
    insert into public.translation_initial_load_groups(run_id,resource_type,field_name,source_hash,source_language,target_language,representative_state_id,job_id,status,sensitivity,input_characters,eligible_count)
    values(p_run_id,state_row.resource_type,state_row.field_name,state_row.source_hash,state_row.source_language,state_row.target_language,state_row.id,existing_job,
      case when exists(select 1 from public.translation_jobs where id=existing_job and status='succeeded') and state_row.workflow_status='draft' and state_row.draft_source_hash=state_row.source_hash and state_row.draft_source_revision=state_row.source_revision then 'proposal_ready' else 'queued' end,
      case when state_row.resource_type in('account_plan_translation','challenge_phase_translation','challenge_variant_phase_translation','challenge_reward_translation') or state_row.field_name~*'(payout|profit|drawdown|restriction|rule|condition|target|fee|price|leverage|loss|refund)' then 'commercial_sensitive' else 'editorial_general' end,characters,candidate.eligible_count);
    used_groups:=used_groups+1;used_characters:=used_characters+characters;
  end loop;
  update public.translation_initial_load_runs set updated_at=now() where id=p_run_id;
  return jsonb_build_object('queued',queued,'reused',reused,'skipped',skipped,'groups',used_groups,'characters',used_characters);
end $$;

create or replace function public.translation_initial_load_refresh(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501';end if;
  update public.translation_initial_load_groups g set status=case
    when j.status='succeeded' and s.workflow_status='draft' and s.draft_source_hash=s.source_hash and s.draft_source_revision=s.source_revision then 'proposal_ready'
    when j.status='failed' then 'failed' when j.status='cancelled' then 'skipped' when j.status='running' then 'processing' else g.status end,
    error_code=case when j.status in('failed','cancelled') then coalesce(j.error_code,'job_failed') else g.error_code end,updated_at=now()
  from public.translation_jobs j,public.translation_field_state s
  where g.run_id=p_run_id and g.job_id=j.id and s.id=g.representative_state_id and g.status in('queued','processing');
  -- Una vez terminales dejan de consumir el contador diario normal engine=3e3.
  -- El worker ya no necesita reclamarlos y la trazabilidad conserva budget_scope/run_id.
  update public.translation_jobs set metadata=metadata||jsonb_build_object('engine','initial_exact_group_load'),updated_at=now()
  where metadata->>'initial_load_run_id'=p_run_id::text and metadata->>'budget_scope'='initial_exact_group_load'
    and status in('succeeded','failed','cancelled') and metadata->>'engine'='3e3';
  return (select jsonb_object_agg(status,total) from(select status,count(*) total from public.translation_initial_load_groups where run_id=p_run_id group by status)x);
end $$;

create or replace function public.translation_initial_load_qa_candidates(p_run_id uuid,p_limit integer default 50)
returns table(resource_type text,field_name text,source_hash text,target_language text,source_value jsonb,draft_value jsonb,sensitivity text)
language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501';end if;
  if p_limit not between 1 and 100 then raise exception 'Límite inválido' using errcode='22023';end if;
  return query select g.resource_type,g.field_name,g.source_hash,g.target_language,
    public.translation_read_value(s.resource_type,s.resource_id,s.field_name,s.source_language),s.draft_value,g.sensitivity
  from public.translation_initial_load_groups g join public.translation_field_state s on s.id=g.representative_state_id
  where g.run_id=p_run_id and g.status='proposal_ready' order by g.updated_at limit p_limit;
end $$;

create or replace function public.translation_initial_load_record_qa(p_run_id uuid,p_resource_type text,p_field_name text,p_source_hash text,p_target_language text,p_status text,p_codes text[] default '{}')
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501';end if;
  if p_status not in('passed','requires_review','failed') or coalesce(array_length(p_codes,1),0)>20 or exists(select 1 from unnest(coalesce(p_codes,'{}')) c where c!~'^[a-z0-9_]{1,80}$') then raise exception 'QA inválido' using errcode='22023';end if;
  update public.translation_initial_load_groups set status=case p_status when 'passed' then 'qa_passed' when 'requires_review' then 'qa_review' else 'qa_failed' end,qa_codes=coalesce(p_codes,'{}'),updated_at=now()
  where run_id=p_run_id and resource_type=p_resource_type and field_name=p_field_name and source_hash=p_source_hash and target_language=p_target_language and status='proposal_ready';
  if not found then raise exception 'Grupo no disponible' using errcode='55000';end if;
end $$;

create or replace function public.translation_initial_load_fanout(p_run_id uuid,p_group_limit integer default 10,p_member_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare run_row public.translation_initial_load_runs%rowtype;g record;proposal public.translation_field_state%rowtype;target public.translation_field_state%rowtype;applied integer:=0;conflicts integer:=0;groups_done integer:=0;remaining integer;
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501';end if;
  if p_group_limit not between 1 and 25 or p_member_limit not between 1 and 100 then raise exception 'Límites inválidos' using errcode='22023';end if;
  select * into run_row from public.translation_initial_load_runs where id=p_run_id;
  if not found or run_row.status<>'running' then raise exception 'Ejecución no disponible' using errcode='55000';end if;
  for g in select * from public.translation_initial_load_groups where run_id=p_run_id and status in('qa_passed','qa_review','applying') order by updated_at for update skip locked limit p_group_limit loop
    update public.translation_initial_load_groups set status='applying',updated_at=now() where run_id=g.run_id and resource_type=g.resource_type and field_name=g.field_name and source_hash=g.source_hash and target_language=g.target_language;
    select * into proposal from public.translation_field_state where id=g.representative_state_id for update;
    if proposal.workflow_status<>'draft' or proposal.draft_value is null or proposal.draft_source_hash<>proposal.source_hash or proposal.draft_source_revision<>proposal.source_revision or proposal.translation_method<>'libretranslate' then
      update public.translation_initial_load_groups set status='failed',error_code='proposal_changed',updated_at=now() where run_id=g.run_id and resource_type=g.resource_type and field_name=g.field_name and source_hash=g.source_hash and target_language=g.target_language;continue;
    end if;
    for target in select * from public.translation_field_state s where s.id<>proposal.id and s.resource_type=g.resource_type and s.field_name=g.field_name and s.source_hash=g.source_hash and s.target_language=g.target_language and not s.is_protected and s.publication_status<>'published' and s.workflow_status='none' and s.status in('missing','error','stale') order by s.id for update skip locked limit p_member_limit loop
      begin
        perform public.translation_editor_assert_source(target);perform public.translation_validate_editor_value(target.resource_type,target.field_name,proposal.draft_value);
        update public.translation_field_state set draft_value=proposal.draft_value,draft_source_hash=source_hash,draft_source_revision=source_revision,workflow_status='draft',draft_updated_at=now(),draft_updated_by=run_row.actor_user_id,submitted_at=null,submitted_by=null,approved_at=null,approved_by=null,status='machine_translated',translation_method='libretranslate',provider=proposal.provider,last_error_code=null,last_error=null,lock_version=lock_version+1,updated_at=now() where id=target.id;
        insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value) values(run_row.actor_user_id,'translation.initial_load.apply','translations',jsonb_build_object('state_id',target.id,'lock_version',target.lock_version),jsonb_build_object('state_id',target.id,'proposal_state_id',proposal.id,'run_id',p_run_id,'qa_status',g.status));
        applied:=applied+1;
      exception when serialization_failure or check_violation or invalid_parameter_value then conflicts:=conflicts+1;end;
    end loop;
    select count(*) into remaining from public.translation_field_state s where s.id<>proposal.id and s.resource_type=g.resource_type and s.field_name=g.field_name and s.source_hash=g.source_hash and s.target_language=g.target_language and not s.is_protected and s.publication_status<>'published' and s.workflow_status='none' and s.status in('missing','error','stale');
    update public.translation_initial_load_groups set applied_count=applied_count+applied,conflict_count=conflict_count+conflicts,status=case when remaining=0 then 'applied' else 'applying' end,updated_at=now() where run_id=g.run_id and resource_type=g.resource_type and field_name=g.field_name and source_hash=g.source_hash and target_language=g.target_language;
    if remaining=0 then groups_done:=groups_done+1;end if;applied:=0;conflicts:=0;
  end loop;
  return jsonb_build_object('groups_completed',groups_done,'remaining',(select count(*) from public.translation_initial_load_groups where run_id=p_run_id and status in('qa_passed','qa_review','applying')));
end $$;

create or replace function public.translation_initial_load_status(p_run_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501';end if;
  select jsonb_build_object('run_id',r.id,'status',r.status,'groups',coalesce((select jsonb_object_agg(x.status,x.total) from(select g.status,count(*) total from public.translation_initial_load_groups g where g.run_id=r.id group by g.status)x),'{}'::jsonb),'applied_fields',coalesce((select sum(g.applied_count) from public.translation_initial_load_groups g where g.run_id=r.id),0),'conflicts',coalesce((select sum(g.conflict_count) from public.translation_initial_load_groups g where g.run_id=r.id),0)) into result from public.translation_initial_load_runs r where r.id=p_run_id;
  if result is null then raise exception 'Ejecución no encontrada' using errcode='P0002';end if;
  return result;
end $$;

create or replace function public.translation_initial_load_finish(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare active bigint;result jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501';end if;
  select count(*) into active from public.translation_initial_load_groups where run_id=p_run_id and status in('queued','processing','proposal_ready','qa_passed','qa_review','applying');
  if active>0 then raise exception 'La ejecución todavía tiene grupos activos' using errcode='55000';end if;
  update public.translation_initial_load_runs set status=case when exists(select 1 from public.translation_initial_load_groups where run_id=p_run_id and status in('failed','qa_failed')) then 'failed' else 'completed' end,completed_at=now(),updated_at=now() where id=p_run_id returning jsonb_build_object('run_id',id,'status',status,'completed_at',completed_at) into result;
  if result is null then raise exception 'Ejecución no encontrada' using errcode='P0002';end if;
  return result;
end $$;

revoke all on function public.translation_initial_load_start(uuid,uuid,integer,bigint) from public,anon,authenticated,service_role;
revoke all on function public.translation_initial_load_enqueue(uuid,integer) from public,anon,authenticated,service_role;
revoke all on function public.translation_initial_load_refresh(uuid) from public,anon,authenticated,service_role;
revoke all on function public.translation_initial_load_qa_candidates(uuid,integer) from public,anon,authenticated,service_role;
revoke all on function public.translation_initial_load_record_qa(uuid,text,text,text,text,text,text[]) from public,anon,authenticated,service_role;
revoke all on function public.translation_initial_load_fanout(uuid,integer,integer) from public,anon,authenticated,service_role;
revoke all on function public.translation_initial_load_status(uuid) from public,anon,authenticated,service_role;
revoke all on function public.translation_initial_load_finish(uuid) from public,anon,authenticated,service_role;
grant execute on function public.translation_initial_load_start(uuid,uuid,integer,bigint),public.translation_initial_load_enqueue(uuid,integer),public.translation_initial_load_refresh(uuid),public.translation_initial_load_qa_candidates(uuid,integer),public.translation_initial_load_record_qa(uuid,text,text,text,text,text,text[]),public.translation_initial_load_fanout(uuid,integer,integer),public.translation_initial_load_status(uuid),public.translation_initial_load_finish(uuid) to service_role;

commit;
