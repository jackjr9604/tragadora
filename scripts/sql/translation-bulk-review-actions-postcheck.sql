\set ON_ERROR_STOP on

-- POSTCHECK READ-ONLY para 202610180001_translation_bulk_review_actions.sql.
-- No crea, modifica ni elimina datos.

select
  p.oid::regprocedure::text as signature,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.oid in (
    to_regprocedure('public.translation_approve_draft(uuid,bigint)'),
    to_regprocedure('public.translation_reject_draft(uuid,bigint,text)')
  )
order by signature;

select
  routine,
  has_function_privilege('anon',routine,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',routine,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',routine,'EXECUTE') as service_role_execute
from (values
  ('public.translation_approve_draft(uuid,bigint)'),
  ('public.translation_reject_draft(uuid,bigint,text)')
) as functions(routine);

select
  -- Puede ser mayor que cero: un borrador nuevo puede coexistir con una
  -- versión anterior ya publicada. Estas RPC no cambian publication_status.
  count(*) filter(where workflow_status='approved' and publication_status='published') as approved_draft_with_prior_publication,
  count(*) filter(where workflow_status in ('in_review','approved') and (
    draft_value is null
    or draft_source_hash is distinct from source_hash
    or draft_source_revision is distinct from source_revision
  )) as invalid_editorial_versions
from public.translation_field_state;

select
  position('translation_write_value' in pg_get_functiondef(to_regprocedure('public.translation_approve_draft(uuid,bigint)'))) = 0
    as approve_does_not_write_public_value,
  position('translation_write_value' in pg_get_functiondef(to_regprocedure('public.translation_reject_draft(uuid,bigint,text)'))) = 0
    as reject_does_not_write_public_value,
  position('translation_assert_admin_permission' in pg_get_functiondef(to_regprocedure('public.translation_reject_draft(uuid,bigint,text)'))) > 0
    as reject_checks_module_permission,
  position('translation_editor_assert_version' in pg_get_functiondef(to_regprocedure('public.translation_reject_draft(uuid,bigint,text)'))) > 0
    as reject_checks_lock_version,
  position('translation_editor_assert_source' in pg_get_functiondef(to_regprocedure('public.translation_reject_draft(uuid,bigint,text)'))) > 0
    as reject_checks_source;
