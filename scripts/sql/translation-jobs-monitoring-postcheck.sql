-- POSTCHECK 3E.8 Fase 3.1A — sin INSERT, UPDATE ni DELETE.
-- Ejecutar completo en Supabase SQL Editor DESPUÉS de la migración.

select c.relname table_name,c.relrowsecurity rls_enabled,
 has_table_privilege('anon','public.translation_worker_instances','SELECT') anon_select,
 has_table_privilege('authenticated','public.translation_worker_instances','SELECT') authenticated_select,
 has_table_privilege('service_role','public.translation_worker_instances','SELECT') service_role_select
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='translation_worker_instances';

select column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='translation_worker_instances'
order by ordinal_position;

select p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef security_definer,p.proconfig settings,
 has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') service_role_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in(
 'translation_worker_heartbeat','translation_admin_jobs_inventory','translation_admin_jobs_summary',
 'translation_admin_worker_status','translation_admin_jobs_validate_filters'
) order by p.proname;

select indexname,indexdef from pg_indexes where schemaname='public'
and indexname in(
 'translation_worker_instances_last_seen_idx','translation_jobs_created_admin_idx',
 'translation_jobs_status_created_admin_idx','translation_jobs_resource_status_created_admin_idx',
 'translation_jobs_resource_identity_created_admin_idx','translation_jobs_language_status_created_admin_idx',
 'translation_jobs_source_language_status_created_admin_idx','translation_jobs_error_created_admin_idx',
 'translation_jobs_requested_provider_created_admin_idx','translation_jobs_provider_used_created_admin_idx'
) order by indexname;

-- Las RPC exigen auth.role()=service_role. Este ajuste solo afecta la transacción
-- del SQL Editor y se revierte; no modifica tablas ni configuración persistente.
begin;
select set_config('request.jwt.claim.role','service_role',true);

select * from public.translation_admin_jobs_summary(
 array(select resource_type from public.translation_resource_types where enabled order by resource_type)
);

select id,resource_type,resource_id,field_name,source_language,target_language,status,
 requested_provider,provider_used,attempt_count,max_attempts,error_code,created_at,total_count
from public.translation_admin_jobs_inventory(
 array(select resource_type from public.translation_resource_types where enabled order by resource_type),
 p_sort=>'created_desc',p_page=>1,p_page_size=>5
);

select * from public.translation_admin_worker_status(120);
rollback;

-- Inicialmente debe ser 0 hasta que una versión posterior del worker envíe heartbeat.
select count(*) worker_instance_rows from public.translation_worker_instances;

-- Debe devolver cero filas: detecta permisos o search_path inseguros.
select p.proname,pg_get_function_identity_arguments(p.oid) arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in(
 'translation_worker_heartbeat','translation_admin_jobs_inventory','translation_admin_jobs_summary',
 'translation_admin_worker_status','translation_admin_jobs_validate_filters'
) and (
 not p.prosecdef
 or not coalesce(p.proconfig,'{}'::text[])@>array['search_path=pg_catalog, public']
 or has_function_privilege('anon',p.oid,'EXECUTE')
 or has_function_privilege('authenticated',p.oid,'EXECUTE')
 or (p.proname<>'translation_admin_jobs_validate_filters' and not has_function_privilege('service_role',p.oid,'EXECUTE'))
);
