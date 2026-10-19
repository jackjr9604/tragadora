\set ON_ERROR_STOP on

-- POSTCHECK de solo lectura para 202610180002.
select
  p.oid::regprocedure::text as signature,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.oid=to_regprocedure('public.translation_publish_draft(uuid,bigint)');

select
  has_function_privilege('anon','public.translation_publish_draft(uuid,bigint)','EXECUTE') as anon_execute,
  has_function_privilege('authenticated','public.translation_publish_draft(uuid,bigint)','EXECUTE') as authenticated_execute,
  has_function_privilege('service_role','public.translation_publish_draft(uuid,bigint)','EXECUTE') as service_role_execute;

select
  position('translation_assert_admin_permission' in definition)>0 as checks_module_permission,
  position('translation_editor_assert_version' in definition)>0 as checks_lock_version,
  position('translation_editor_assert_source' in definition)>0 as checks_current_source,
  position('translation_write_value' in definition)>0 as writes_through_registered_adapter,
  position('translation.publish' in definition)>0 as records_audit
from (select pg_get_functiondef(to_regprocedure('public.translation_publish_draft(uuid,bigint)')) as definition) f;

-- La migración 3E.2 preservó la visibilidad previa de traducciones importadas
-- protegidas y vigentes. No fueron aprobadas por el workflow nuevo y deben
-- revisarse editorialmente, pero no son una violación de integridad.
select
  count(*) filter(where status='reviewed') as reviewed_publications,
  count(*) filter(where status='machine_translated') as legacy_machine_publications,
  count(*) filter(where status='imported_unreviewed' and is_protected
    and translated_source_hash=source_hash and translated_revision=source_revision)
    as historical_imports_pending_review,
  count(*) filter(where
    translated_source_hash is distinct from source_hash
    or translated_revision is distinct from source_revision
    or not (
      status in ('reviewed','machine_translated')
      or (status='imported_unreviewed' and is_protected)
    )
  ) as true_integrity_violations
from public.translation_field_state
where publication_status='published';
