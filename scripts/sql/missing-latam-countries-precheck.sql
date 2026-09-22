-- Read-only. Ejecutar antes de 20260918_missing_latam_countries.sql.

select distinct region
from public.countries
order by region;

select code, name, region, flag
from public.countries
where code in (
  'MX', 'GT', 'HN', 'SV', 'NI', 'CR', 'PA', 'CO', 'VE', 'BR', 'DO',
  'PR', 'AW', 'CW',
  'AG', 'BS', 'BB', 'BZ', 'CU', 'DM', 'GD', 'GY', 'HT', 'JM', 'KN', 'VC', 'SR', 'TT'
)
order by code;

select code, count(*) as row_count
from public.countries
group by code
having count(*) > 1
order by code;

select region, count(*) as countries, count(flag) as flags_populated
from public.countries
group by region
order by region;
