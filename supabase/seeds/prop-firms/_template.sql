-- PLANTILLA: una Prop Firm y su catálogo comercial.
-- Copia este archivo y reemplaza todos los valores __REPLACE_*.
-- No ejecutes la plantilla sin revisar primero README.md.

begin;

-- ================================================================
-- 1. DATOS DE ENTRADA
-- ================================================================

create temporary table seed_platform (
  name text not null,
  slug text primary key,
  website_url text,
  status text not null,
  score numeric,
  origin_country_code text,
  ceo_name text,
  founded_at date,
  broker_provider text,
  inactivity_days integer,
  is_new boolean not null,
  profit_split_min numeric,
  profit_split_max numeric,
  supports_ea boolean,
  allows_news_trading boolean,
  allows_weekend_holding boolean,
  allows_scalping boolean,
  allows_day_trading boolean,
  allows_copy_trading boolean,
  time_limit_policy text,
  consistency_rules text,
  special_rules text
) on commit drop;

insert into seed_platform values (
  '__REPLACE_NAME__',
  '__replace_slug__',
  null,                    -- website_url
  'inactive',              -- active | inactive
  null,                    -- score
  null,                    -- countries.code; NULL si no está confirmado
  null,                    -- ceo_name
  null,                    -- founded_at
  null,                    -- broker_provider
  null,                    -- inactivity_days
  false,                   -- is_new
  null,                    -- profit_split_min
  null,                    -- profit_split_max
  null,                    -- supports_ea
  null,                    -- allows_news_trading
  null,                    -- allows_weekend_holding
  null,                    -- allows_scalping
  null,                    -- allows_day_trading
  null,                    -- allows_copy_trading
  null,                    -- time_limit_policy
  null,                    -- consistency_rules
  null                     -- special_rules
);

create temporary table seed_markets (market text primary key) on commit drop;
-- Valores admitidos por platform_markets_market_check: cfd, futures, crypto, options.
-- insert into seed_markets values ('cfd'), ('futures');

create temporary table seed_trading_platforms (slug text primary key) on commit drop;
-- Solo slugs que ya existan en public.trading_platforms.
-- insert into seed_trading_platforms values ('mt5'), ('ctrader');

create temporary table seed_instruments (slug text primary key) on commit drop;
-- Solo slugs que ya existan en public.instrument_categories.
-- insert into seed_instruments values ('forex'), ('indices');

create temporary table seed_transaction_methods (
  slug text primary key,
  supports_deposit boolean not null,
  supports_payout boolean not null,
  check (supports_deposit or supports_payout)
) on commit drop;
-- insert into seed_transaction_methods values ('crypto', true, true);

create temporary table seed_challenges (
  slug text primary key,
  name text not null,
  challenge_type text,
  phases integer,
  status text not null
) on commit drop;
-- insert into seed_challenges values ('__challenge_slug__', '__Challenge name__', '2 Step', 2, 'active');

create temporary table seed_challenge_phases (
  challenge_slug text not null,
  phase_number integer not null,
  name text,
  profit_target numeric,
  daily_drawdown numeric,
  max_drawdown numeric,
  min_trading_days integer,
  max_trading_days integer,
  min_profitable_days integer,
  drawdown_type text,
  drawdown_basis text,
  notes text,
  primary key (challenge_slug, phase_number)
) on commit drop;
-- insert into seed_challenge_phases values
--   ('__challenge_slug__', 1, 'Fase 1', 10, 5, 10, null, null, null, null, null, null),
--   ('__challenge_slug__', 2, 'Fase 2', 6, 5, 10, null, null, null, null, null, null);

create temporary table seed_challenge_variants (
  challenge_slug text not null,
  slug text not null,
  name text not null,
  profit_split numeric,
  price_modifier numeric,
  payout_frequency text,
  notes text,
  status boolean not null,
  primary key (challenge_slug, slug)
) on commit drop;
-- insert into seed_challenge_variants values
--   ('__challenge_slug__', '__variant_slug__', '__Variant name__', null, null, null, null, true);

create temporary table seed_challenge_variant_phases (
  challenge_slug text not null,
  variant_slug text not null,
  phase_number integer not null,
  profit_target numeric,
  daily_drawdown numeric,
  max_drawdown numeric,
  min_trading_days integer,
  min_profitable_days integer,
  drawdown_type text,
  drawdown_basis text,
  notes text,
  primary key (challenge_slug, variant_slug, phase_number)
) on commit drop;

create temporary table seed_account_plans (
  challenge_slug text not null,
  variant_slug text,
  account_size numeric not null,
  price numeric,
  currency text not null,
  profit_target numeric,
  daily_drawdown numeric,
  max_drawdown numeric,
  profit_split numeric,
  min_trading_days integer,
  max_trading_days integer,
  payout_frequency text
) on commit drop;
-- Para challenges normalizados, deja en NULL las reglas legacy por plan.
-- insert into seed_account_plans values
--   ('__challenge_slug__', null, 100000, 499, 'USD', null, null, null, null, null, null, null);

create temporary table seed_challenge_reward_options (
  challenge_slug text not null,
  variant_slug text,
  name text not null,
  profit_split numeric,
  payout_frequency text,
  minimum_payout_days integer,
  minimum_profitable_days integer,
  profitable_day_threshold_pct numeric,
  consistency_rule_pct numeric,
  notes text,
  status boolean not null,
  sort_order integer not null,
  source_url text,
  effective_from timestamptz,
  effective_to timestamptz
) on commit drop;
-- insert into seed_challenge_reward_options values
--   ('__challenge_slug__', null, 'Reward principal', 80, 'Cada 14 días', 14, null, null, null, null, true, 10, null, null, null);

-- ================================================================
-- 2. VALIDACIONES PREVIAS
-- ================================================================

do $$
begin
  if exists (select 1 from seed_platform where slug like '__%' or name like '__%') then
    raise exception 'Completa name y slug antes de ejecutar el seed';
  end if;

  if exists (
    select 1 from seed_platform input
    where input.origin_country_code is not null
      and not exists (select 1 from public.countries c where c.code = input.origin_country_code)
  ) then
    raise exception 'origin_country_code no existe en public.countries';
  end if;

  if exists (select 1 from seed_trading_platforms input left join public.trading_platforms c using (slug) where c.id is null) then
    raise exception 'Hay trading platforms inexistentes; crea/revisa el catálogo por separado';
  end if;
  if exists (select 1 from seed_instruments input left join public.instrument_categories c using (slug) where c.id is null) then
    raise exception 'Hay instrumentos inexistentes; crea/revisa el catálogo por separado';
  end if;
  if exists (select 1 from seed_transaction_methods input left join public.transaction_methods c using (slug) where c.id is null) then
    raise exception 'Hay métodos de transacción inexistentes; crea/revisa el catálogo por separado';
  end if;
  if exists (select 1 from seed_challenge_phases p left join seed_challenges c on c.slug = p.challenge_slug where c.slug is null)
    or exists (select 1 from seed_challenge_variants v left join seed_challenges c on c.slug = v.challenge_slug where c.slug is null)
    or exists (select 1 from seed_account_plans p left join seed_challenges c on c.slug = p.challenge_slug where c.slug is null)
    or exists (select 1 from seed_challenge_reward_options r left join seed_challenges c on c.slug = r.challenge_slug where c.slug is null) then
    raise exception 'Una fila hija referencia un challenge_slug no declarado';
  end if;
  if exists (
    select 1 from seed_challenge_variant_phases p
    left join seed_challenge_variants v on v.challenge_slug = p.challenge_slug and v.slug = p.variant_slug
    where v.slug is null
  ) or exists (
    select 1 from seed_account_plans p
    left join seed_challenge_variants v on v.challenge_slug = p.challenge_slug and v.slug = p.variant_slug
    where p.variant_slug is not null and v.slug is null
  ) or exists (
    select 1 from seed_challenge_reward_options r
    left join seed_challenge_variants v on v.challenge_slug = r.challenge_slug and v.slug = r.variant_slug
    where r.variant_slug is not null and v.slug is null
  ) then
    raise exception 'Una fila hija referencia una variante no declarada';
  end if;
end;
$$;

-- ================================================================
-- 3. PLATFORM Y DETALLES (identidad estable: platforms.slug)
-- ================================================================

-- No se asume un UNIQUE versionado sobre platforms.slug: update + insert
-- conserva el ID existente y también funciona si el constraint no está localmente documentado.
update public.platforms target set
  name = input.name,
  type = 'prop_firm',
  website_url = input.website_url,
  status = input.status,
  score = input.score,
  origin_country_code = input.origin_country_code
from seed_platform input
where target.slug = input.slug;

insert into public.platforms (name, slug, type, website_url, status, score, origin_country_code)
select name, slug, 'prop_firm', website_url, status, score, origin_country_code
from seed_platform input
where not exists (select 1 from public.platforms target where target.slug = input.slug);

do $$
declare
  v_platform_id uuid;
begin
  select p.id into strict v_platform_id
  from public.platforms p join seed_platform input using (slug);

  insert into public.prop_firm_details (
    platform_id, ceo_name, founded_at, broker_provider, inactivity_days, is_new,
    profit_split_min, profit_split_max, supports_ea, allows_news_trading,
    allows_weekend_holding, allows_scalping, allows_day_trading,
    allows_copy_trading, time_limit_policy, consistency_rules, special_rules
  )
  select
    v_platform_id, ceo_name, founded_at, broker_provider, inactivity_days, is_new,
    profit_split_min, profit_split_max, supports_ea, allows_news_trading,
    allows_weekend_holding, allows_scalping, allows_day_trading,
    allows_copy_trading, time_limit_policy, consistency_rules, special_rules
  from seed_platform
  on conflict (platform_id) do update set
    ceo_name = excluded.ceo_name,
    founded_at = excluded.founded_at,
    broker_provider = excluded.broker_provider,
    inactivity_days = excluded.inactivity_days,
    is_new = excluded.is_new,
    profit_split_min = excluded.profit_split_min,
    profit_split_max = excluded.profit_split_max,
    supports_ea = excluded.supports_ea,
    allows_news_trading = excluded.allows_news_trading,
    allows_weekend_holding = excluded.allows_weekend_holding,
    allows_scalping = excluded.allows_scalping,
    allows_day_trading = excluded.allows_day_trading,
    allows_copy_trading = excluded.allows_copy_trading,
    time_limit_policy = excluded.time_limit_policy,
    consistency_rules = excluded.consistency_rules,
    special_rules = excluded.special_rules;

  -- Estas tablas representan el estado completo declarado por el seed.
  delete from public.platform_markets where platform_id = v_platform_id;
  insert into public.platform_markets (platform_id, market)
  select v_platform_id, market from seed_markets;

  delete from public.platform_trading_platforms where platform_id = v_platform_id;
  insert into public.platform_trading_platforms (platform_id, trading_platform_id)
  select v_platform_id, c.id from seed_trading_platforms input join public.trading_platforms c using (slug);

  delete from public.platform_instruments where platform_id = v_platform_id;
  insert into public.platform_instruments (platform_id, instrument_category_id)
  select v_platform_id, c.id from seed_instruments input join public.instrument_categories c using (slug);

  delete from public.platform_transaction_methods where platform_id = v_platform_id;
  insert into public.platform_transaction_methods (platform_id, transaction_method_id, supports_deposit, supports_payout)
  select v_platform_id, c.id, input.supports_deposit, input.supports_payout
  from seed_transaction_methods input join public.transaction_methods c using (slug);

  -- Conserva el UUID de challenges existentes; no elimina challenges omitidos.
  update public.challenges target set
    name = input.name,
    challenge_type = input.challenge_type,
    phases = input.phases,
    status = input.status
  from seed_challenges input
  where target.platform_id = v_platform_id and target.slug = input.slug;

  insert into public.challenges (platform_id, name, slug, challenge_type, phases, status)
  select v_platform_id, input.name, input.slug, input.challenge_type, input.phases, input.status
  from seed_challenges input
  where not exists (
    select 1 from public.challenges target
    where target.platform_id = v_platform_id and target.slug = input.slug
  );

  if exists (
    select c.slug from public.challenges c
    join seed_challenges input on input.slug = c.slug
    where c.platform_id = v_platform_id
    group by c.slug having count(*) > 1
  ) then
    raise exception 'Existen challenges duplicados para platform_id + slug';
  end if;

  -- Reemplazo completo de hijos SOLO para los challenges declarados arriba.
  delete from public.challenge_reward_options r
  using public.challenges c, seed_challenges input
  where r.challenge_id = c.id and c.platform_id = v_platform_id and c.slug = input.slug;

  delete from public.account_plans p
  using public.challenges c, seed_challenges input
  where p.challenge_id = c.id and c.platform_id = v_platform_id and c.slug = input.slug;

  delete from public.challenge_variant_phases vp
  using public.challenge_variants v, public.challenges c, seed_challenges input
  where vp.variant_id = v.id and v.challenge_id = c.id and c.platform_id = v_platform_id and c.slug = input.slug;

  delete from public.challenge_variants v
  using public.challenges c, seed_challenges input
  where v.challenge_id = c.id and c.platform_id = v_platform_id and c.slug = input.slug;

  delete from public.challenge_phases p
  using public.challenges c, seed_challenges input
  where p.challenge_id = c.id and c.platform_id = v_platform_id and c.slug = input.slug;

  insert into public.challenge_phases (
    challenge_id, phase_number, name, profit_target, daily_drawdown, max_drawdown,
    min_trading_days, max_trading_days, min_profitable_days,
    drawdown_type, drawdown_basis, notes
  )
  select c.id, input.phase_number, input.name, input.profit_target,
    input.daily_drawdown, input.max_drawdown, input.min_trading_days,
    input.max_trading_days, input.min_profitable_days, input.drawdown_type,
    input.drawdown_basis, input.notes
  from seed_challenge_phases input
  join public.challenges c on c.platform_id = v_platform_id and c.slug = input.challenge_slug;

  insert into public.challenge_variants (
    challenge_id, name, slug, profit_split, price_modifier,
    payout_frequency, notes, status
  )
  select c.id, input.name, input.slug, input.profit_split, input.price_modifier,
    input.payout_frequency, input.notes, input.status
  from seed_challenge_variants input
  join public.challenges c on c.platform_id = v_platform_id and c.slug = input.challenge_slug;

  insert into public.challenge_variant_phases (
    variant_id, phase_number, profit_target, daily_drawdown, max_drawdown,
    min_trading_days, min_profitable_days, drawdown_type, drawdown_basis, notes
  )
  select v.id, input.phase_number, input.profit_target, input.daily_drawdown,
    input.max_drawdown, input.min_trading_days, input.min_profitable_days,
    input.drawdown_type, input.drawdown_basis, input.notes
  from seed_challenge_variant_phases input
  join public.challenges c on c.platform_id = v_platform_id and c.slug = input.challenge_slug
  join public.challenge_variants v on v.challenge_id = c.id and v.slug = input.variant_slug;

  insert into public.account_plans (
    challenge_id, variant_id, account_size, price, currency, profit_target,
    daily_drawdown, max_drawdown, profit_split, min_trading_days,
    max_trading_days, payout_frequency
  )
  select c.id, v.id, input.account_size, input.price, input.currency,
    input.profit_target, input.daily_drawdown, input.max_drawdown,
    input.profit_split, input.min_trading_days, input.max_trading_days,
    input.payout_frequency
  from seed_account_plans input
  join public.challenges c on c.platform_id = v_platform_id and c.slug = input.challenge_slug
  left join public.challenge_variants v on v.challenge_id = c.id and v.slug = input.variant_slug;

  insert into public.challenge_reward_options (
    challenge_id, variant_id, name, profit_split, payout_frequency,
    minimum_payout_days, minimum_profitable_days, profitable_day_threshold_pct,
    consistency_rule_pct, notes, status, sort_order, source_url,
    effective_from, effective_to
  )
  select c.id, v.id, input.name, input.profit_split, input.payout_frequency,
    input.minimum_payout_days, input.minimum_profitable_days,
    input.profitable_day_threshold_pct, input.consistency_rule_pct,
    input.notes, input.status, input.sort_order, input.source_url,
    input.effective_from, input.effective_to
  from seed_challenge_reward_options input
  join public.challenges c on c.platform_id = v_platform_id and c.slug = input.challenge_slug
  left join public.challenge_variants v on v.challenge_id = c.id and v.slug = input.variant_slug;
end;
$$;

commit;
