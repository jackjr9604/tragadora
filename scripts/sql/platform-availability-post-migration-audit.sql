-- SOLO LECTURA. Ejecutar únicamente después de aplicar 202609180001.
select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'platform_availability'
order by ordinal_position;

select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.platform_availability'::regclass
order by conname;

select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'platform_availability'
order by indexname;

select relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class where oid = 'public.platform_availability'::regclass;

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'platform_availability'
order by policyname;

select a.id, a.country_code, a.status, a.market, a.source_url,
       a.verified_at, a.rule_summary, a.restriction_basis
from public.platform_availability a
join public.platforms p on p.id = a.platform_id
where p.slug = 'fundingpips'
order by a.country_code, a.market nulls first;

select status, count(*) as rows
from public.platform_availability
group by status order by status;
