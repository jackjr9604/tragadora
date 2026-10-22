-- POSTCHECK READ-ONLY para 202610210001_affiliate_click_abuse_protection.sql.
-- Puede ejecutarse en Supabase SQL Editor después de aplicar la migración.
-- No inserta, actualiza ni elimina datos.

select
  to_regclass('public.affiliate_click_throttles') is not null as throttles_table_exists,
  to_regclass('public.affiliate_click_deduplication') is not null as deduplication_table_exists,
  to_regprocedure('public.affiliate_record_click(uuid,text,text,text,text)') is not null as rpc_exists;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as anon_has_data_privileges,
  has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as authenticated_has_data_privileges,
  has_table_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as service_role_has_data_privileges
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('affiliate_click_throttles', 'affiliate_click_deduplication')
order by c.relname;

select
  p.prosecdef as security_definer,
  p.proconfig @> array['search_path=pg_catalog, public']::text[] as search_path_correct,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.oid = to_regprocedure('public.affiliate_record_click(uuid,text,text,text,text)');

select
  has_table_privilege('anon', 'public.affiliate_clicks', 'INSERT') as anon_direct_insert,
  has_table_privilege('authenticated', 'public.affiliate_clicks', 'INSERT') as authenticated_direct_insert,
  has_table_privilege('service_role', 'public.affiliate_clicks', 'INSERT') as service_role_direct_insert,
  has_table_privilege('service_role', 'public.affiliate_clicks', 'SELECT') as service_role_select;

select indexname, indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
  and indexname in (
    'affiliate_click_throttles_pkey',
    'affiliate_click_throttles_last_seen_idx',
    'affiliate_click_deduplication_pkey',
    'affiliate_click_deduplication_last_seen_idx'
  )
order by indexname;

select
  conrelid::regclass::text as table_name,
  conname,
  pg_catalog.pg_get_constraintdef(oid) as definition
from pg_catalog.pg_constraint
where conrelid in (
  'public.affiliate_click_throttles'::regclass,
  'public.affiliate_click_deduplication'::regclass
)
order by table_name, conname;

select
  (select count(*) from public.affiliate_click_throttles) as throttle_control_rows,
  (select count(*) from public.affiliate_click_deduplication) as deduplication_control_rows;
