begin;

-- 3E.8 Fase 3.2B: métricas operativas administrativas, estrictamente de lectura.
-- El índice parcial cubre periodos por fecha real de finalización. Los índices de
-- 3.1A siguen cubriendo la antigüedad de queued/retry_wait por status/created_at.
create index if not exists translation_jobs_resource_completed_metrics_idx
  on public.translation_jobs(resource_type,completed_at desc)
  where completed_at is not null and status in ('succeeded','failed','cancelled');

create or replace function public.translation_admin_jobs_metrics(
  p_allowed_resource_types text[],p_period text default '24h',p_resource_type text default null,
  p_resource_id text default null,p_source_language text default null,p_target_language text default null,
  p_provider text default null
)
returns table(
  period text,period_started_at timestamptz,period_ended_at timestamptz,
  oldest_pending_created_at timestamptz,oldest_pending_age_seconds bigint,
  terminal_jobs bigint,succeeded_jobs bigint,failed_jobs bigint,success_rate numeric,failure_rate numeric,
  completed_jobs bigint,duration_samples bigint,average_duration_seconds numeric,
  p50_duration_seconds numeric,p95_duration_seconds numeric,processed_characters bigint,error_distribution jsonb
)
language plpgsql security definer
set search_path=pg_catalog,public
as $$
declare
  v_period_ended_at timestamptz:=clock_timestamp();
  v_period_started_at timestamptz;
begin
  if p_period not in ('24h','7d','30d') then
    raise exception 'Periodo de métricas inválido' using errcode='22023';
  end if;
  perform public.translation_admin_jobs_validate_filters(
    p_allowed_resource_types,null,p_resource_type,p_resource_id,p_source_language,p_target_language,
    p_provider,null,null,null,'created_desc',1,25
  );
  v_period_started_at:=case p_period when '24h' then v_period_ended_at-interval '24 hours'
    when '7d' then v_period_ended_at-interval '7 days' else v_period_ended_at-interval '30 days' end;

  return query
  with period_jobs as materialized(
    select j.* from public.translation_jobs j
    where j.resource_type=any(p_allowed_resource_types)
      and (p_resource_type is null or j.resource_type=p_resource_type)
      and (p_resource_id is null or j.resource_id=p_resource_id)
      and (p_source_language is null or lower(j.source_language)=lower(p_source_language))
      and (p_target_language is null or lower(j.target_language)=lower(p_target_language))
      and (p_provider is null or lower(j.requested_provider)=lower(p_provider) or lower(j.provider_used)=lower(p_provider))
      and j.status in ('succeeded','failed','cancelled')
      and j.completed_at>=v_period_started_at and j.completed_at<v_period_ended_at
  ), terminal as(
    select count(*) filter(where p.status in ('succeeded','failed')) terminal_count,
      count(*) filter(where p.status='succeeded') succeeded_count,
      count(*) filter(where p.status='failed') failed_count from period_jobs p
  ), durations as(
    select extract(epoch from (p.completed_at-p.started_at))::numeric duration_seconds
    from period_jobs p where p.status='succeeded' and p.started_at is not null and p.completed_at>=p.started_at
  ), duration_metrics as(
    select count(*) sample_count,avg(d.duration_seconds) average_seconds,
      (case when count(*)>=2 then percentile_cont(0.5) within group(order by d.duration_seconds) end)::numeric p50_seconds,
      (case when count(*)>=5 then percentile_cont(0.95) within group(order by d.duration_seconds) end)::numeric p95_seconds
    from durations d
  ), character_metrics as(
    select case when count(*) filter(where p.input_characters is not null or p.output_characters is not null)=0 then null
      else sum(coalesce(p.input_characters,0)::bigint+coalesce(p.output_characters,0)::bigint)::bigint end characters
    from period_jobs p where p.status='succeeded'
  ), categorized_errors as(
    select case
      when p.error_code='local_provider_unavailable'
        or (p.error_code='translation_failed' and p.last_error='fetch failed' and p.requested_provider='libretranslate') then 'recoverable_connectivity'
      when p.error_code='lease_expired' then 'lease_expired'
      when p.error_code in ('source_changed','source_state_mismatch','source_language_disabled','field_disabled','language_became_source') then 'source_unavailable'
      when p.error_code in ('protected','manual_override','manual_draft') then 'editorial_conflict'
      when p.error_code='translation_failed' and lower(coalesce(p.last_error,'')) like any(array[
        '%markdown%','%enlace%','%link%','%código%','%codigo%','%variable%',
        '%marcador%','%estructura%','%contenido protegido%'
      ]) then 'protected_content_validation'
      else 'unknown' end category
    from period_jobs p where p.status='failed'
  ), error_counts as(
    select e.category,count(*) amount from categorized_errors e group by e.category
  ), error_metrics as(
    select jsonb_object_agg(e.category,e.amount order by e.category) distribution from error_counts e
  ), pending as(
    select min(j.created_at) oldest from public.translation_jobs j
    where j.resource_type=any(p_allowed_resource_types)
      and (p_resource_type is null or j.resource_type=p_resource_type)
      and (p_resource_id is null or j.resource_id=p_resource_id)
      and (p_source_language is null or lower(j.source_language)=lower(p_source_language))
      and (p_target_language is null or lower(j.target_language)=lower(p_target_language))
      and (p_provider is null or lower(j.requested_provider)=lower(p_provider) or lower(j.provider_used)=lower(p_provider))
      and j.status in ('queued','retry_wait')
  )
  select p_period,v_period_started_at,v_period_ended_at,pending.oldest,
    case when pending.oldest is null then null else greatest(0,extract(epoch from (v_period_ended_at-pending.oldest))::bigint) end,
    terminal.terminal_count,terminal.succeeded_count,terminal.failed_count,
    terminal.succeeded_count::numeric/nullif(terminal.terminal_count,0),
    terminal.failed_count::numeric/nullif(terminal.terminal_count,0),
    terminal.succeeded_count,duration_metrics.sample_count,duration_metrics.average_seconds,
    duration_metrics.p50_seconds,duration_metrics.p95_seconds,character_metrics.characters,error_metrics.distribution
  from terminal cross join duration_metrics cross join character_metrics cross join error_metrics cross join pending;
end
$$;

revoke all on function public.translation_admin_jobs_metrics(text[],text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.translation_admin_jobs_metrics(text[],text,text,text,text,text,text) to service_role;

commit;
