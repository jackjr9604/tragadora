-- READ ONLY. Ejecutar antes de 202610240001 en Supabase SQL Editor.
begin transaction read only;

select required.object_name, to_regclass(required.object_name) is not null as exists
from (values
  ('public.platforms'), ('public.platform_translations'), ('public.prop_firm_details'),
  ('public.broker_details'), ('public.exchange_details'), ('public.platform_markets'),
  ('public.platform_trading_platforms'), ('public.platform_instruments'),
  ('public.platform_transaction_methods'), ('public.admin_audit_log')
) required(object_name);

select to_regprocedure('public.has_admin_permission(text)') is not null as permission_helper_exists;

select routine_name
from information_schema.routines
where routine_schema='public' and routine_name in (
  'admin_save_prop_firm','admin_save_broker','admin_save_exchange','admin_delete_platform'
);

rollback;
