-- Batch 01 de disponibilidad geográfica.
-- Preparado el 2026-09-18. REVISAR antes de ejecutar.
-- No crea schema, no modifica reglas legacy y aborta ante evidencia conflictiva.
-- Requiere ejecutar y verificar primero:
-- supabase/seeds/countries/20260918_missing_latam_countries.sql

begin;

create temp table geography_batch_01_platforms (
  platform_slug text primary key
) on commit drop;

insert into geography_batch_01_platforms (platform_slug) values
  ('ftmo'),
  ('fundednext'),
  ('fundednextfutures'),
  ('fundingpips'),
  ('tradeify'),
  ('myfundedfutures'),
  ('the5ers'),
  ('alpha-capital-group'),
  ('e8markets'),
  ('lucid-trading'),
  ('fxify'),
  ('maven-trading'),
  ('brightfunded'),
  ('alpha-futures'),
  ('toponefutures');

create temp table geography_batch_01 (
  platform_slug text not null,
  country_code text not null,
  market text,
  status text not null,
  restriction_basis text not null,
  source_url text not null,
  verified_at timestamptz not null,
  rule_summary text not null
) on commit drop;

insert into geography_batch_01
  (platform_slug, country_code, market, status, restriction_basis, source_url, verified_at, rule_summary)
values
  ('ftmo', 'LC', null, 'restricted', 'unspecified', 'https://ftmo.com/en/faq/who-can-join-ftmo/', '2026-09-18 00:00:00+00', 'FTMO incluye Santa Lucía entre los países a cuyos clientes no presta servicios.'),
  ('ftmo', 'VE', null, 'restricted', 'unspecified', 'https://ftmo.com/en/faq/who-can-join-ftmo/', '2026-09-18 00:00:00+00', 'FTMO incluye Venezuela entre los países a cuyos clientes no presta servicios.'),
  ('fundednextfutures', 'VE', 'futures', 'restricted', 'residence', 'https://helpfutures.fundednext.com/en/articles/14274473-are-any-countries-restricted-on-fundednext-futures', '2026-09-18 00:00:00+00', 'Los residentes de Venezuela no pueden comprar cuentas de FundedNext Futures.'),
  ('fundingpips', 'AE', null, 'restricted', 'residence', 'https://help.fundingpips.com/hc/en-us/articles/44390730743825-Get-Started', '2026-09-18 00:00:00+00', 'FundingPips no acepta traders residentes en Emiratos Árabes Unidos.'),
  ('tradeify', 'EC', null, 'restricted', 'residence', 'https://help.tradeify.co/en/articles/10495888-rules-restricted-countries', '2026-09-18 00:00:00+00', 'Tradeify restringe el acceso a residentes permanentes de Ecuador.'),
  ('tradeify', 'NI', null, 'restricted', 'residence', 'https://help.tradeify.co/en/articles/10495888-rules-restricted-countries', '2026-09-18 00:00:00+00', 'Tradeify restringe el acceso a residentes permanentes de Nicaragua.'),
  ('tradeify', 'PA', null, 'restricted', 'residence', 'https://help.tradeify.co/en/articles/10495888-rules-restricted-countries', '2026-09-18 00:00:00+00', 'Tradeify restringe el acceso a residentes permanentes de Panamá.'),
  ('tradeify', 'VE', null, 'restricted', 'residence', 'https://help.tradeify.co/en/articles/10495888-rules-restricted-countries', '2026-09-18 00:00:00+00', 'Tradeify restringe el acceso a residentes permanentes de Venezuela.'),
  ('myfundedfutures', 'EC', null, 'restricted', 'unspecified', 'https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy', '2026-09-18 00:00:00+00', 'Ecuador figura en la lista oficial de países restringidos de My Funded Futures.'),
  ('myfundedfutures', 'NI', null, 'restricted', 'unspecified', 'https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy', '2026-09-18 00:00:00+00', 'Nicaragua figura en la lista oficial de países restringidos de My Funded Futures.'),
  ('myfundedfutures', 'PA', null, 'restricted', 'unspecified', 'https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy', '2026-09-18 00:00:00+00', 'Panamá figura en la lista oficial de países restringidos de My Funded Futures.'),
  ('myfundedfutures', 'VE', null, 'restricted', 'unspecified', 'https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy', '2026-09-18 00:00:00+00', 'Venezuela figura en la lista oficial de países restringidos de My Funded Futures.'),
  ('the5ers', 'VE', null, 'restricted', 'residence', 'https://the5ers.com/terms-and-conditions/', '2026-09-18 00:00:00+00', 'La elegibilidad de The5ers excluye a residentes de Venezuela.'),
  ('alpha-capital-group', 'VE', null, 'restricted', 'unspecified', 'https://help.alphacapitalgroup.uk/en/articles/8775575-countries-with-limitations', '2026-09-18 00:00:00+00', 'Alpha Capital Group no presta servicios a nacionales o residentes de Venezuela.'),
  ('e8markets', 'NI', 'cfd', 'restricted', 'unspecified', 'https://help.e8markets.com/en/articles/5514278-accepted-countries', '2026-09-18 00:00:00+00', 'Nicaragua figura en la lista restringida de E8 Classic Markets.'),
  ('e8markets', 'NI', 'crypto', 'restricted', 'unspecified', 'https://help.e8markets.com/en/articles/5514278-accepted-countries', '2026-09-18 00:00:00+00', 'Nicaragua figura en la lista restringida de E8 Perpetuals.'),
  ('e8markets', 'NI', 'futures', 'restricted', 'unspecified', 'https://help.e8markets.com/en/articles/5514278-accepted-countries', '2026-09-18 00:00:00+00', 'Nicaragua figura en la lista restringida de E8 Futures.'),
  ('e8markets', 'PA', 'futures', 'restricted', 'unspecified', 'https://help.e8markets.com/en/articles/5514278-accepted-countries', '2026-09-18 00:00:00+00', 'Panamá figura en la lista restringida de E8 Futures, no en Classic/Perpetuals.'),
  ('e8markets', 'VE', 'cfd', 'restricted', 'unspecified', 'https://help.e8markets.com/en/articles/5514278-accepted-countries', '2026-09-18 00:00:00+00', 'Venezuela figura en la lista restringida de E8 Classic Markets.'),
  ('e8markets', 'VE', 'crypto', 'restricted', 'unspecified', 'https://help.e8markets.com/en/articles/5514278-accepted-countries', '2026-09-18 00:00:00+00', 'Venezuela figura en la lista restringida de E8 Perpetuals.'),
  ('e8markets', 'VE', 'futures', 'restricted', 'unspecified', 'https://help.e8markets.com/en/articles/5514278-accepted-countries', '2026-09-18 00:00:00+00', 'Venezuela figura en la lista restringida de E8 Futures.'),
  ('lucid-trading', 'EC', 'futures', 'restricted', 'unspecified', 'https://support.lucidtrading.com/en/articles/11404636-restricted-countries', '2026-09-18 00:00:00+00', 'Lucid no admite ciudadanos o residentes de Ecuador.'),
  ('lucid-trading', 'NI', 'futures', 'restricted', 'unspecified', 'https://support.lucidtrading.com/en/articles/11404636-restricted-countries', '2026-09-18 00:00:00+00', 'Lucid no admite ciudadanos o residentes de Nicaragua.'),
  ('lucid-trading', 'PA', 'futures', 'restricted', 'unspecified', 'https://support.lucidtrading.com/en/articles/11404636-restricted-countries', '2026-09-18 00:00:00+00', 'Lucid no admite ciudadanos o residentes de Panamá.'),
  ('lucid-trading', 'VE', 'futures', 'restricted', 'unspecified', 'https://support.lucidtrading.com/en/articles/11404636-restricted-countries', '2026-09-18 00:00:00+00', 'Lucid no admite ciudadanos o residentes de Venezuela.'),
  ('fxify', 'NI', null, 'restricted', 'unspecified', 'https://fxify.com/faqs/all-faqs/what-countries-are-accepted/', '2026-09-18 00:00:00+00', 'Nicaragua figura entre los países no aceptados por FXIFY.'),
  ('fxify', 'VE', null, 'restricted', 'unspecified', 'https://fxify.com/faqs/all-faqs/what-countries-are-accepted/', '2026-09-18 00:00:00+00', 'Venezuela figura entre los países no aceptados por FXIFY.'),
  ('maven-trading', 'LC', null, 'restricted', 'unspecified', 'https://maventrading.com/', '2026-09-18 00:00:00+00', 'Santa Lucía figura en la lista oficial de países restringidos de Maven.'),
  ('maven-trading', 'VE', null, 'restricted', 'unspecified', 'https://maventrading.com/', '2026-09-18 00:00:00+00', 'Venezuela figura en la lista oficial de países restringidos de Maven.'),
  ('alpha-futures', 'VE', 'futures', 'restricted', 'unspecified', 'https://help.alpha-futures.com/en/articles/9523389-countries-with-limitations', '2026-09-18 00:00:00+00', 'Alpha Futures restringe Venezuela por ciudadanía/residencia y también impide operar físicamente desde allí.'),
  ('toponefutures', 'EC', 'futures', 'restricted', 'unspecified', 'https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions', '2026-09-18 00:00:00+00', 'Top One Futures restringe Ecuador por ciudadanía/residencia y también por ubicación física al operar.'),
  ('toponefutures', 'NI', 'futures', 'restricted', 'unspecified', 'https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions', '2026-09-18 00:00:00+00', 'Top One Futures restringe Nicaragua por ciudadanía/residencia y también por ubicación física al operar.'),
  ('toponefutures', 'PA', 'futures', 'restricted', 'unspecified', 'https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions', '2026-09-18 00:00:00+00', 'Top One Futures restringe Panamá por ciudadanía/residencia y también por ubicación física al operar.'),
  ('toponefutures', 'VE', 'futures', 'restricted', 'unspecified', 'https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions', '2026-09-18 00:00:00+00', 'Top One Futures restringe Venezuela por ciudadanía/residencia y también por ubicación física al operar.'),
  ('ftmo', 'AG', null, 'restricted', 'unspecified', 'https://ftmo.com/en/faq/who-can-join-ftmo/', '2026-09-18 00:00:00+00', 'FTMO incluye Antigua y Barbuda entre los países a cuyos clientes no presta servicios.'),
  ('ftmo', 'BZ', null, 'restricted', 'unspecified', 'https://ftmo.com/en/faq/who-can-join-ftmo/', '2026-09-18 00:00:00+00', 'FTMO incluye Belice entre los países a cuyos clientes no presta servicios.'),
  ('ftmo', 'CU', null, 'restricted', 'unspecified', 'https://ftmo.com/en/faq/who-can-join-ftmo/', '2026-09-18 00:00:00+00', 'FTMO incluye Cuba entre los países a cuyos clientes no presta servicios.'),
  ('ftmo', 'DM', null, 'restricted', 'unspecified', 'https://ftmo.com/en/faq/who-can-join-ftmo/', '2026-09-18 00:00:00+00', 'FTMO incluye Dominica entre los países a cuyos clientes no presta servicios.'),
  ('ftmo', 'GD', null, 'restricted', 'unspecified', 'https://ftmo.com/en/faq/who-can-join-ftmo/', '2026-09-18 00:00:00+00', 'FTMO incluye Granada entre los países a cuyos clientes no presta servicios.'),
  ('ftmo', 'KN', null, 'restricted', 'unspecified', 'https://ftmo.com/en/faq/who-can-join-ftmo/', '2026-09-18 00:00:00+00', 'FTMO incluye San Cristóbal y Nieves entre los países a cuyos clientes no presta servicios.'),
  ('ftmo', 'VC', null, 'restricted', 'unspecified', 'https://ftmo.com/en/faq/who-can-join-ftmo/', '2026-09-18 00:00:00+00', 'FTMO incluye San Vicente y las Granadinas entre los países a cuyos clientes no presta servicios.'),
  ('ftmo', 'SR', null, 'restricted', 'unspecified', 'https://ftmo.com/en/faq/who-can-join-ftmo/', '2026-09-18 00:00:00+00', 'FTMO incluye Surinam entre los países a cuyos clientes no presta servicios.'),
  ('fundednext', 'AG', 'cfd', 'restricted', 'unspecified', 'https://help.fundednext.com/en/articles/8020080-are-any-countries-restricted-on-fundednext-cfds', '2026-09-18 00:00:00+00', 'FundedNext CFD no admite residentes o ciudadanos de Antigua y Barbuda.'),
  ('fundednext', 'BZ', 'cfd', 'restricted', 'unspecified', 'https://help.fundednext.com/en/articles/8020080-are-any-countries-restricted-on-fundednext-cfds', '2026-09-18 00:00:00+00', 'FundedNext CFD no admite residentes o ciudadanos de Belice.'),
  ('fundednext', 'GD', 'cfd', 'restricted', 'unspecified', 'https://help.fundednext.com/en/articles/8020080-are-any-countries-restricted-on-fundednext-cfds', '2026-09-18 00:00:00+00', 'FundedNext CFD no admite residentes o ciudadanos de Granada.'),
  ('fundednextfutures', 'AG', 'futures', 'restricted', 'residence', 'https://helpfutures.fundednext.com/en/articles/14274473-are-any-countries-restricted-on-fundednext-futures', '2026-09-18 00:00:00+00', 'Los residentes de Antigua y Barbuda no pueden comprar cuentas de FundedNext Futures.'),
  ('fundednextfutures', 'BZ', 'futures', 'restricted', 'residence', 'https://helpfutures.fundednext.com/en/articles/14274473-are-any-countries-restricted-on-fundednext-futures', '2026-09-18 00:00:00+00', 'Los residentes de Belice no pueden comprar cuentas de FundedNext Futures.'),
  ('fundednextfutures', 'CU', 'futures', 'restricted', 'residence', 'https://helpfutures.fundednext.com/en/articles/14274473-are-any-countries-restricted-on-fundednext-futures', '2026-09-18 00:00:00+00', 'Los residentes de Cuba no pueden comprar cuentas de FundedNext Futures.'),
  ('fundednextfutures', 'GD', 'futures', 'restricted', 'residence', 'https://helpfutures.fundednext.com/en/articles/14274473-are-any-countries-restricted-on-fundednext-futures', '2026-09-18 00:00:00+00', 'Los residentes de Granada no pueden comprar cuentas de FundedNext Futures.'),
  ('tradeify', 'BS', null, 'restricted', 'residence', 'https://help.tradeify.co/en/articles/10495888-rules-restricted-countries', '2026-09-18 00:00:00+00', 'Tradeify restringe el acceso a residentes permanentes de Bahamas.'),
  ('tradeify', 'BB', null, 'restricted', 'residence', 'https://help.tradeify.co/en/articles/10495888-rules-restricted-countries', '2026-09-18 00:00:00+00', 'Tradeify restringe el acceso a residentes permanentes de Barbados.'),
  ('tradeify', 'CU', null, 'restricted', 'residence', 'https://help.tradeify.co/en/articles/10495888-rules-restricted-countries', '2026-09-18 00:00:00+00', 'Tradeify restringe el acceso a residentes permanentes de Cuba.'),
  ('tradeify', 'JM', null, 'restricted', 'residence', 'https://help.tradeify.co/en/articles/10495888-rules-restricted-countries', '2026-09-18 00:00:00+00', 'Tradeify restringe el acceso a residentes permanentes de Jamaica.'),
  ('tradeify', 'TT', null, 'restricted', 'residence', 'https://help.tradeify.co/en/articles/10495888-rules-restricted-countries', '2026-09-18 00:00:00+00', 'Tradeify restringe el acceso a residentes permanentes de Trinidad y Tobago.'),
  ('myfundedfutures', 'BS', null, 'restricted', 'unspecified', 'https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy', '2026-09-18 00:00:00+00', 'Bahamas figura en la lista oficial de países restringidos de My Funded Futures.'),
  ('myfundedfutures', 'BB', null, 'restricted', 'unspecified', 'https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy', '2026-09-18 00:00:00+00', 'Barbados figura en la lista oficial de países restringidos de My Funded Futures.'),
  ('myfundedfutures', 'CU', null, 'restricted', 'unspecified', 'https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy', '2026-09-18 00:00:00+00', 'Cuba figura en la lista oficial de países restringidos de My Funded Futures.'),
  ('myfundedfutures', 'GY', null, 'restricted', 'unspecified', 'https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy', '2026-09-18 00:00:00+00', 'Guyana figura en la lista oficial de países restringidos de My Funded Futures.'),
  ('myfundedfutures', 'HT', null, 'restricted', 'unspecified', 'https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy', '2026-09-18 00:00:00+00', 'Haití figura en la lista oficial de países restringidos de My Funded Futures.'),
  ('myfundedfutures', 'JM', null, 'restricted', 'unspecified', 'https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy', '2026-09-18 00:00:00+00', 'Jamaica figura en la lista oficial de países restringidos de My Funded Futures.'),
  ('myfundedfutures', 'TT', null, 'restricted', 'unspecified', 'https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy', '2026-09-18 00:00:00+00', 'Trinidad y Tobago figura en la lista oficial de países restringidos de My Funded Futures.'),
  ('the5ers', 'CU', null, 'restricted', 'residence', 'https://the5ers.com/terms-and-conditions/', '2026-09-18 00:00:00+00', 'La elegibilidad de The5ers excluye a residentes de Cuba.'),
  ('alpha-capital-group', 'CU', null, 'restricted', 'unspecified', 'https://help.alphacapitalgroup.uk/en/articles/8775575-countries-with-limitations', '2026-09-18 00:00:00+00', 'Alpha Capital Group no presta servicios a nacionales o residentes de Cuba.'),
  ('e8markets', 'CU', 'cfd', 'restricted', 'unspecified', 'https://help.e8markets.com/en/articles/5514278-accepted-countries', '2026-09-18 00:00:00+00', 'Cuba figura en la lista restringida de E8 Classic Markets.'),
  ('e8markets', 'CU', 'crypto', 'restricted', 'unspecified', 'https://help.e8markets.com/en/articles/5514278-accepted-countries', '2026-09-18 00:00:00+00', 'Cuba figura en la lista restringida de E8 Perpetuals.'),
  ('e8markets', 'BS', 'futures', 'restricted', 'unspecified', 'https://help.e8markets.com/en/articles/5514278-accepted-countries', '2026-09-18 00:00:00+00', 'Bahamas figura en la lista restringida de E8 Futures.'),
  ('e8markets', 'BB', 'futures', 'restricted', 'unspecified', 'https://help.e8markets.com/en/articles/5514278-accepted-countries', '2026-09-18 00:00:00+00', 'Barbados figura en la lista restringida de E8 Futures.'),
  ('e8markets', 'CU', 'futures', 'restricted', 'unspecified', 'https://help.e8markets.com/en/articles/5514278-accepted-countries', '2026-09-18 00:00:00+00', 'Cuba figura en la lista restringida de E8 Futures.'),
  ('e8markets', 'HT', 'futures', 'restricted', 'unspecified', 'https://help.e8markets.com/en/articles/5514278-accepted-countries', '2026-09-18 00:00:00+00', 'Haití figura en la lista restringida de E8 Futures.'),
  ('e8markets', 'JM', 'futures', 'restricted', 'unspecified', 'https://help.e8markets.com/en/articles/5514278-accepted-countries', '2026-09-18 00:00:00+00', 'Jamaica figura en la lista restringida de E8 Futures.'),
  ('e8markets', 'TT', 'futures', 'restricted', 'unspecified', 'https://help.e8markets.com/en/articles/5514278-accepted-countries', '2026-09-18 00:00:00+00', 'Trinidad y Tobago figura en la lista restringida de E8 Futures.'),
  ('lucid-trading', 'BS', 'futures', 'restricted', 'unspecified', 'https://support.lucidtrading.com/en/articles/11404636-restricted-countries', '2026-09-18 00:00:00+00', 'Lucid no admite ciudadanos o residentes de Bahamas.'),
  ('lucid-trading', 'BB', 'futures', 'restricted', 'unspecified', 'https://support.lucidtrading.com/en/articles/11404636-restricted-countries', '2026-09-18 00:00:00+00', 'Lucid no admite ciudadanos o residentes de Barbados.'),
  ('lucid-trading', 'BZ', 'futures', 'restricted', 'unspecified', 'https://support.lucidtrading.com/en/articles/11404636-restricted-countries', '2026-09-18 00:00:00+00', 'Lucid no admite ciudadanos o residentes de Belice.'),
  ('lucid-trading', 'CU', 'futures', 'restricted', 'unspecified', 'https://support.lucidtrading.com/en/articles/11404636-restricted-countries', '2026-09-18 00:00:00+00', 'Lucid no admite ciudadanos o residentes de Cuba.'),
  ('lucid-trading', 'HT', 'futures', 'restricted', 'unspecified', 'https://support.lucidtrading.com/en/articles/11404636-restricted-countries', '2026-09-18 00:00:00+00', 'Lucid no admite ciudadanos o residentes de Haití.'),
  ('lucid-trading', 'JM', 'futures', 'restricted', 'unspecified', 'https://support.lucidtrading.com/en/articles/11404636-restricted-countries', '2026-09-18 00:00:00+00', 'Lucid no admite ciudadanos o residentes de Jamaica.'),
  ('lucid-trading', 'TT', 'futures', 'restricted', 'unspecified', 'https://support.lucidtrading.com/en/articles/11404636-restricted-countries', '2026-09-18 00:00:00+00', 'Lucid no admite ciudadanos o residentes de Trinidad y Tobago.'),
  ('fxify', 'CU', null, 'restricted', 'unspecified', 'https://fxify.com/faqs/all-faqs/what-countries-are-accepted/', '2026-09-18 00:00:00+00', 'Cuba figura entre los países no aceptados por FXIFY.'),
  ('fxify', 'HT', null, 'restricted', 'unspecified', 'https://fxify.com/faqs/all-faqs/what-countries-are-accepted/', '2026-09-18 00:00:00+00', 'Haití figura entre los países no aceptados por FXIFY.'),
  ('maven-trading', 'CU', null, 'restricted', 'unspecified', 'https://maventrading.com/', '2026-09-18 00:00:00+00', 'Cuba figura en la lista oficial de países restringidos de Maven.'),
  ('maven-trading', 'GY', null, 'restricted', 'unspecified', 'https://maventrading.com/', '2026-09-18 00:00:00+00', 'Guyana figura en la lista oficial de países restringidos de Maven.'),
  ('maven-trading', 'HT', null, 'restricted', 'unspecified', 'https://maventrading.com/', '2026-09-18 00:00:00+00', 'Haití figura en la lista oficial de países restringidos de Maven.'),
  ('brightfunded', 'CU', null, 'restricted', 'unspecified', 'https://help.brightfunded.com/en/articles/9286630-what-countries-are-restricted-at-brightfunded', '2026-09-18 00:00:00+00', 'BrightFunded no permite comprar Challenges o registrarse a residentes o nacionales de Cuba.'),
  ('alpha-futures', 'CU', 'futures', 'restricted', 'unspecified', 'https://help.alpha-futures.com/en/articles/9523389-countries-with-limitations', '2026-09-18 00:00:00+00', 'Alpha Futures restringe Cuba por ciudadanía/residencia y también impide operar físicamente desde allí.'),
  ('alpha-futures', 'HT', 'futures', 'restricted', 'unspecified', 'https://help.alpha-futures.com/en/articles/9523389-countries-with-limitations', '2026-09-18 00:00:00+00', 'Alpha Futures restringe Haití por ciudadanía/residencia y también impide operar físicamente desde allí.'),
  ('alpha-futures', 'JM', 'futures', 'restricted', 'unspecified', 'https://help.alpha-futures.com/en/articles/9523389-countries-with-limitations', '2026-09-18 00:00:00+00', 'Alpha Futures restringe Jamaica por ciudadanía/residencia y también impide operar físicamente desde allí.'),
  ('toponefutures', 'BS', 'futures', 'restricted', 'unspecified', 'https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions', '2026-09-18 00:00:00+00', 'Top One Futures restringe Bahamas por ciudadanía/residencia y también por ubicación física al operar.'),
  ('toponefutures', 'BB', 'futures', 'restricted', 'unspecified', 'https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions', '2026-09-18 00:00:00+00', 'Top One Futures restringe Barbados por ciudadanía/residencia y también por ubicación física al operar.'),
  ('toponefutures', 'CU', 'futures', 'restricted', 'unspecified', 'https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions', '2026-09-18 00:00:00+00', 'Top One Futures restringe Cuba por ciudadanía/residencia y también por ubicación física al operar.'),
  ('toponefutures', 'HT', 'futures', 'restricted', 'unspecified', 'https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions', '2026-09-18 00:00:00+00', 'Top One Futures restringe Haití por ciudadanía/residencia y también por ubicación física al operar.'),
  ('toponefutures', 'JM', 'futures', 'restricted', 'unspecified', 'https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions', '2026-09-18 00:00:00+00', 'Top One Futures restringe Jamaica por ciudadanía/residencia y también por ubicación física al operar.'),
  ('toponefutures', 'TT', 'futures', 'restricted', 'unspecified', 'https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions', '2026-09-18 00:00:00+00', 'Top One Futures restringe Trinidad y Tobago por ciudadanía/residencia y también por ubicación física al operar.');

do $$
declare
  missing_values text;
begin
  select string_agg(expected.platform_slug, ', ' order by expected.platform_slug)
    into missing_values
  from geography_batch_01_platforms expected
  left join public.platforms platform on platform.slug = expected.platform_slug
  where platform.id is null;

  if missing_values is not null then
    raise exception 'Firmas inexistentes: %', missing_values;
  end if;

  select string_agg(distinct batch.country_code, ', ' order by batch.country_code)
    into missing_values
  from geography_batch_01 batch
  left join public.countries country on country.code = batch.country_code
  where country.code is null;

  if missing_values is not null then
    raise exception 'Country codes inexistentes: %', missing_values;
  end if;

  select string_agg(batch.platform_slug || ':' || batch.market, ', ' order by batch.platform_slug || ':' || batch.market)
    into missing_values
  from geography_batch_01 batch
  join public.platforms platform on platform.slug = batch.platform_slug
  left join public.platform_markets platform_market
    on platform_market.platform_id = platform.id
   and platform_market.market = batch.market
  where batch.market is not null
    and platform_market.platform_id is null;

  if missing_values is not null then
    raise exception 'Mercados no asociados a la firma: %', missing_values;
  end if;

  if exists (
    select 1
    from geography_batch_01
    group by platform_slug, country_code, coalesce(market, '__general__')
    having count(*) > 1
  ) then
    raise exception 'El batch contiene reglas duplicadas';
  end if;

  if exists (
    select 1 from geography_batch_01
    where status not in ('available', 'restricted', 'unknown')
       or restriction_basis not in ('residence', 'nationality', 'physical_location', 'unspecified')
       or (status in ('available', 'restricted') and (nullif(btrim(source_url), '') is null or verified_at is null))
  ) then
    raise exception 'El batch contiene estados, criterios o evidencia inválidos';
  end if;

  if exists (
    select 1
    from geography_batch_01 batch
    join public.platforms platform on platform.slug = batch.platform_slug
    join public.platform_availability current_rule
      on current_rule.platform_id = platform.id
     and current_rule.country_code = batch.country_code
     and current_rule.market is not distinct from batch.market
    where current_rule.status::text is distinct from batch.status
       or current_rule.restriction_basis is distinct from batch.restriction_basis
       or current_rule.source_url is distinct from batch.source_url
  ) then
    select string_agg(
      batch.platform_slug || ':' || batch.country_code || ':' || coalesce(batch.market, 'general'),
      ', '
      order by batch.platform_slug, batch.country_code, batch.market
    )
      into missing_values
    from geography_batch_01 batch
    join public.platforms platform on platform.slug = batch.platform_slug
    join public.platform_availability current_rule
      on current_rule.platform_id = platform.id
     and current_rule.country_code = batch.country_code
     and current_rule.market is not distinct from batch.market
    where current_rule.status::text is distinct from batch.status
       or current_rule.restriction_basis is distinct from batch.restriction_basis
       or current_rule.source_url is distinct from batch.source_url;

    raise exception 'Conflictos con reglas existentes: %', missing_values;
  end if;
end $$;

-- Si la identidad, el estado, el criterio y la fuente coinciden, refrescar solo
-- la evidencia revisable. Una fuente diferente se bloquea en la validación anterior.
update public.platform_availability current_rule
set verified_at = batch.verified_at,
    rule_summary = batch.rule_summary
from geography_batch_01 batch
join public.platforms platform on platform.slug = batch.platform_slug
where current_rule.platform_id = platform.id
  and current_rule.country_code = batch.country_code
  and current_rule.market is not distinct from batch.market
  and current_rule.status::text = batch.status
  and current_rule.restriction_basis = batch.restriction_basis
  and current_rule.source_url = batch.source_url;

insert into public.platform_availability
  (platform_id, country_code, market, status, restriction_basis, source_url, verified_at, rule_summary)
select
  platform.id,
  batch.country_code,
  batch.market,
  batch.status::public.availability_status,
  batch.restriction_basis,
  batch.source_url,
  batch.verified_at,
  batch.rule_summary
from geography_batch_01 batch
join public.platforms platform on platform.slug = batch.platform_slug
where not exists (
  select 1
  from public.platform_availability current_rule
  where current_rule.platform_id = platform.id
    and current_rule.country_code = batch.country_code
    and current_rule.market is not distinct from batch.market
);

-- Guardas de integridad específicas del batch.
do $$
begin
  if (
    select count(*)
    from public.platform_availability availability
    join public.platforms platform on platform.id = availability.platform_id
    join geography_batch_01 batch
      on batch.platform_slug = platform.slug
     and batch.country_code = availability.country_code
     and availability.market is not distinct from batch.market
  ) <> (select count(*) from geography_batch_01) then
    raise exception 'La cantidad final de reglas no coincide con el batch';
  end if;

  if (
    select count(*)
    from public.platform_availability availability
    join public.platforms platform on platform.id = availability.platform_id
    where platform.slug = 'fundingpips'
      and availability.market is null
      and availability.country_code in ('AR', 'BR', 'CO', 'EC', 'GT')
  ) <> 5 or exists (
    select 1
    from public.platform_availability availability
    join public.platforms platform on platform.id = availability.platform_id
    where platform.slug = 'fundingpips'
      and availability.market is null
      and availability.country_code in ('AR', 'BR', 'CO', 'EC', 'GT')
      and (
        availability.status::text <> 'unknown'
        or availability.source_url is not null
        or availability.verified_at is not null
      )
  ) then
    raise exception 'Las filas legacy unknown de FundingPips fueron alteradas';
  end if;
end $$;

commit;
