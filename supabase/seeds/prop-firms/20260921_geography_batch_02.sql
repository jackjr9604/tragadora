begin;

-- Batch 02: fuentes oficiales verificadas el 2026-09-21.
-- Solo usa países soberanos presentes en public.countries; territorios/regiones
-- se conservan en la documentación de investigación, no se convierten en países.
create temporary table geography_batch_02 (
  slug text not null,
  market text,
  source_url text not null,
  restriction_list_complete boolean not null,
  country_codes text[] not null
) on commit drop;

insert into geography_batch_02 values
  ('alpha-trader-firm', null, 'https://faq.alphafunded.com/en/articles/9568285-restricted-countries', true,
    array['CU','TT']),
  ('atmosfunded', null, 'https://atmosfunded.com/wp-content/uploads/2025/06/ATMOS-Customer-Agreement-and-Risk-Management-Policy-v7.pdf', false,
    array['CU','HT','NI','AE','US','VE']),
  ('blue-guardian', 'cfd', 'https://help.blueguardian.com/en/articles/15618204-general-information-rules', true,
    array['CU']),
  ('blueberryfunded', 'cfd', 'https://help.blueberryfunded.com/en/articles/9550574-are-any-countries-restricted-from-purchasing-an-evaluation', true,
    array['CU','US']),
  ('fintokei', 'cfd', 'https://support.fintokei.com/en/articles/6538820-who-can-join-fintokei', true,
    array['CU','US','VE','AE']),
  ('for-traders', null, 'https://help.fortraders.com/en/articles/9259446-list-of-restricted-countries', true,
    array['CU','AE']),
  ('funded-trading-plus', 'cfd', 'https://help.fundedtradingplus.com/prohibited-countries/', true,
    array['CU','VU']),
  ('fundingtraders', 'cfd', 'https://fundingtraders.com/help/en/articles/10505376-are-there-any-restricted-countries-for-fundingtraders-services', true,
    array['VE']),
  ('futureselite', 'futures', 'https://faq.futureselite.com/en/articles/12302907-countries-we-do-not-provide-services-for', true,
    array['BS','BB','BZ','CU','EC','HT','JM','MU','NI','PA','TT','VE']),
  ('goatfundedfutures', 'futures', 'https://help.goatfundedfutures.com/en/articles/14094470-which-countries-are-restricted', true,
    array['CL','CU','HK','PA','VE']);

do $$
begin
  if exists (
    select 1 from geography_batch_02 b
    left join public.platforms p on p.slug = b.slug
    where p.id is null
  ) then raise exception 'Batch 02 contiene una firma inexistente'; end if;

  if exists (
    select 1 from geography_batch_02 b
    cross join unnest(b.country_codes) code
    left join public.countries c on c.code = code
    where c.code is null
  ) then raise exception 'Batch 02 contiene un country_code inexistente'; end if;
end $$;

with proposed as (
  select p.id platform_id, code country_code, b.market, b.source_url,
    b.restriction_list_complete
  from geography_batch_02 b
  join public.platforms p on p.slug = b.slug
  cross join unnest(b.country_codes) code
)
insert into public.platform_availability (
  platform_id, country_code, market, status, restriction_basis,
  source_url, verified_at, rule_summary, restriction_list_complete
)
select platform_id, country_code, market, 'restricted', 'unspecified', source_url,
  '2026-09-21T00:00:00Z'::timestamptz,
  'El país figura en la lista oficial de jurisdicciones restringidas de la firma.',
  restriction_list_complete
from proposed p
where not exists (
  select 1 from public.platform_availability current
  where current.platform_id = p.platform_id
    and current.country_code = p.country_code
    and current.market is not distinct from p.market
)
on conflict do nothing;

-- Una reejecución solo eleva la señal editorial cuando la misma fuente oficial
-- sigue respaldando la misma regla; nunca sobrescribe otra evidencia.
with reviewed as (
  select p.id platform_id, b.market, b.source_url, b.restriction_list_complete
  from geography_batch_02 b join public.platforms p on p.slug = b.slug
)
update public.platform_availability pa
set restriction_list_complete = r.restriction_list_complete
from reviewed r
where pa.platform_id = r.platform_id
  and pa.market is not distinct from r.market
  and pa.source_url = r.source_url
  and pa.status = 'restricted';

commit;
