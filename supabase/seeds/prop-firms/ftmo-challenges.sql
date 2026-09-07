-- FTMO · Challenges normalizados
-- Fuentes oficiales consultadas para la carga:
-- https://ftmo.com/es/1-step-challenge/
-- https://ftmo.com/es/2-step-challenge/
-- https://ftmo.com/es/trading-objectives/
-- https://ftmo.com/es/faq/como-puedo-retirar-mi-recompensa/
--
-- No incluye Offers, Affiliate Links, payout metrics ni snapshots.
-- Best Day Rule 50% (1-Step) está confirmado, pero el schema actual no tiene
-- una columna normalizada inequívoca para esa regla; se conserva en este
-- comentario y no se inserta en una columna con otra semántica.

begin;

create temporary table seed_ftmo_challenges (
  slug text primary key,
  name text not null,
  challenge_type text not null,
  phases integer not null,
  status text not null
) on commit drop;

insert into seed_ftmo_challenges values
  ('ftmo-1-step', 'FTMO Challenge 1-Step', '1-step', 1, 'active'),
  ('ftmo-2-step', 'FTMO Challenge 2-Step', '2-step', 2, 'active');

create temporary table seed_ftmo_phases (
  challenge_slug text not null,
  phase_number integer not null,
  name text not null,
  profit_target numeric not null,
  daily_drawdown numeric not null,
  max_drawdown numeric not null,
  min_trading_days integer,
  max_trading_days integer,
  min_profitable_days integer,
  drawdown_type text,
  drawdown_basis text,
  notes text,
  primary key (challenge_slug, phase_number)
) on commit drop;

insert into seed_ftmo_phases values
  ('ftmo-1-step', 1, 'FTMO Challenge', 10, 3, 10, null, null, null, null, null, 'Trading period: Unlimited.'),
  ('ftmo-2-step', 1, 'FTMO Challenge', 10, 5, 10, 4, null, null, null, null, 'Trading period: Unlimited.'),
  ('ftmo-2-step', 2, 'Verification', 5, 5, 10, 4, null, null, null, null, 'Trading period: Unlimited.');

create temporary table seed_ftmo_plans (
  challenge_slug text not null,
  account_size numeric not null,
  currency text not null,
  primary key (challenge_slug, account_size, currency)
) on commit drop;

insert into seed_ftmo_plans values
  ('ftmo-1-step', 10000, 'USD'),
  ('ftmo-1-step', 25000, 'USD'),
  ('ftmo-1-step', 50000, 'USD'),
  ('ftmo-1-step', 100000, 'USD'),
  ('ftmo-1-step', 200000, 'USD'),
  ('ftmo-2-step', 10000, 'USD'),
  ('ftmo-2-step', 25000, 'USD'),
  ('ftmo-2-step', 50000, 'USD'),
  ('ftmo-2-step', 100000, 'USD'),
  ('ftmo-2-step', 200000, 'USD');

create temporary table seed_ftmo_rewards (
  challenge_slug text not null,
  name text not null,
  profit_split numeric not null,
  payout_frequency text,
  minimum_payout_days integer,
  notes text,
  status boolean not null,
  sort_order integer not null,
  source_url text,
  primary key (challenge_slug, name)
) on commit drop;

insert into seed_ftmo_rewards values
  (
    'ftmo-1-step',
    'Reward estándar',
    90,
    'A solicitud desde el día 14',
    14,
    'La primera solicitud puede realizarse el día 14 o cualquier día posterior después de la primera operación de la FTMO Account.',
    true,
    10,
    'https://ftmo.com/es/faq/como-puedo-retirar-mi-recompensa/'
  ),
  (
    'ftmo-2-step',
    'Reward estándar',
    80,
    'A solicitud desde el día 14',
    14,
    'Reward inicial estándar.',
    true,
    10,
    'https://ftmo.com/es/faq/como-puedo-retirar-mi-recompensa/'
  ),
  (
    'ftmo-2-step',
    'Reward máximo con Scaling Plan / Premium Programme',
    90,
    'A solicitud desde el día 14',
    14,
    'No es el reward inicial. El 90% requiere cumplir las condiciones aplicables de Scaling Plan o Premium Programme.',
    true,
    20,
    'https://ftmo.com/es/2-step-challenge/'
  );

do $$
declare
  v_platform_id uuid;
begin
  select id into strict v_platform_id
  from public.platforms
  where slug = 'ftmo' and type = 'prop_firm';

  update public.challenges target set
    name = input.name,
    challenge_type = input.challenge_type,
    phases = input.phases,
    status = input.status
  from seed_ftmo_challenges input
  where target.platform_id = v_platform_id and target.slug = input.slug;

  insert into public.challenges (
    platform_id, name, slug, challenge_type, phases, status
  )
  select
    v_platform_id, input.name, input.slug, input.challenge_type,
    input.phases, input.status
  from seed_ftmo_challenges input
  where not exists (
    select 1
    from public.challenges target
    where target.platform_id = v_platform_id and target.slug = input.slug
  );

  if exists (
    select c.slug
    from public.challenges c
    join seed_ftmo_challenges input on input.slug = c.slug
    where c.platform_id = v_platform_id
    group by c.slug
    having count(*) > 1
  ) then
    raise exception 'FTMO tiene challenges duplicados para platform_id + slug';
  end if;

  -- No existe precio base global confirmado. Antes de reemplazar los planes,
  -- preservamos el precio actual de cada tamaño base si ya estaba registrado.
  if exists (
    select p.challenge_id, p.account_size, p.currency
    from public.account_plans p
    join public.challenges c on c.id = p.challenge_id
    join seed_ftmo_challenges input on input.slug = c.slug
    where c.platform_id = v_platform_id and p.variant_id is null
    group by p.challenge_id, p.account_size, p.currency
    having count(*) > 1
  ) then
    raise exception 'Existen account plans FTMO base duplicados; revisar antes de reemplazar';
  end if;

  create temporary table seed_ftmo_existing_prices on commit drop as
  select c.slug as challenge_slug, p.account_size, p.currency, p.price
  from public.account_plans p
  join public.challenges c on c.id = p.challenge_id
  join seed_ftmo_challenges input on input.slug = c.slug
  where c.platform_id = v_platform_id and p.variant_id is null;

  -- Orden de borrado compatible con las dependencias normalizadas.
  delete from public.challenge_reward_options reward
  using public.challenges challenge, seed_ftmo_challenges input
  where reward.challenge_id = challenge.id
    and challenge.platform_id = v_platform_id
    and challenge.slug = input.slug;

  delete from public.account_plans plan
  using public.challenges challenge, seed_ftmo_challenges input
  where plan.challenge_id = challenge.id
    and challenge.platform_id = v_platform_id
    and challenge.slug = input.slug;

  delete from public.challenge_variant_phases override
  using public.challenge_variants variant, public.challenges challenge, seed_ftmo_challenges input
  where override.variant_id = variant.id
    and variant.challenge_id = challenge.id
    and challenge.platform_id = v_platform_id
    and challenge.slug = input.slug;

  delete from public.challenge_variants variant
  using public.challenges challenge, seed_ftmo_challenges input
  where variant.challenge_id = challenge.id
    and challenge.platform_id = v_platform_id
    and challenge.slug = input.slug;

  delete from public.challenge_phases phase
  using public.challenges challenge, seed_ftmo_challenges input
  where phase.challenge_id = challenge.id
    and challenge.platform_id = v_platform_id
    and challenge.slug = input.slug;

  insert into public.challenge_phases (
    challenge_id, phase_number, name, profit_target, daily_drawdown,
    max_drawdown, min_trading_days, max_trading_days,
    min_profitable_days, drawdown_type, drawdown_basis, notes
  )
  select
    challenge.id, input.phase_number, input.name, input.profit_target,
    input.daily_drawdown, input.max_drawdown, input.min_trading_days,
    input.max_trading_days, input.min_profitable_days, input.drawdown_type,
    input.drawdown_basis, input.notes
  from seed_ftmo_phases input
  join public.challenges challenge
    on challenge.platform_id = v_platform_id
   and challenge.slug = input.challenge_slug;

  insert into public.account_plans (
    challenge_id, variant_id, account_size, price, currency,
    profit_target, daily_drawdown, max_drawdown, profit_split,
    min_trading_days, max_trading_days, payout_frequency
  )
  select
    challenge.id,
    null,
    input.account_size,
    existing.price,
    input.currency,
    null, null, null, null, null, null, null
  from seed_ftmo_plans input
  join public.challenges challenge
    on challenge.platform_id = v_platform_id
   and challenge.slug = input.challenge_slug
  left join seed_ftmo_existing_prices existing
    on existing.challenge_slug = input.challenge_slug
   and existing.account_size = input.account_size
   and existing.currency = input.currency;

  insert into public.challenge_reward_options (
    challenge_id, variant_id, name, profit_split, payout_frequency,
    minimum_payout_days, minimum_profitable_days,
    profitable_day_threshold_pct, consistency_rule_pct, notes,
    status, sort_order, source_url, effective_from, effective_to
  )
  select
    challenge.id,
    null,
    input.name,
    input.profit_split,
    input.payout_frequency,
    input.minimum_payout_days,
    null,
    null,
    null,
    input.notes,
    input.status,
    input.sort_order,
    input.source_url,
    null,
    null
  from seed_ftmo_rewards input
  join public.challenges challenge
    on challenge.platform_id = v_platform_id
   and challenge.slug = input.challenge_slug;
end;
$$;

commit;
