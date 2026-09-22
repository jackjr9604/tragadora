begin;

-- Marca exclusivamente las reglas del Batch 01 cuya fuente oficial se presenta
-- como lista completa de países aceptados/restringidos. No crea filas available.
with reviewed_source(slug, market, source_url) as (
  values
    ('ftmo', null::text, 'https://ftmo.com/en/faq/who-can-join-ftmo/'),
    ('fundednext', 'cfd', 'https://help.fundednext.com/en/articles/8020080-are-any-countries-restricted-on-fundednext-cfds'),
    ('fundednextfutures', 'futures', 'https://helpfutures.fundednext.com/en/articles/14274473-are-any-countries-restricted-on-fundednext-futures'),
    ('fundingpips', null, 'https://help.fundingpips.com/hc/en-us/articles/44390730743825-Get-Started'),
    ('tradeify', null, 'https://help.tradeify.co/en/articles/10495888-rules-restricted-countries'),
    ('myfundedfutures', null, 'https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy'),
    ('the5ers', null, 'https://the5ers.com/terms-and-conditions/'),
    ('alpha-capital-group', null, 'https://help.alphacapitalgroup.uk/en/articles/8775575-countries-with-limitations'),
    ('e8markets', 'cfd', 'https://help.e8markets.com/en/articles/5514278-accepted-countries'),
    ('e8markets', 'crypto', 'https://help.e8markets.com/en/articles/5514278-accepted-countries'),
    ('e8markets', 'futures', 'https://help.e8markets.com/en/articles/5514278-accepted-countries'),
    ('lucid-trading', 'futures', 'https://support.lucidtrading.com/en/articles/11404636-restricted-countries'),
    ('fxify', null, 'https://fxify.com/faqs/all-faqs/what-countries-are-accepted/'),
    ('maven-trading', null, 'https://maventrading.com/'),
    ('brightfunded', null, 'https://help.brightfunded.com/en/articles/9286630-what-countries-are-restricted-at-brightfunded'),
    ('alpha-futures', 'futures', 'https://help.alpha-futures.com/en/articles/9523389-countries-with-limitations'),
    ('toponefutures', 'futures', 'https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions')
), targets as (
  select p.id as platform_id, r.market, r.source_url
  from reviewed_source r
  join public.platforms p on p.slug = r.slug
)
update public.platform_availability pa
set restriction_list_complete = true
from targets t
where pa.platform_id = t.platform_id
  and pa.market is not distinct from t.market
  and pa.source_url = t.source_url
  and pa.status = 'restricted';

commit;
