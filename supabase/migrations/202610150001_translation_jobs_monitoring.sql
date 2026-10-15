begin;

-- 3E.8 Fase 3.1A: modelos de lectura de trabajos y heartbeat del worker local.
-- Esta migración no modifica translation_jobs ni el comportamiento de la cola.

create table if not exists public.translation_worker_instances (
  worker_id text primary key,
  provider text not null default 'libretranslate-local',
  status text not null,
  supported_languages text[] not null default '{}',
  started_at timestamptz not null,
  provider_checked_at timestamptz,
  last_seen_at timestamptz not null,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint translation_worker_instances_provider_check check (provider='libretranslate-local'),
  constraint translation_worker_instances_status_check check (status in ('ready','degraded','stopping')),
  constraint translation_worker_instances_worker_id_check check (worker_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
  constraint translation_worker_instances_languages_check check (
    array_position(supported_languages,null) is null
    and cardinality(supported_languages)<=100
  ),
  constraint translation_worker_instances_error_check check (
    last_error_code is null or last_error_code ~ '^[a-z0-9_.-]{1,100}$'
  )
);

alter table public.translation_worker_instances enable row level security;
revoke all on public.translation_worker_instances from public,anon,authenticated;
grant all on public.translation_worker_instances to service_role;

create index if not exists translation_worker_instances_last_seen_idx
  on public.translation_worker_instances(last_seen_at desc);
create index if not exists translation_jobs_created_admin_idx
  on public.translation_jobs(created_at desc);
create index if not exists translation_jobs_status_created_admin_idx
  on public.translation_jobs(status,created_at desc);
create index if not exists translation_jobs_resource_status_created_admin_idx
  on public.translation_jobs(resource_type,status,created_at desc);
create index if not exists translation_jobs_resource_identity_created_admin_idx
  on public.translation_jobs(resource_type,resource_id,created_at desc);
create index if not exists translation_jobs_language_status_created_admin_idx
  on public.translation_jobs(target_language,status,created_at desc);
create index if not exists translation_jobs_source_language_status_created_admin_idx
  on public.translation_jobs(source_language,status,created_at desc);
create index if not exists translation_jobs_error_created_admin_idx
  on public.translation_jobs(error_code,created_at desc) where status='failed';
create index if not exists translation_jobs_requested_provider_created_admin_idx
  on public.translation_jobs(requested_provider,created_at desc);
create index if not exists translation_jobs_provider_used_created_admin_idx
  on public.translation_jobs(provider_used,created_at desc);

create or replace function public.translation_worker_heartbeat(
  p_worker_id text,
  p_status text,
  p_supported_languages text[],
  p_started_at timestamptz,
  p_provider_checked_at timestamptz default null,
  p_last_error_code text default null
)
returns void
language plpgsql security definer
set search_path=pg_catalog,public
as $$
declare normalized_languages text[];
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_worker_id is null or p_worker_id!~'^[A-Za-z0-9._:-]{1,128}$'
     or p_status not in ('ready','degraded','stopping')
     or p_started_at is null or p_started_at>now()+interval '1 minute'
     or p_provider_checked_at>now()+interval '1 minute'
     or p_last_error_code is not null and p_last_error_code!~'^[a-z0-9_.-]{1,100}$'
     or p_supported_languages is null
     or cardinality(p_supported_languages)>100
     or exists(select 1 from unnest(p_supported_languages) code where code is null or lower(btrim(code))!~'^[a-z]{2,3}(-[a-z0-9]{2,8})?$') then
    raise exception 'Heartbeat inválido' using errcode='22023';
  end if;
  select coalesce(array_agg(code order by code),'{}'::text[]) into normalized_languages
  from (select distinct lower(btrim(item)) code from unnest(p_supported_languages) item) normalized;

  insert into public.translation_worker_instances(
    worker_id,status,supported_languages,started_at,provider_checked_at,last_seen_at,last_error_code
  ) values (
    p_worker_id,p_status,normalized_languages,p_started_at,p_provider_checked_at,now(),p_last_error_code
  )
  on conflict(worker_id) do update set
    status=excluded.status,supported_languages=excluded.supported_languages,
    started_at=excluded.started_at,provider_checked_at=excluded.provider_checked_at,
    last_seen_at=excluded.last_seen_at,last_error_code=excluded.last_error_code,updated_at=now();
end $$;

create or replace function public.translation_admin_jobs_inventory(
  p_allowed_resource_types text[],
  p_status text default null,
  p_resource_type text default null,
  p_resource_id text default null,
  p_source_language text default null,
  p_target_language text default null,
  p_provider text default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null,
  p_error_code text default null,
  p_sort text default 'created_desc',
  p_page integer default 1,
  p_page_size integer default 25
)
returns table(
  id uuid,resource_type text,resource_id text,field_name text,source_language text,target_language text,
  status text,requested_provider text,provider_used text,priority smallint,attempt_count integer,max_attempts integer,
  next_attempt_at timestamptz,lease_expires_at timestamptz,started_at timestamptz,completed_at timestamptz,
  error_code text,input_characters integer,output_characters integer,estimated_cost_usd numeric,
  created_at timestamptz,updated_at timestamptz,total_count bigint
)
language plpgsql security definer
set search_path=pg_catalog,public
as $$
begin
  perform public.translation_admin_jobs_validate_filters(
    p_allowed_resource_types,p_status,p_resource_type,p_resource_id,p_source_language,p_target_language,
    p_provider,p_created_from,p_created_to,p_error_code,p_sort,p_page,p_page_size
  );
  return query
  select j.id,j.resource_type,j.resource_id,j.field_name,j.source_language,j.target_language,
    j.status,j.requested_provider,j.provider_used,j.priority,j.attempt_count,j.max_attempts,
    j.next_attempt_at,j.lease_expires_at,j.started_at,j.completed_at,j.error_code,
    j.input_characters,j.output_characters,j.estimated_cost_usd,j.created_at,j.updated_at,count(*) over()
  from public.translation_jobs j
  where j.resource_type=any(p_allowed_resource_types)
    and (p_status is null or j.status=p_status)
    and (p_resource_type is null or j.resource_type=p_resource_type)
    and (p_resource_id is null or j.resource_id=p_resource_id)
    and (p_source_language is null or lower(j.source_language)=lower(p_source_language))
    and (p_target_language is null or lower(j.target_language)=lower(p_target_language))
    and (p_provider is null or lower(j.requested_provider)=lower(p_provider) or lower(j.provider_used)=lower(p_provider))
    and (p_created_from is null or j.created_at>=p_created_from)
    and (p_created_to is null or j.created_at<p_created_to)
    and (p_error_code is null or j.error_code=p_error_code)
  order by
    case when p_sort='created_asc' then j.created_at end asc,
    case when p_sort='updated_desc' then j.updated_at end desc,
    case when p_sort='created_desc' then j.created_at end desc,
    j.id desc
  offset (p_page-1)*p_page_size limit p_page_size;
end $$;

create or replace function public.translation_admin_jobs_summary(
  p_allowed_resource_types text[],
  p_status text default null,p_resource_type text default null,p_resource_id text default null,
  p_source_language text default null,p_target_language text default null,p_provider text default null,
  p_created_from timestamptz default null,p_created_to timestamptz default null,p_error_code text default null
)
returns table(total bigint,queued bigint,running bigint,retry_wait bigint,succeeded bigint,failed bigint,cancelled bigint,recoverable bigint)
language plpgsql security definer
set search_path=pg_catalog,public
as $$
begin
  perform public.translation_admin_jobs_validate_filters(
    p_allowed_resource_types,p_status,p_resource_type,p_resource_id,p_source_language,p_target_language,
    p_provider,p_created_from,p_created_to,p_error_code,'created_desc',1,25
  );
  return query select count(*),
    count(*) filter(where j.status='queued'),count(*) filter(where j.status='running'),
    count(*) filter(where j.status='retry_wait'),count(*) filter(where j.status='succeeded'),
    count(*) filter(where j.status='failed'),count(*) filter(where j.status='cancelled'),
    count(*) filter(where j.status='failed' and (j.error_code in ('local_provider_unavailable','lease_expired')
      or (j.error_code='translation_failed' and j.last_error='fetch failed' and j.requested_provider='libretranslate')))
  from public.translation_jobs j
  where j.resource_type=any(p_allowed_resource_types)
    and (p_status is null or j.status=p_status)
    and (p_resource_type is null or j.resource_type=p_resource_type)
    and (p_resource_id is null or j.resource_id=p_resource_id)
    and (p_source_language is null or lower(j.source_language)=lower(p_source_language))
    and (p_target_language is null or lower(j.target_language)=lower(p_target_language))
    and (p_provider is null or lower(j.requested_provider)=lower(p_provider) or lower(j.provider_used)=lower(p_provider))
    and (p_created_from is null or j.created_at>=p_created_from)
    and (p_created_to is null or j.created_at<p_created_to)
    and (p_error_code is null or j.error_code=p_error_code);
end $$;

create or replace function public.translation_admin_worker_status(p_stale_after_seconds integer default 120)
returns table(availability text,worker_status text,provider text,supported_languages text[],started_at timestamptz,
  provider_checked_at timestamptz,last_seen_at timestamptz,last_error_code text,active_workers bigint)
language plpgsql security definer
set search_path=pg_catalog,public
as $$
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_stale_after_seconds not between 30 and 600 then raise exception 'Umbral inválido' using errcode='22023'; end if;
  return query
  with latest as (select w.* from public.translation_worker_instances w order by w.last_seen_at desc limit 1)
  select case when l.worker_id is null then 'never_connected'
      when l.last_seen_at<now()-make_interval(secs=>p_stale_after_seconds) then 'offline'
      when l.status='ready' then 'available' else 'degraded' end,
    l.status,l.provider,l.supported_languages,l.started_at,l.provider_checked_at,l.last_seen_at,l.last_error_code,
    (select count(*) from public.translation_worker_instances active
      where active.status='ready' and active.last_seen_at>=now()-make_interval(secs=>p_stale_after_seconds))
  from (select 1) seed left join latest l on true;
end $$;

create or replace function public.translation_admin_jobs_validate_filters(
  p_allowed_resource_types text[],p_status text,p_resource_type text,p_resource_id text,
  p_source_language text,p_target_language text,p_provider text,p_created_from timestamptz,p_created_to timestamptz,
  p_error_code text,p_sort text,p_page integer,p_page_size integer
)
returns void
language plpgsql security definer
set search_path=pg_catalog,public
as $$
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if coalesce(cardinality(p_allowed_resource_types),0) not between 1 and 50
    or cardinality(p_allowed_resource_types)<>(select count(distinct item) from unnest(p_allowed_resource_types) item)
    or exists(select 1 from unnest(p_allowed_resource_types) item left join public.translation_resource_types r on r.resource_type=item and r.enabled where item is null or r.resource_type is null)
    or p_status is not null and p_status not in ('queued','running','retry_wait','succeeded','failed','cancelled')
    or p_resource_type is not null and not p_resource_type=any(p_allowed_resource_types)
    or length(coalesce(p_resource_id,''))>500
    or p_source_language is not null and p_source_language!~*'^[a-z]{2,3}(-[a-z0-9]{2,8})?$'
    or p_target_language is not null and p_target_language!~*'^[a-z]{2,3}(-[a-z0-9]{2,8})?$'
    or p_provider is not null and p_provider!~*'^[a-z0-9._-]{1,100}$'
    or p_error_code is not null and p_error_code!~'^[a-z0-9_.-]{1,100}$'
    or p_created_from is not null and p_created_to is not null and p_created_from>=p_created_to
    or p_sort not in ('created_desc','created_asc','updated_desc')
    or p_page not between 1 and 1000000 or p_page_size not between 1 and 50 then
    raise exception 'Filtros administrativos inválidos' using errcode='22023';
  end if;
end $$;

revoke all on function public.translation_worker_heartbeat(text,text,text[],timestamptz,timestamptz,text) from public,anon,authenticated;
revoke all on function public.translation_admin_jobs_validate_filters(text[],text,text,text,text,text,text,timestamptz,timestamptz,text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.translation_admin_jobs_inventory(text[],text,text,text,text,text,text,timestamptz,timestamptz,text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.translation_admin_jobs_summary(text[],text,text,text,text,text,text,timestamptz,timestamptz,text) from public,anon,authenticated;
revoke all on function public.translation_admin_worker_status(integer) from public,anon,authenticated;
grant execute on function public.translation_worker_heartbeat(text,text,text[],timestamptz,timestamptz,text) to service_role;
grant execute on function public.translation_admin_jobs_inventory(text[],text,text,text,text,text,text,timestamptz,timestamptz,text,text,integer,integer) to service_role;
grant execute on function public.translation_admin_jobs_summary(text[],text,text,text,text,text,text,timestamptz,timestamptz,text) to service_role;
grant execute on function public.translation_admin_worker_status(integer) to service_role;

commit;
