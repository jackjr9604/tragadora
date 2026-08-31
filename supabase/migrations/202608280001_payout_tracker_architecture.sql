-- Arquitectura de métricas y cobertura de payouts por plataforma.
-- No altera payouts, payout_sources ni los cursores de collectors existentes.

create table if not exists public.platform_payout_metrics (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.platforms(id) on delete cascade,
  metric_type text not null check (metric_type in ('total_paid', 'payout_count', 'payout_statistics', 'median_time')),
  amount numeric,
  payout_count bigint,
  largest_payout numeric,
  average_payout numeric,
  median_payout numeric,
  median_time_minutes numeric,
  currency text not null default 'USD',
  source_type text not null check (source_type in ('tragadora_blockchain', 'tragadora_api', 'official_api', 'third_party_api', 'official_firm', 'third_party_public', 'manual')),
  source_name text,
  source_url text,
  verification_level text not null check (verification_level in ('verified', 'tracked_external', 'firm_reported', 'unverified')),
  period_start timestamptz,
  period_end timestamptz,
  collected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  raw_data jsonb not null default '{}'::jsonb,
  is_current boolean not null default true,
  check (amount is null or amount >= 0),
  check (payout_count is null or payout_count >= 0),
  check (largest_payout is null or largest_payout >= 0),
  check (average_payout is null or average_payout >= 0),
  check (median_payout is null or median_payout >= 0),
  check (median_time_minutes is null or median_time_minutes >= 0)
);

create table if not exists public.platform_research_status (
  platform_id uuid primary key references public.platforms(id) on delete cascade,
  official_site_checked boolean not null default false,
  general_info_checked boolean not null default false,
  markets_checked boolean not null default false,
  challenges_checked boolean not null default false,
  plans_checked boolean not null default false,
  trading_rules_checked boolean not null default false,
  payout_policy_checked boolean not null default false,
  uses_rise boolean,
  uses_plane boolean,
  uses_deel boolean,
  uses_crypto boolean,
  has_official_api boolean,
  has_trackable_blockchain boolean,
  has_third_party_tracker boolean,
  payout_tracking_status text not null default 'unknown'
    check (payout_tracking_status in ('unknown', 'researching', 'trackable', 'partially_trackable', 'not_trackable')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  notes text,
  last_reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists platform_payout_metrics_platform_idx on public.platform_payout_metrics(platform_id);
create index if not exists platform_payout_metrics_verification_idx on public.platform_payout_metrics(verification_level);
create index if not exists platform_payout_metrics_source_type_idx on public.platform_payout_metrics(source_type);
create index if not exists platform_payout_metrics_current_idx on public.platform_payout_metrics(platform_id, is_current);
create unique index if not exists platform_payout_metrics_one_current_idx
  on public.platform_payout_metrics (
    platform_id,
    metric_type,
    source_type,
    lower(coalesce(source_name, ''))
  )
  where is_current;

create or replace function public.archive_previous_current_payout_metric()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_current then
    update public.platform_payout_metrics
    set
      is_current = false,
      updated_at = now()
    where platform_id = new.platform_id
      and metric_type = new.metric_type
      and source_type = new.source_type
      and lower(coalesce(source_name, '')) = lower(coalesce(new.source_name, ''))
      and is_current
      and id <> new.id;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.archive_previous_current_payout_metric() from public;

drop trigger if exists archive_previous_current_payout_metric
  on public.platform_payout_metrics;
create trigger archive_previous_current_payout_metric
  before insert or update on public.platform_payout_metrics
  for each row
  execute function public.archive_previous_current_payout_metric();

create index if not exists payouts_platform_date_idx on public.payouts(platform_id, payout_date desc);
create index if not exists payouts_source_external_idx on public.payouts(payout_source_id, external_id);
create index if not exists payout_sources_platform_idx on public.payout_sources(platform_id);

alter table public.platform_payout_metrics enable row level security;
alter table public.platform_research_status enable row level security;

drop policy if exists "platform_payout_metrics_public_read" on public.platform_payout_metrics;
create policy "platform_payout_metrics_public_read"
  on public.platform_payout_metrics for select to anon, authenticated using (true);

drop policy if exists "platform_payout_metrics_admin_insert" on public.platform_payout_metrics;
create policy "platform_payout_metrics_admin_insert"
  on public.platform_payout_metrics for insert to authenticated
  with check (public.is_admin());

drop policy if exists "platform_payout_metrics_admin_update" on public.platform_payout_metrics;
create policy "platform_payout_metrics_admin_update"
  on public.platform_payout_metrics for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "platform_payout_metrics_admin_delete" on public.platform_payout_metrics;
create policy "platform_payout_metrics_admin_delete"
  on public.platform_payout_metrics for delete to authenticated
  using (public.is_admin());

drop policy if exists "platform_research_status_admin_read" on public.platform_research_status;
create policy "platform_research_status_admin_read"
  on public.platform_research_status for select to authenticated
  using (public.is_admin());

drop policy if exists "platform_research_status_admin_insert" on public.platform_research_status;
create policy "platform_research_status_admin_insert"
  on public.platform_research_status for insert to authenticated
  with check (public.is_admin());

drop policy if exists "platform_research_status_admin_update" on public.platform_research_status;
create policy "platform_research_status_admin_update"
  on public.platform_research_status for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "platform_research_status_admin_delete" on public.platform_research_status;
create policy "platform_research_status_admin_delete"
  on public.platform_research_status for delete to authenticated
  using (public.is_admin());

create or replace view public.payout_source_summary
with (security_invoker = true)
as
select
  ps.id as payout_source_id,
  ps.platform_id,
  count(p.id)::bigint as payout_count,
  sum(p.amount) as payout_amount,
  min(p.payout_date) as first_payout_at,
  max(p.payout_date) as last_payout_at
from public.payout_sources ps
left join public.payouts p on p.payout_source_id = ps.id
group by ps.id, ps.platform_id;

create or replace view public.platform_payout_daily
with (security_invoker = true)
as
select
  p.platform_id,
  date_trunc('day', p.payout_date) as payout_day,
  count(*)::bigint as payout_count,
  sum(p.amount) as payout_amount
from public.payouts p
join public.payout_sources ps on ps.id = p.payout_source_id
where
  p.verification_status = 'verified'
  or (
    p.verification_status = 'automatic'
    and (
      (
        ps.source_type = 'blockchain'
        and ps.config ->> 'verification' = 'onchain_attributed'
      )
      or (
        ps.source_type = 'official_api'
        and ps.config ->> 'verification' in (
          'verified',
          'official_api_verified',
          'direct_official'
        )
      )
    )
  )
group by p.platform_id, date_trunc('day', p.payout_date);

create or replace view public.platform_payout_summary
with (security_invoker = true)
as
with verified as (
  select
    p.platform_id,
    sum(p.amount) as verified_amount,
    count(*)::bigint as verified_payout_count,
    avg(p.amount) as verified_average_payout,
    max(p.amount) as verified_largest_payout,
    min(p.payout_date) as verified_first_payout_at,
    max(p.payout_date) as verified_last_payout_at
  from public.payouts p
  join public.payout_sources ps on ps.id = p.payout_source_id
  where
    p.verification_status = 'verified'
    or (
      p.verification_status = 'automatic'
      and (
        (
          ps.source_type = 'blockchain'
          and ps.config ->> 'verification' = 'onchain_attributed'
        )
        or (
          ps.source_type = 'official_api'
          and ps.config ->> 'verification' in (
            'verified',
            'official_api_verified',
            'direct_official'
          )
        )
      )
    )
  group by p.platform_id
), metric_rollup as (
  select
    platform_id,
    max(amount) filter (where verification_level = 'tracked_external' and metric_type = 'total_paid') as external_tracked_amount,
    max(payout_count) filter (where verification_level = 'tracked_external') as external_tracked_count,
    max(amount) filter (where verification_level = 'firm_reported' and metric_type = 'total_paid') as firm_reported_amount,
    max(payout_count) filter (where verification_level = 'firm_reported') as firm_reported_count
  from public.platform_payout_metrics
  where is_current
  group by platform_id
), ranked_total_metrics as (
  select
    m.*,
    row_number() over (
      partition by m.platform_id
      order by
        case
          when m.source_type in ('tragadora_blockchain', 'tragadora_api')
            and m.verification_level = 'verified' then 600
          when m.source_type = 'official_api'
            and m.verification_level <> 'unverified' then 500
          when m.source_type = 'official_firm'
            and m.verification_level = 'firm_reported' then 400
          when m.source_type = 'third_party_api'
            and m.verification_level = 'tracked_external' then 300
          when m.source_type = 'third_party_public'
            and m.verification_level = 'tracked_external' then 200
          when m.source_type in ('official_api', 'official_firm', 'third_party_api') then 150
          when m.source_type = 'third_party_public' then 120
          when m.source_type = 'manual' then 100
          else 0
        end desc,
        coalesce(m.period_end, m.collected_at, m.updated_at) desc,
        m.updated_at desc,
        m.amount desc
    ) as trust_rank
  from public.platform_payout_metrics m
  where m.is_current
    and m.metric_type = 'total_paid'
    and m.amount is not null
)
select
  p.id as platform_id,
  p.name as platform_name,
  p.slug,
  p.logo_url,
  coalesce(v.verified_amount, 0) as verified_amount,
  coalesce(v.verified_payout_count, 0) as verified_payout_count,
  v.verified_average_payout,
  v.verified_largest_payout,
  v.verified_first_payout_at,
  v.verified_last_payout_at,
  mr.external_tracked_amount,
  mr.external_tracked_count,
  mr.firm_reported_amount,
  mr.firm_reported_count,
  coalesce(selected.amount, v.verified_amount) as display_total_amount,
  case
    when selected.amount is not null then selected.source_type
    when coalesce(v.verified_payout_count, 0) > 0 then 'tragadora_blockchain'
  end as display_total_source_type,
  case
    when selected.amount is not null then selected.source_name
    when coalesce(v.verified_payout_count, 0) > 0 then 'Tragadora'
  end as display_total_source_name,
  case
    when selected.amount is not null then selected.verification_level
    when coalesce(v.verified_payout_count, 0) > 0 then 'verified'
  end as display_total_verification_level,
  case
    when selected.amount is not null then selected.updated_at
    when coalesce(v.verified_payout_count, 0) > 0 then v.verified_last_payout_at
  end as display_total_updated_at,
  v.verified_last_payout_at as last_verified_payout_at
from public.platforms p
left join verified v on v.platform_id = p.id
left join metric_rollup mr on mr.platform_id = p.id
left join ranked_total_metrics selected
  on selected.platform_id = p.id
  and selected.trust_rank = 1
where p.type = 'prop_firm';

grant select on public.payout_source_summary to anon, authenticated;
grant select on public.platform_payout_daily to anon, authenticated;
grant select on public.platform_payout_summary to anon, authenticated;

comment on table public.platform_payout_metrics is 'Agregados externos u oficiales; nunca representan payouts individuales.';
comment on table public.platform_research_status is 'Cobertura de investigación editorial y técnica por Prop Firm.';
comment on function public.archive_previous_current_payout_metric() is 'Archiva la métrica vigente equivalente antes de activar una nueva, conservando el historial.';
comment on view public.platform_payout_summary is 'Resumen por firma que mantiene separado lo verificado de los agregados potencialmente solapados.';
