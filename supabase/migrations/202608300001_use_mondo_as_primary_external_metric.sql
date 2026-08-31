-- MondoTraders pasa a ser la única referencia externa del Payout Tracker público.
-- No elimina métricas, mappings ni infraestructura de Prop Firm Match.

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
), external_metric as (
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
    and m.source_type = 'third_party_public'
    and lower(m.source_name) = 'mondotraders'
    and m.verification_level = 'blockchain_external'
    and m.period_key in ('24h', '7d', '30d', 'all')
  order by m.platform_id, m.period_key, m.collected_at desc, m.updated_at desc
)
select
  p.id as platform_id,
  p.name as platform_name,
  p.slug,
  p.logo_url,
  periods.period_key,
  external_metric.amount as display_total_amount,
  external_metric.payout_count as known_payout_count,
  external_metric.largest_payout as known_largest_payout,
  external_metric.average_payout as known_average_payout,
  external_metric.median_time_minutes as known_median_time_minutes,
  external_metric.currency as known_currency,
  external_metric.source_type as display_total_source_type,
  external_metric.source_name as display_total_source_name,
  external_metric.source_url as display_total_source_url,
  external_metric.verification_level as display_total_verification_level,
  coalesce(external_metric.collected_at, external_metric.updated_at) as display_total_updated_at,
  coalesce(v.verified_amount, 0) as verified_amount,
  coalesce(v.verified_payout_count, 0) as verified_payout_count,
  v.verified_average_payout,
  v.verified_largest_payout,
  v.verified_first_payout_at,
  v.verified_last_payout_at,
  case
    when external_metric.amount > 0 and v.verified_amount is not null
      then least((v.verified_amount / external_metric.amount) * 100, 100)
  end as verification_coverage_percentage,
  case
    when external_metric.amount is not null
      then greatest(external_metric.amount - coalesce(v.verified_amount, 0), 0)
  end as unverified_coverage_amount,
  v.verified_amount > external_metric.amount
    and external_metric.amount is not null as verified_exceeds_known
from public.platforms p
cross join periods
left join verified v
  on v.platform_id = p.id
  and v.period_key = periods.period_key
left join external_metric
  on external_metric.platform_id = p.id
  and external_metric.period_key = periods.period_key
where p.type = 'prop_firm';

grant select on public.platform_payout_period_summary to anon, authenticated;

comment on view public.platform_payout_period_summary is
  'Comparación por periodo entre snapshots MondoTraders y payouts verificados por Tragadora, sin sumar ambas fuentes.';
