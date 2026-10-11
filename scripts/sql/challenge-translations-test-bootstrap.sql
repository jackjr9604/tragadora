\ir offer-translations-test-bootstrap.sql

create table public.challenges (
  id uuid primary key default extensions.gen_random_uuid(), platform_id uuid, name text not null,
  challenge_type text, phases integer, status text default 'active'
);
create table public.challenge_phases (
  id uuid primary key default extensions.gen_random_uuid(), challenge_id uuid not null references public.challenges(id) on delete cascade,
  phase_number integer not null, name text, profit_target numeric, daily_drawdown numeric, max_drawdown numeric,
  min_trading_days integer, max_trading_days integer, min_profitable_days integer, drawdown_type text, drawdown_basis text, notes text
);
create table public.challenge_variants (
  id uuid primary key default extensions.gen_random_uuid(), challenge_id uuid not null references public.challenges(id) on delete cascade,
  name text not null, slug text not null, profit_split numeric, price_modifier numeric, payout_frequency text, notes text, status boolean not null default true
);
create table public.challenge_variant_phases (
  id uuid primary key default extensions.gen_random_uuid(), variant_id uuid not null references public.challenge_variants(id) on delete cascade,
  phase_number integer not null, profit_target numeric, daily_drawdown numeric, max_drawdown numeric,
  min_trading_days integer, min_profitable_days integer, drawdown_type text, drawdown_basis text, notes text
);
create table public.account_plans (
  id uuid primary key default extensions.gen_random_uuid(), challenge_id uuid not null references public.challenges(id) on delete cascade,
  variant_id uuid references public.challenge_variants(id) on delete restrict, account_size numeric, price numeric, currency text,
  profit_target numeric, daily_drawdown numeric, max_drawdown numeric, profit_split numeric,
  min_trading_days integer, max_trading_days integer, payout_frequency text
);
create table public.challenge_reward_options (
  id uuid primary key default extensions.gen_random_uuid(), challenge_id uuid not null references public.challenges(id) on delete cascade,
  variant_id uuid references public.challenge_variants(id) on delete restrict, name text not null, profit_split numeric,
  payout_frequency text, minimum_payout_days integer, minimum_profitable_days integer,
  profitable_day_threshold_pct numeric, consistency_rule_pct numeric, notes text, status boolean not null default true,
  sort_order integer not null default 0, source_url text, effective_from timestamptz, effective_to timestamptz
);

with challenge as (
  insert into public.challenges(name,challenge_type,phases) values('Commercial Challenge','two_step',2) returning id
), variant as (
  insert into public.challenge_variants(challenge_id,name,slug,profit_split,price_modifier,payout_frequency,notes)
  select id,'Swing','swing',80,0,'Cada 14 días','Notas de variante' from challenge returning id,challenge_id
), phase as (
  insert into public.challenge_phases(challenge_id,phase_number,name,profit_target,daily_drawdown,max_drawdown,notes)
  select challenge_id,1,'Evaluación',10,5,10,'Notas de fase' from variant returning id,challenge_id
), override_row as (
  insert into public.challenge_variant_phases(variant_id,phase_number,profit_target,notes)
  select id,1,8,'Notas de override' from variant returning id,variant_id
), plan as (
  insert into public.account_plans(challenge_id,variant_id,account_size,price,currency,profit_target,daily_drawdown,max_drawdown,profit_split,payout_frequency)
  select challenge_id,id,100000,500,'USD',10,5,10,80,'Cada 14 días' from variant returning id
)
insert into public.challenge_reward_options(challenge_id,variant_id,name,profit_split,payout_frequency,minimum_payout_days,notes)
select challenge_id,id,'Recompensa estándar',80,'Cada 14 días',14,'Notas de recompensa' from variant;
