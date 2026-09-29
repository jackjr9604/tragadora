begin;

-- Prop Firm Match deja de participar como fuente vigente. Se conserva todo su historial.
update public.external_platform_mappings
set active = false, updated_at = now()
where provider = 'propfirmmatch' and active;

update public.platform_payout_metrics
set is_current = false, updated_at = now()
where lower(coalesce(source_name, '')) = 'prop firm match' and is_current;

-- Fuente declarativa inicial: página oficial de The Trading Pit.
update public.payout_sources ps
set
  source_type = 'public_page',
  source_url = 'https://www.thetradingpit.com/lp/all-rewards',
  status = true,
  config = jsonb_set(
    coalesce(ps.config, '{}'::jsonb),
    '{collector}',
    '{
      "enabled": true,
      "kind": "official_page",
      "version": 1,
      "currency": "USD",
      "sourceName": "The Trading Pit Rewards",
      "waitForSelector": "#overall-rewards-card",
      "periods": [
        {"periodKey":"all","label":"All time","triggerSelector":"button[data-period=\"all\"]:visible","activeSelector":"button[data-period=\"all\"].active:visible"},
        {"periodKey":"30d","label":"Last 30 days","triggerSelector":"button[data-period=\"30days\"]:visible","activeSelector":"button[data-period=\"30days\"].active:visible"}
      ],
      "metrics": {
        "amount":{"selector":"#stats-total-value","parser":"currency","required":true},
        "averagePayout":{"selector":"#stats-avg-value","parser":"currency","required":true}
      },
      "averageProcessingTime":{"selector":"#stats-duration-value","parser":"hours","required":false},
      "recentRewards":{"rowSelector":"#recent-rewards-tbody tr","columns":{"date":0,"market":1,"accountBalance":2,"reward":3},"limit":20}
    }'::jsonb,
    true
  )
from public.platforms p
where ps.platform_id = p.id
  and p.slug = 'the-trading-pit'
  and lower(ps.name) = lower('The Trading Pit · Rewards oficiales');

insert into public.payout_sources (platform_id, name, source_type, source_url, config, status)
select
  p.id,
  'The Trading Pit · Rewards oficiales',
  'public_page',
  'https://www.thetradingpit.com/lp/all-rewards',
  '{
    "collector": {
      "enabled": true,
      "kind": "official_page",
      "version": 1,
      "currency": "USD",
      "sourceName": "The Trading Pit Rewards",
      "waitForSelector": "#overall-rewards-card",
      "periods": [
        {"periodKey":"all","label":"All time","triggerSelector":"button[data-period=\"all\"]:visible","activeSelector":"button[data-period=\"all\"].active:visible"},
        {"periodKey":"30d","label":"Last 30 days","triggerSelector":"button[data-period=\"30days\"]:visible","activeSelector":"button[data-period=\"30days\"].active:visible"}
      ],
      "metrics": {
        "amount":{"selector":"#stats-total-value","parser":"currency","required":true},
        "averagePayout":{"selector":"#stats-avg-value","parser":"currency","required":true}
      },
      "averageProcessingTime":{"selector":"#stats-duration-value","parser":"hours","required":false},
      "recentRewards":{"rowSelector":"#recent-rewards-tbody tr","columns":{"date":0,"market":1,"accountBalance":2,"reward":3},"limit":20}
    }
  }'::jsonb,
  true
from public.platforms p
where p.slug = 'the-trading-pit'
  and not exists (
    select 1 from public.payout_sources ps
    where ps.platform_id = p.id
      and lower(ps.name) = lower('The Trading Pit · Rewards oficiales')
  );

-- Selección genérica del snapshot vigente de mayor confianza por firma y periodo.
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
        or (ps.source_type = 'official_api' and ps.config ->> 'verification' in ('verified', 'official_api_verified', 'direct_official'))
      )
    )
  group by p.platform_id, periods.period_key
), ranked_external as (
  select
    m.*,
    row_number() over (
      partition by m.platform_id, m.period_key
      order by
        case
          when m.source_type = 'official_api' and m.verification_level <> 'unverified' then 500
          when m.source_type = 'official_firm' and m.verification_level = 'firm_reported' then 400
          when m.source_type = 'third_party_api' and m.verification_level = 'tracked_external' then 300
          when m.source_type = 'third_party_public' and m.verification_level = 'blockchain_external' then 250
          when m.source_type = 'third_party_public' and m.verification_level = 'tracked_external' then 200
          when m.source_type in ('official_api', 'official_firm', 'third_party_api') then 150
          when m.source_type = 'third_party_public' then 120
          when m.source_type = 'manual' then 100
          else 0
        end desc,
        m.collected_at desc,
        m.updated_at desc
    ) as trust_rank
  from public.platform_payout_metrics m
  where m.is_current
    and m.metric_type = 'payout_summary'
    and m.period_key in ('24h', '7d', '30d', '365d', 'all')
    and m.verification_level <> 'unverified'
)
select
  p.id as platform_id,
  p.name as platform_name,
  p.slug,
  p.logo_url,
  periods.period_key,
  coalesce(v.verified_amount, selected.amount) as display_total_amount,
  coalesce(v.verified_payout_count, selected.payout_count) as known_payout_count,
  coalesce(v.verified_largest_payout, selected.largest_payout) as known_largest_payout,
  coalesce(v.verified_average_payout, selected.average_payout) as known_average_payout,
  selected.median_time_minutes as known_median_time_minutes,
  coalesce(selected.currency, 'USD') as known_currency,
  case when v.verified_payout_count > 0 then 'tragadora_blockchain' else selected.source_type end as display_total_source_type,
  case when v.verified_payout_count > 0 then 'Tragadora' else selected.source_name end as display_total_source_name,
  selected.source_url as display_total_source_url,
  case when v.verified_payout_count > 0 then 'verified' else selected.verification_level end as display_total_verification_level,
  case when v.verified_payout_count > 0 then v.verified_last_payout_at else coalesce(selected.collected_at, selected.updated_at) end as display_total_updated_at,
  coalesce(v.verified_amount, 0) as verified_amount,
  coalesce(v.verified_payout_count, 0) as verified_payout_count,
  v.verified_average_payout,
  v.verified_largest_payout,
  v.verified_first_payout_at,
  v.verified_last_payout_at,
  case when selected.amount > 0 and v.verified_amount is not null then least((v.verified_amount / selected.amount) * 100, 100) end as verification_coverage_percentage,
  case when selected.amount is not null then greatest(selected.amount - coalesce(v.verified_amount, 0), 0) end as unverified_coverage_amount,
  v.verified_amount > selected.amount and selected.amount is not null as verified_exceeds_known
from public.platforms p
cross join periods
left join verified v on v.platform_id = p.id and v.period_key = periods.period_key
left join ranked_external selected on selected.platform_id = p.id and selected.period_key = periods.period_key and selected.trust_rank = 1
where p.type = 'prop_firm';

grant select on public.platform_payout_period_summary to anon, authenticated;

comment on view public.platform_payout_period_summary is
  'Resumen por periodo: payouts verificados separados de snapshots oficiales o externos, seleccionados por confianza sin depender de un proveedor específico.';

commit;
