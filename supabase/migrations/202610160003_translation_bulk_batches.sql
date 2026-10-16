begin;

-- 3E.8.4A: persistencia y previsualizacion de lotes. Esta migracion no crea
-- translation_jobs ni modifica estados editoriales o traducciones.

do $$
begin
  if to_regclass('public.translation_field_state') is null
     or to_regclass('public.translation_jobs') is null
     or to_regprocedure('public.translation_assert_admin_permission(text)') is null
     or to_regprocedure('public.translation_read_value(text,text,text,text)') is null then
    raise exception 'Faltan dependencias de la infraestructura de traducciones';
  end if;
end
$$;

create table if not exists public.translation_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  idempotency_key uuid not null,
  created_by uuid not null,
  status text not null default 'prepared',
  requested_languages text[] not null,
  selection_count integer not null,
  eligible_count integer not null,
  excluded_count integer not null,
  estimated_characters bigint not null default 0,
  daily_request_limit integer not null,
  daily_character_limit integer not null,
  daily_requests_used integer not null default 0,
  daily_characters_used bigint not null default 0,
  queued_count integer not null default 0,
  reused_count integer not null default 0,
  succeeded_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  lock_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint translation_batches_idempotency_unique unique(created_by,idempotency_key),
  constraint translation_batches_status_check check(status in
    ('prepared','partially_queued','queued','processing','completed','partial','failed','cancelled')),
  constraint translation_batches_languages_check check(
    cardinality(requested_languages) between 1 and 20
    and array_position(requested_languages,null) is null),
  constraint translation_batches_selection_check check(
    selection_count between 1 and 200
    and eligible_count >= 0 and excluded_count >= 0
    and selection_count=eligible_count+excluded_count),
  constraint translation_batches_counters_check check(
    estimated_characters >= 0 and daily_request_limit between 1 and 100
    and daily_character_limit between 100 and 1000000
    and daily_requests_used >= 0 and daily_characters_used >= 0
    and queued_count >= 0 and reused_count >= 0 and succeeded_count >= 0
    and failed_count >= 0 and skipped_count >= 0
    and queued_count+reused_count+succeeded_count+failed_count+skipped_count <= eligible_count),
  constraint translation_batches_lock_check check(lock_version > 0),
  constraint translation_batches_completion_check check(
    (status in ('completed','partial','failed','cancelled') and completed_at is not null)
    or (status not in ('completed','partial','failed','cancelled') and completed_at is null))
);

create table if not exists public.translation_batch_items (
  id uuid primary key default extensions.gen_random_uuid(),
  batch_id uuid not null references public.translation_batches(id) on delete cascade,
  state_id uuid not null references public.translation_field_state(id) on delete restrict,
  job_id uuid references public.translation_jobs(id) on delete set null,
  resource_type text not null,
  resource_id text not null,
  field_name text not null,
  source_language text not null,
  target_language text not null,
  request_mode text not null,
  status text not null,
  exclusion_reason text,
  source_hash text not null,
  source_revision bigint not null,
  state_lock_version bigint not null,
  input_characters integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint translation_batch_items_identity_unique unique(batch_id,state_id),
  constraint translation_batch_items_resource_fk foreign key(resource_type,field_name)
    references public.translation_resource_fields(resource_type,field_name) on update cascade on delete restrict,
  constraint translation_batch_items_languages_check check(source_language<>target_language),
  constraint translation_batch_items_mode_check check(request_mode in ('generate','regenerate')),
  constraint translation_batch_items_status_check check(status in
    ('pending','reusable','excluded','queued','running','succeeded','failed','skipped','cancelled')),
  constraint translation_batch_items_exclusion_check check(
    (status='excluded' and exclusion_reason is not null)
    or (status<>'excluded' and exclusion_reason is null)),
  constraint translation_batch_items_snapshot_check check(
    source_hash ~ '^[0-9a-f]{64}$' and source_revision>0 and state_lock_version>0
    and input_characters>=0)
);

create index if not exists translation_batches_actor_created_idx
  on public.translation_batches(created_by,created_at desc);
create index if not exists translation_batches_status_updated_idx
  on public.translation_batches(status,updated_at desc);
create index if not exists translation_batch_items_batch_status_idx
  on public.translation_batch_items(batch_id,status,created_at);
create index if not exists translation_batch_items_state_idx
  on public.translation_batch_items(state_id,created_at desc);
create index if not exists translation_batch_items_job_idx
  on public.translation_batch_items(job_id) where job_id is not null;

alter table public.translation_batches enable row level security;
alter table public.translation_batch_items enable row level security;
revoke all on public.translation_batches,public.translation_batch_items from public,anon,authenticated;
grant all on public.translation_batches,public.translation_batch_items to service_role;

create or replace function public.translation_batch_input_characters(p_value jsonb)
returns integer language sql immutable strict
set search_path=pg_catalog,public as $$
  select case jsonb_typeof(p_value)
    when 'string' then char_length(p_value #>> '{}')
    when 'array' then coalesce((select sum(char_length(value)) from jsonb_array_elements_text(p_value)),0)
    else 0
  end::integer
$$;

create or replace function public.translation_batch_validate_selection(p_selection jsonb)
returns table(state_id uuid,expected_lock_version bigint)
language plpgsql stable security definer
set search_path=pg_catalog,public as $$
declare item jsonb; parsed_id uuid; parsed_lock bigint;
begin
  if jsonb_typeof(p_selection)<>'array' or jsonb_array_length(p_selection) not between 1 and 200 then
    raise exception 'La seleccion debe contener entre 1 y 200 elementos' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_selection) loop
    if jsonb_typeof(item)<>'object'
       or not (item ? 'state_id') or not (item ? 'expected_lock_version') then
      raise exception 'Elemento de seleccion invalido' using errcode='22023';
    end if;
    begin
      parsed_id := (item->>'state_id')::uuid;
      parsed_lock := (item->>'expected_lock_version')::bigint;
    exception when others then
      raise exception 'Elemento de seleccion invalido' using errcode='22023';
    end;
    if parsed_lock<1 then raise exception 'Version de seleccion invalida' using errcode='22023'; end if;
    state_id:=parsed_id; expected_lock_version:=parsed_lock; return next;
  end loop;
  if (select count(*) from jsonb_array_elements(p_selection)) <>
     (select count(distinct value->>'state_id') from jsonb_array_elements(p_selection)) then
    raise exception 'La seleccion contiene estados duplicados' using errcode='22023';
  end if;
end
$$;

create or replace function public.translation_batch_evaluate_state(
  p_state_id uuid,p_expected_lock_version bigint
)
returns table(
  state_id uuid,resource_type text,resource_id text,field_name text,
  source_language text,target_language text,request_mode text,eligible boolean,
  reason text,input_characters integer,source_hash text,source_revision bigint,
  state_lock_version bigint,existing_job_id uuid
)
language plpgsql stable security definer
set search_path=pg_catalog,public as $$
declare s public.translation_field_state%rowtype; source_value jsonb; lang public.languages%rowtype;
begin
  select * into s from public.translation_field_state where id=p_state_id;
  if not found then raise exception 'Estado de traduccion no encontrado' using errcode='P0002'; end if;
  perform public.translation_assert_admin_permission(s.resource_type);
  select * into lang from public.languages where code=s.target_language;
  source_value:=public.translation_read_value(s.resource_type,s.resource_id,s.field_name,s.source_language);
  existing_job_id:=null;
  select j.id into existing_job_id from public.translation_jobs j
  where j.resource_type=s.resource_type and j.resource_id=s.resource_id
    and j.field_name=s.field_name and j.target_language=s.target_language
    and j.source_hash=s.source_hash and j.source_revision=s.source_revision
    and j.status in ('queued','running','retry_wait')
  order by j.created_at desc limit 1;

  state_id:=s.id; resource_type:=s.resource_type; resource_id:=s.resource_id;
  field_name:=s.field_name; source_language:=s.source_language; target_language:=s.target_language;
  request_mode:=case when s.status='stale' then 'regenerate' else 'generate' end;
  source_hash:=s.source_hash; source_revision:=s.source_revision; state_lock_version:=s.lock_version;
  input_characters:=case when public.translation_value_present(source_value)
    then public.translation_batch_input_characters(source_value) else 0 end;

  eligible:=false;
  reason:=case
    when p_expected_lock_version is null or s.lock_version<>p_expected_lock_version then 'stale_selection'
    when not public.translation_value_present(source_value) then 'source_unavailable'
    when public.translation_hash(source_value)<>s.source_hash then 'source_changed'
    when s.target_language not in ('en','pt') then 'unsupported_target_language'
    when lang.code is null or not lang.is_active or not lang.auto_translate
      or lang.libretranslate_status<>'supported' then 'language_not_ready'
    when s.is_protected then 'protected'
    when s.publication_status='published' then 'published'
    when s.workflow_status<>'none' then 'editorial_workflow_active'
    when existing_job_id is not null then 'active_job_reusable'
    when s.status not in ('missing','error','stale') then 'state_not_eligible'
    when input_characters<1 or input_characters>100000 then 'invalid_source_size'
    else null end;
  eligible:=reason is null or reason='active_job_reusable';
  return next;
end
$$;

create or replace function public.translation_admin_bulk_preview(
  p_selection jsonb,p_page integer default 1,p_page_size integer default 50,
  p_daily_request_limit integer default 20,p_daily_character_limit integer default 100000
)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public as $$
declare actor uuid; payload jsonb;
begin
  actor:=auth.uid();
  if actor is null or auth.role()<>'authenticated' then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_page<1 or p_page_size not between 1 and 100
     or p_daily_request_limit not between 1 and 100
     or p_daily_character_limit not between 100 and 1000000 then
    raise exception 'Parametros de previsualizacion invalidos' using errcode='22023';
  end if;
  with selected as (
    select row_number() over() ordinal,v.*
    from public.translation_batch_validate_selection(p_selection) v
  ), evaluated as (
    select selected.ordinal,evaluation.* from selected
    cross join lateral public.translation_batch_evaluate_state(
      selected.state_id,selected.expected_lock_version) evaluation
  ), totals as (
    select count(*)::integer total_count,count(*) filter(where eligible)::integer eligible_count,
      coalesce(sum(input_characters) filter(where eligible and existing_job_id is null),0)::bigint character_count
    from evaluated
  ), usage as (
    select count(*)::integer used_requests,coalesce(sum(input_characters),0)::bigint used_characters
    from public.translation_jobs where metadata->>'engine'='3e3' and created_at>=date_trunc('day',now())
  ), page_rows as (
    select * from evaluated order by ordinal offset (p_page-1)*p_page_size limit p_page_size
  )
  select jsonb_build_object(
    'selection_count',totals.total_count,'eligible_count',totals.eligible_count,
    'excluded_count',totals.total_count-totals.eligible_count,
    'estimated_characters',totals.character_count,
    'daily_request_limit',p_daily_request_limit,'daily_character_limit',p_daily_character_limit,
    'daily_requests_used',usage.used_requests,'daily_characters_used',usage.used_characters,
    'daily_requests_remaining',greatest(p_daily_request_limit-usage.used_requests,0),
    'daily_characters_remaining',greatest(p_daily_character_limit-usage.used_characters,0),
    'page',p_page,'page_size',p_page_size,
    'pages',ceil(totals.total_count::numeric/p_page_size)::integer,
    'items',(select coalesce(jsonb_agg(to_jsonb(page_rows) order by ordinal),'[]'::jsonb) from page_rows))
  into payload from totals cross join usage;
  return payload;
end
$$;

create or replace function public.translation_admin_create_batch(
  p_idempotency_key uuid,p_selection jsonb,
  p_daily_request_limit integer default 20,p_daily_character_limit integer default 100000
)
returns uuid language plpgsql security definer
set search_path=pg_catalog,public as $$
declare actor uuid; existing_id uuid; result_id uuid; audit_row public.translation_batches%rowtype;
begin
  actor:=auth.uid();
  if actor is null or auth.role()<>'authenticated' then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_idempotency_key is null or p_daily_request_limit not between 1 and 100
     or p_daily_character_limit not between 100 and 1000000 then
    raise exception 'Parametros de lote invalidos' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_idempotency_key::text,0));
  select id into existing_id from public.translation_batches
    where created_by=actor and idempotency_key=p_idempotency_key;
  if existing_id is not null then return existing_id; end if;
  with selected as (
    select row_number() over() ordinal,v.*
    from public.translation_batch_validate_selection(p_selection) v
  ), evaluated as materialized (
    select selected.ordinal,evaluation.* from selected
    cross join lateral public.translation_batch_evaluate_state(
      selected.state_id,selected.expected_lock_version) evaluation
  ), totals as (
    select count(*)::integer total_count,count(*) filter(where eligible)::integer eligible_total,
      count(*) filter(where not eligible)::integer excluded_total,
      coalesce(sum(input_characters) filter(where eligible and existing_job_id is null),0)::bigint character_total,
      array_agg(distinct target_language order by target_language) requested,
      count(*) filter(where eligible and existing_job_id is not null)::integer reused_total
    from evaluated
  ), usage as (
    select count(*)::integer used_requests,coalesce(sum(input_characters),0)::bigint used_characters
    from public.translation_jobs where metadata->>'engine'='3e3' and created_at>=date_trunc('day',now())
  ), inserted_batch as (
    insert into public.translation_batches(idempotency_key,created_by,status,requested_languages,
      selection_count,eligible_count,excluded_count,estimated_characters,daily_request_limit,
      daily_character_limit,daily_requests_used,daily_characters_used,reused_count)
    select p_idempotency_key,actor,'prepared',totals.requested,totals.total_count,
      totals.eligible_total,totals.excluded_total,totals.character_total,p_daily_request_limit,
      p_daily_character_limit,usage.used_requests,usage.used_characters,totals.reused_total
    from totals cross join usage returning id
  ), inserted_items as (
    insert into public.translation_batch_items(batch_id,state_id,job_id,resource_type,resource_id,
      field_name,source_language,target_language,request_mode,status,exclusion_reason,source_hash,
      source_revision,state_lock_version,input_characters)
    select inserted_batch.id,evaluated.state_id,
      case when evaluated.eligible then evaluated.existing_job_id end,evaluated.resource_type,
      evaluated.resource_id,evaluated.field_name,evaluated.source_language,evaluated.target_language,
      evaluated.request_mode,case when not evaluated.eligible then 'excluded'
        when evaluated.existing_job_id is not null then 'reusable' else 'pending' end,
      case when not evaluated.eligible then evaluated.reason end,evaluated.source_hash,
      evaluated.source_revision,evaluated.state_lock_version,evaluated.input_characters
    from evaluated cross join inserted_batch order by evaluated.ordinal returning batch_id
  )
  select inserted_batch.id into result_id from inserted_batch
  where exists(select 1 from inserted_items);
  select * into audit_row from public.translation_batches where id=result_id;
  insert into public.admin_audit_log(actor_user_id,action,module,new_value)
  values(actor,'translation_batch.create','translations',jsonb_build_object(
    'batch_id',result_id,'selection_count',audit_row.selection_count,
    'eligible_count',audit_row.eligible_count,'excluded_count',audit_row.excluded_count,
    'estimated_characters',audit_row.estimated_characters));
  return result_id;
end
$$;

revoke all on function public.translation_batch_input_characters(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.translation_batch_validate_selection(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.translation_batch_evaluate_state(uuid,bigint) from public,anon,authenticated,service_role;
revoke all on function public.translation_admin_bulk_preview(jsonb,integer,integer,integer,integer) from public,anon,authenticated,service_role;
revoke all on function public.translation_admin_create_batch(uuid,jsonb,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.translation_admin_bulk_preview(jsonb,integer,integer,integer,integer) to authenticated;
grant execute on function public.translation_admin_create_batch(uuid,jsonb,integer,integer) to authenticated;

commit;
