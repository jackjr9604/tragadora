-- Periodos comparables y mappings explícitos para Prop Firm Match.
-- No altera payouts, payout_sources ni collectors blockchain existentes.

alter table public.platform_payout_metrics
  add column if not exists period_key text;

update public.platform_payout_metrics
set period_key = 'all'
where period_key is null;

alter table public.platform_payout_metrics
  alter column period_key set default 'all',
  alter column period_key set not null;

alter table public.platform_payout_metrics
  drop constraint if exists platform_payout_metrics_period_key_check;
alter table public.platform_payout_metrics
  add constraint platform_payout_metrics_period_key_check
  check (period_key in ('24h', '7d', '30d', '365d', 'all'));

alter table public.platform_payout_metrics
  drop constraint if exists platform_payout_metrics_metric_type_check;
alter table public.platform_payout_metrics
  add constraint platform_payout_metrics_metric_type_check
  check (metric_type in ('total_paid', 'payout_count', 'payout_statistics', 'median_time', 'payout_summary'));

alter table public.platform_payout_metrics
  drop constraint if exists platform_payout_metrics_verification_level_check;
alter table public.platform_payout_metrics
  add constraint platform_payout_metrics_verification_level_check
  check (verification_level in ('verified', 'tracked_external', 'blockchain_external', 'firm_reported', 'unverified'));

drop index if exists public.platform_payout_metrics_one_current_idx;
create unique index platform_payout_metrics_one_current_idx
  on public.platform_payout_metrics (
    platform_id,
    metric_type,
    source_type,
    lower(coalesce(source_name, '')),
    period_key
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
      and period_key = new.period_key
      and is_current
      and id <> new.id;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.external_platform_mappings (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.platforms(id) on delete cascade,
  provider text not null,
  external_name text not null,
  external_slug text not null,
  external_market text not null,
  external_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform_id, provider),
  check (provider in ('propfirmmatch', 'mondotraders')),
  check (external_market in ('forex', 'futures', 'crypto'))
);

-- CREATE TABLE IF NOT EXISTS no actualiza los CHECK constraints de una tabla
-- existente. Reemplazarlo explícitamente antes de insertar mappings de Mondo.
alter table public.external_platform_mappings
  drop constraint if exists external_platform_mappings_provider_check;
alter table public.external_platform_mappings
  add constraint external_platform_mappings_provider_check
  check (provider in ('propfirmmatch', 'mondotraders'));

create index if not exists external_platform_mappings_provider_active_idx
  on public.external_platform_mappings(provider, active);

alter table public.external_platform_mappings enable row level security;

drop policy if exists "external_platform_mappings_admin_read" on public.external_platform_mappings;
create policy "external_platform_mappings_admin_read"
  on public.external_platform_mappings for select to authenticated
  using (public.is_admin());

drop policy if exists "external_platform_mappings_admin_insert" on public.external_platform_mappings;
create policy "external_platform_mappings_admin_insert"
  on public.external_platform_mappings for insert to authenticated
  with check (public.is_admin());

drop policy if exists "external_platform_mappings_admin_update" on public.external_platform_mappings;
create policy "external_platform_mappings_admin_update"
  on public.external_platform_mappings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "external_platform_mappings_admin_delete" on public.external_platform_mappings;
create policy "external_platform_mappings_admin_delete"
  on public.external_platform_mappings for delete to authenticated
  using (public.is_admin());

insert into public.external_platform_mappings (
  platform_id,
  provider,
  external_name,
  external_slug,
  external_market,
  external_url,
  active
)
select
  p.id,
  'propfirmmatch',
  seed.external_name,
  seed.external_slug,
  seed.external_market,
  seed.external_url,
  true
from (
  values
    ('lucid-trading', 'Lucid Trading', 'lucid-trading', 'futures', 'https://propfirmmatch.com/futures/prop-firms/lucid-trading/payouts'),
    ('tradeify', 'Tradeify', 'tradeify', 'futures', 'https://propfirmmatch.com/futures/prop-firms/tradeify/payouts'),
    ('fundingpips', 'FundingPips', 'funding-pips', 'forex', 'https://propfirmmatch.com/prop-firms/funding-pips/payouts')
) as seed(tragadora_slug, external_name, external_slug, external_market, external_url)
join public.platforms p on p.slug = seed.tragadora_slug
on conflict (platform_id, provider) do nothing;

insert into public.external_platform_mappings (
  platform_id,
  provider,
  external_name,
  external_slug,
  external_market,
  external_url,
  active
)
select
  p.id,
  'mondotraders',
  seed.external_name,
  seed.external_slug,
  seed.external_market,
  seed.external_url,
  true
from (
  values
    ('lucid-trading', 'Lucid Trading', 'Lucid Trading', 'futures', 'https://mondotraders.com/en/firma/Lucid%20Trading'),
    ('tradeify', 'Tradeify', 'Tradeify', 'futures', 'https://mondotraders.com/en/firma/Tradeify'),
    ('fundingpips', 'FundingPips', 'FundingPips', 'forex', 'https://mondotraders.com/en/firma/FundingPips')
) as seed(tragadora_slug, external_name, external_slug, external_market, external_url)
join public.platforms p on p.slug = seed.tragadora_slug
on conflict (platform_id, provider) do nothing;

create or replace view public.platform_payout_period_summary
with (security_invoker = true)
as
with periods(period_key, period_interval) as (
  values
    ('24h'::text, interval '24 hours'),
    ('7d'::text, interval '7 days'),
    ('30d'::text, interval '30 days'),
    ('365d'::text, interval '365 days'),
    ('all'::text, null::interval)
), verified as (
  select
    p.platform_id,
    periods.period_key,
    sum(p.amount) as verified_amount,
    count(*)::bigint as verified_payout_count,
    avg(p.amount) as verified_average_payout,
    max(p.amount) as verified_largest_payout,
    min(p.payout_date) as verified_first_payout_at,
    max(p.payout_date) as verified_last_payout_at
  from periods
  join public.payouts p
    on periods.period_interval is null
    or p.payout_date >= now() - periods.period_interval
  join public.payout_sources ps on ps.id = p.payout_source_id
  where
    p.verification_status = 'verified'
    or (
      p.verification_status = 'automatic'
      and (
        (ps.source_type = 'blockchain' and ps.config ->> 'verification' = 'onchain_attributed')
        or (
          ps.source_type = 'official_api'
          and ps.config ->> 'verification' in ('verified', 'official_api_verified', 'direct_official')
        )
      )
    )
  group by p.platform_id, periods.period_key
), pfm as (
  select distinct on (m.platform_id, m.period_key)
    m.platform_id,
    m.period_key,
    m.amount,
    m.payout_count,
    m.largest_payout,
    m.average_payout,
    m.median_time_minutes,
    m.currency,
    m.source_type,
    m.source_name,
    m.source_url,
    m.verification_level,
    m.collected_at,
    m.updated_at
  from public.platform_payout_metrics m
  where m.is_current
    and m.metric_type = 'payout_summary'
    and lower(m.source_name) = 'prop firm match'
    and m.verification_level = 'tracked_external'
  order by m.platform_id, m.period_key, m.collected_at desc, m.updated_at desc
)
select
  p.id as platform_id,
  p.name as platform_name,
  p.slug,
  p.logo_url,
  periods.period_key,
  pfm.amount as display_total_amount,
  pfm.payout_count as known_payout_count,
  pfm.largest_payout as known_largest_payout,
  pfm.average_payout as known_average_payout,
  pfm.median_time_minutes as known_median_time_minutes,
  pfm.currency as known_currency,
  pfm.source_type as display_total_source_type,
  pfm.source_name as display_total_source_name,
  pfm.source_url as display_total_source_url,
  pfm.verification_level as display_total_verification_level,
  coalesce(pfm.collected_at, pfm.updated_at) as display_total_updated_at,
  coalesce(v.verified_amount, 0) as verified_amount,
  coalesce(v.verified_payout_count, 0) as verified_payout_count,
  v.verified_average_payout,
  v.verified_largest_payout,
  v.verified_first_payout_at,
  v.verified_last_payout_at,
  case
    when pfm.amount > 0 then least((coalesce(v.verified_amount, 0) / pfm.amount) * 100, 100)
  end as verification_coverage_percentage,
  case
    when pfm.amount is not null then greatest(pfm.amount - coalesce(v.verified_amount, 0), 0)
  end as unverified_coverage_amount,
  coalesce(v.verified_amount, 0) > coalesce(pfm.amount, 0)
    and pfm.amount is not null as verified_exceeds_known
from public.platforms p
cross join periods
left join verified v
  on v.platform_id = p.id
  and v.period_key = periods.period_key
left join pfm
  on pfm.platform_id = p.id
  and pfm.period_key = periods.period_key
where p.type = 'prop_firm';

grant select on public.external_platform_mappings to authenticated;
grant select on public.platform_payout_period_summary to anon, authenticated;

comment on column public.platform_payout_metrics.period_key is 'Ventana temporal del snapshot: 24h, 7d, 30d, 365d o all.';
comment on table public.external_platform_mappings is 'Mapeo explícito entre plataformas de Tragadora y proveedores externos.';
comment on view public.platform_payout_period_summary is 'Comparación por periodo entre snapshots Prop Firm Match y payouts verificados por Tragadora.';
