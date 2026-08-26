-- Datos estructurados para el recomendador de Prop Firms.
-- Ejecutar manualmente en Supabase antes de desplegar el código dependiente.

create table if not exists public.platform_markets (
  platform_id uuid not null
    references public.platforms(id)
    on delete cascade,

  market text not null
    check (
      market in (
        'cfd',
        'futures',
        'crypto',
        'options'
      )
    ),

  primary key (platform_id, market)
);

alter table public.prop_firm_details
  add column if not exists allows_scalping boolean,
  add column if not exists allows_day_trading boolean,
  add column if not exists allows_copy_trading boolean,
  add column if not exists time_limit_policy text,
  add column if not exists consistency_rules text,
  add column if not exists special_rules text;

alter table public.platforms
  add column if not exists origin_country_code text
    references public.countries(code);

create index if not exists platform_markets_market_idx
  on public.platform_markets (market);

comment on table public.platform_markets is
  'Mercados operables por plataforma; una plataforma puede tener varios.';

comment on column public.platforms.origin_country_code is
  'País de origen de la plataforma; no representa disponibilidad geográfica.';
