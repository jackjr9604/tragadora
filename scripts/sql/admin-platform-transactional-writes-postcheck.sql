-- READ ONLY. Ejecutar después de 202610240001 en Supabase SQL Editor.
begin transaction read only;

with rpc(name, signature) as (values
  ('admin_save_prop_firm','public.admin_save_prop_firm(uuid,timestamptz,text,text,text,text,uuid,public.platform_status,numeric,text,text,date,text,integer,boolean,numeric,numeric,boolean,boolean,boolean,boolean,boolean,boolean,text,text,text,text[],uuid[],uuid[],uuid[],boolean[],boolean[])'),
  ('admin_save_broker','public.admin_save_broker(uuid,timestamptz,text,text,text,text,uuid,public.platform_status,text,integer,numeric,text,text,text,boolean,integer,text[],uuid[])'),
  ('admin_save_exchange','public.admin_save_exchange(uuid,timestamptz,text,text,text,text,uuid,public.platform_status,text,integer,text,text,boolean,text,text,boolean,integer)'),
  ('admin_delete_platform','public.admin_delete_platform(uuid,public.platform_type,text,timestamptz)')
)
select name, to_regprocedure(signature) is not null as exists,
  coalesce((select prosecdef from pg_proc where oid=to_regprocedure(signature)),false) as security_definer,
  coalesce((select proconfig @> array['search_path=pg_catalog, public'] from pg_proc where oid=to_regprocedure(signature)),false) as safe_search_path,
  has_function_privilege('authenticated',signature,'EXECUTE') as authenticated_execute,
  has_function_privilege('anon',signature,'EXECUTE') as anon_execute,
  has_function_privilege('service_role',signature,'EXECUTE') as service_role_execute
from rpc;

select count(*) as translation_jobs_total from public.translation_jobs;
rollback;
