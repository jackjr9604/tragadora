-- Mappings explícitos faltantes detectados en el catálogo público de Mondo.
-- Idempotente por UNIQUE (platform_id, provider).

begin;

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
  platform.id,
  'mondotraders',
  mapping.external_name,
  mapping.external_slug,
  mapping.external_market,
  'https://mondotraders.com/en/firma/' || mapping.external_slug,
  true
from (
  values
    ('alpha-capital-group', 'AlphaCapitalGroup', 'AlphaCapitalGroup', 'forex'),
    ('alpha-futures', 'AlphaFutures', 'AlphaFutures', 'futures'),
    ('alpha-trader-firm', 'AlphaTraderFirm', 'AlphaTraderFirm', 'forex'),
    ('blue-guardian', 'BlueGuardian', 'BlueGuardian', 'forex'),
    ('crypto-fund-trader', 'CryptoFundTrader', 'CryptoFundTrader', 'crypto'),
    ('finotive-funding', 'FinotiveFunding', 'FinotiveFunding', 'forex'),
    ('for-traders', 'ForTraders', 'ForTraders', 'forex'),
    ('goat-funded-trader', 'GoatFundedTrader', 'GoatFundedTrader', 'forex'),
    ('hola-prime', 'HolaPrime', 'HolaPrime', 'forex')
) as mapping(platform_slug, external_name, external_slug, external_market)
join public.platforms platform
  on platform.slug = mapping.platform_slug
 and platform.type = 'prop_firm'
on conflict (platform_id, provider) do update set
  external_name = excluded.external_name,
  external_slug = excluded.external_slug,
  external_market = excluded.external_market,
  external_url = excluded.external_url,
  active = excluded.active,
  updated_at = now();

commit;
