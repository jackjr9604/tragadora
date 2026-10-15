-- PRECHECK 3E.8 Fase 3.1A — estrictamente de lectura.
-- Ejecutar completo en Supabase SQL Editor ANTES de la migración.

select current_database() database_name,current_user execution_role,version() postgres_version;

with required_table_columns(table_name,column_name,data_type) as (values
 ('translation_jobs','id','uuid'),('translation_jobs','resource_type','text'),('translation_jobs','resource_id','text'),
 ('translation_jobs','field_name','text'),('translation_jobs','source_language','text'),('translation_jobs','target_language','text'),
 ('translation_jobs','status','text'),('translation_jobs','requested_provider','text'),('translation_jobs','provider_used','text'),
 ('translation_jobs','priority','smallint'),('translation_jobs','attempt_count','integer'),('translation_jobs','max_attempts','integer'),
 ('translation_jobs','next_attempt_at','timestamp with time zone'),('translation_jobs','lease_expires_at','timestamp with time zone'),
 ('translation_jobs','started_at','timestamp with time zone'),('translation_jobs','completed_at','timestamp with time zone'),
 ('translation_jobs','error_code','text'),('translation_jobs','last_error','text'),('translation_jobs','created_at','timestamp with time zone'),
 ('translation_jobs','updated_at','timestamp with time zone'),('translation_jobs','estimated_cost_usd','numeric'),
 ('translation_resource_types','resource_type','text'),
 ('translation_resource_types','enabled','boolean')
), actual as (
 select c.table_name,c.column_name,c.data_type from information_schema.columns c where c.table_schema='public'
)
select r.*,a.data_type actual_type,(a.column_name is not null and a.data_type=r.data_type) compatible
from required_table_columns r left join actual a using(table_name,column_name)
order by r.table_name,r.column_name;

select resource_type,enabled from public.translation_resource_types order by resource_type;

select status,count(*) jobs,min(created_at) oldest,max(created_at) newest
from public.translation_jobs group by status order by status;

select requested_provider,provider_used,count(*) jobs
from public.translation_jobs group by requested_provider,provider_used order by requested_provider,provider_used;

select count(*) total_jobs,
 count(*) filter(where status in('queued','running','retry_wait')) active_jobs,
 count(*) filter(where status='running' and lease_expires_at<=now()) expired_leases,
 count(*) filter(where coalesce(estimated_cost_usd,0)<>0) nonzero_cost_jobs
from public.translation_jobs;

select c.relname table_name,c.relrowsecurity rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in('translation_jobs','translation_resource_types','translation_worker_instances');

select p.proname,pg_get_function_identity_arguments(p.oid) arguments,
 p.prosecdef security_definer,p.proconfig settings
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in(
 'translation_worker_heartbeat','translation_admin_jobs_inventory','translation_admin_jobs_summary',
 'translation_admin_worker_status','translation_admin_jobs_validate_filters'
) order by p.proname;

select indexname,indexdef from pg_indexes
where schemaname='public' and tablename='translation_jobs' order by indexname;

select rolname from pg_roles where rolname in('anon','authenticated','service_role') order by rolname;

-- Debe devolver cero filas. Una fila indica un bloqueo antes de aplicar.
with required_table_columns(table_name,column_name,data_type) as (values
 ('translation_jobs','id','uuid'),('translation_jobs','resource_type','text'),('translation_jobs','resource_id','text'),
 ('translation_jobs','field_name','text'),('translation_jobs','source_language','text'),('translation_jobs','target_language','text'),
 ('translation_jobs','status','text'),('translation_jobs','requested_provider','text'),('translation_jobs','provider_used','text'),
 ('translation_jobs','priority','smallint'),('translation_jobs','attempt_count','integer'),('translation_jobs','max_attempts','integer'),
 ('translation_jobs','next_attempt_at','timestamp with time zone'),('translation_jobs','lease_expires_at','timestamp with time zone'),
 ('translation_jobs','started_at','timestamp with time zone'),('translation_jobs','completed_at','timestamp with time zone'),
 ('translation_jobs','error_code','text'),('translation_jobs','last_error','text'),('translation_jobs','created_at','timestamp with time zone'),
 ('translation_jobs','updated_at','timestamp with time zone'),('translation_jobs','estimated_cost_usd','numeric'),
 ('translation_resource_types','resource_type','text'),
 ('translation_resource_types','enabled','boolean')
)
select r.* from required_table_columns r left join information_schema.columns c
 on c.table_schema='public' and c.table_name=r.table_name and c.column_name=r.column_name and c.data_type=r.data_type
where c.column_name is null;
