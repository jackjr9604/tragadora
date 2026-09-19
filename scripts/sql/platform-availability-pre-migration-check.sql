-- SOLO LECTURA. Revisar todos los resultados antes de aplicar 202609180001.
select current_setting('server_version') as postgres_version,
       current_setting('server_version_num') as postgres_version_num;

select platform_id, country_code, count(*) as duplicate_count
from public.platform_availability
group by platform_id, country_code
having count(*) > 1;

select a.id, a.platform_id, a.country_code
from public.platform_availability a
left join public.platforms p on p.id = a.platform_id
left join public.countries c on c.code = a.country_code
where p.id is null or c.code is null;

select a.id, a.country_code, a.status
from public.platform_availability a
join public.platforms p on p.id = a.platform_id
where p.slug = 'fundingpips'
order by a.country_code;

select status, count(*) as rows
from public.platform_availability
group by status order by status;

select platform_id, market, count(*) as rows
from public.platform_markets
group by platform_id, market
order by platform_id, market;

select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.platform_availability'::regclass, 'public.platform_markets'::regclass)
order by conrelid::regclass::text, conname;
