-- Datos estructurados de alto valor para el perfil público de Prop Firms.
-- La migración no asigna catálogos a firmas existentes.

alter table public.prop_firm_details
  add column if not exists ceo_name text,
  add column if not exists founded_at date,
  add column if not exists broker_provider text,
  add column if not exists inactivity_days integer;

alter table public.prop_firm_details
  drop constraint if exists prop_firm_details_inactivity_days_check;

alter table public.prop_firm_details
  add constraint prop_firm_details_inactivity_days_check
  check (inactivity_days is null or inactivity_days >= 0);

create table if not exists public.trading_platforms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transaction_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instrument_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_trading_platforms (
  platform_id uuid not null references public.platforms(id) on delete cascade,
  trading_platform_id uuid not null references public.trading_platforms(id) on delete cascade,
  primary key (platform_id, trading_platform_id)
);

create table if not exists public.platform_transaction_methods (
  platform_id uuid not null references public.platforms(id) on delete cascade,
  transaction_method_id uuid not null references public.transaction_methods(id) on delete cascade,
  supports_deposit boolean not null default false,
  supports_payout boolean not null default false,
  primary key (platform_id, transaction_method_id),
  constraint platform_transaction_methods_support_check
    check (supports_deposit or supports_payout)
);

create table if not exists public.platform_instruments (
  platform_id uuid not null references public.platforms(id) on delete cascade,
  instrument_category_id uuid not null references public.instrument_categories(id) on delete cascade,
  primary key (platform_id, instrument_category_id)
);

create index if not exists platform_trading_platforms_catalog_idx
  on public.platform_trading_platforms (trading_platform_id);
create index if not exists platform_transaction_methods_catalog_idx
  on public.platform_transaction_methods (transaction_method_id);
create index if not exists platform_instruments_catalog_idx
  on public.platform_instruments (instrument_category_id);

create or replace function public.touch_prop_firm_catalog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trading_platforms_touch_updated_at on public.trading_platforms;
create trigger trading_platforms_touch_updated_at before update on public.trading_platforms
for each row execute function public.touch_prop_firm_catalog_updated_at();
drop trigger if exists transaction_methods_touch_updated_at on public.transaction_methods;
create trigger transaction_methods_touch_updated_at before update on public.transaction_methods
for each row execute function public.touch_prop_firm_catalog_updated_at();
drop trigger if exists instrument_categories_touch_updated_at on public.instrument_categories;
create trigger instrument_categories_touch_updated_at before update on public.instrument_categories
for each row execute function public.touch_prop_firm_catalog_updated_at();

alter table public.trading_platforms enable row level security;
alter table public.transaction_methods enable row level security;
alter table public.instrument_categories enable row level security;
alter table public.platform_trading_platforms enable row level security;
alter table public.platform_transaction_methods enable row level security;
alter table public.platform_instruments enable row level security;

create policy "trading_platforms_public_read" on public.trading_platforms
for select using (status or public.is_admin());
create policy "transaction_methods_public_read" on public.transaction_methods
for select using (status or public.is_admin());
create policy "instrument_categories_public_read" on public.instrument_categories
for select using (status or public.is_admin());
create policy "platform_trading_platforms_public_read" on public.platform_trading_platforms
for select using (exists (select 1 from public.trading_platforms catalog where catalog.id = trading_platform_id and catalog.status));
create policy "platform_transaction_methods_public_read" on public.platform_transaction_methods
for select using (exists (select 1 from public.transaction_methods catalog where catalog.id = transaction_method_id and catalog.status));
create policy "platform_instruments_public_read" on public.platform_instruments
for select using (exists (select 1 from public.instrument_categories catalog where catalog.id = instrument_category_id and catalog.status));

create policy "trading_platforms_admin_insert" on public.trading_platforms for insert with check (public.is_admin());
create policy "trading_platforms_admin_update" on public.trading_platforms for update using (public.is_admin()) with check (public.is_admin());
create policy "trading_platforms_admin_delete" on public.trading_platforms for delete using (public.is_admin());
create policy "transaction_methods_admin_insert" on public.transaction_methods for insert with check (public.is_admin());
create policy "transaction_methods_admin_update" on public.transaction_methods for update using (public.is_admin()) with check (public.is_admin());
create policy "transaction_methods_admin_delete" on public.transaction_methods for delete using (public.is_admin());
create policy "instrument_categories_admin_insert" on public.instrument_categories for insert with check (public.is_admin());
create policy "instrument_categories_admin_update" on public.instrument_categories for update using (public.is_admin()) with check (public.is_admin());
create policy "instrument_categories_admin_delete" on public.instrument_categories for delete using (public.is_admin());

create policy "platform_trading_platforms_admin_all" on public.platform_trading_platforms
for all using (public.is_admin()) with check (public.is_admin());
create policy "platform_transaction_methods_admin_all" on public.platform_transaction_methods
for all using (public.is_admin()) with check (public.is_admin());
create policy "platform_instruments_admin_all" on public.platform_instruments
for all using (public.is_admin()) with check (public.is_admin());

insert into public.trading_platforms (name, slug) values
  ('MT4', 'mt4'), ('MT5', 'mt5'), ('cTrader', 'ctrader'),
  ('Match Trader', 'match-trader'), ('Tradovate', 'tradovate'),
  ('NinjaTrader', 'ninjatrader'), ('Quantower', 'quantower'),
  ('TradingView', 'tradingview'), ('ATAS', 'atas')
on conflict (slug) do nothing;

insert into public.transaction_methods (name, slug) values
  ('Credit / Debit Card', 'credit-debit-card'), ('Crypto', 'crypto'),
  ('PayPal', 'paypal'), ('Apple Pay', 'apple-pay'), ('Google Pay', 'google-pay'),
  ('Bank Transfer', 'bank-transfer'), ('Rise', 'rise'), ('TC Pay', 'tc-pay'),
  ('Skrill', 'skrill'), ('Perfect Money', 'perfect-money')
on conflict (slug) do nothing;

insert into public.instrument_categories (name, slug) values
  ('Forex', 'forex'), ('Indices', 'indices'), ('Metals', 'metals'),
  ('Crypto', 'crypto'), ('Commodities', 'commodities'), ('Futures', 'futures'),
  ('Stocks', 'stocks'), ('Options', 'options')
on conflict (slug) do nothing;
