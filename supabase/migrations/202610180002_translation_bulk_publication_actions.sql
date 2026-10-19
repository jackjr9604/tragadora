begin;

-- Conserva la transición individual como única vía de publicación. La acción
-- masiva la invoca por elemento y obtiene concurrencia, permisos y atomicidad
-- independientes para permitir resultados parciales seguros.
create or replace function public.translation_publish_draft(
  p_state_id uuid,
  p_expected_lock_version bigint
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  state_row public.translation_field_state%rowtype;
  next_lock_version bigint;
begin
  select * into state_row
  from public.translation_field_state
  where id = p_state_id
  for update;
  if not found then raise exception 'Estado no encontrado' using errcode = 'P0002'; end if;

  perform public.translation_assert_admin_permission(state_row.resource_type);
  perform public.translation_editor_assert_version(state_row, p_expected_lock_version);
  perform public.translation_editor_assert_source(state_row);
  if state_row.workflow_status <> 'approved' or state_row.draft_value is null then
    raise exception 'El borrador no está aprobado' using errcode = '22023';
  end if;
  if state_row.publication_status <> 'unpublished' then
    raise exception 'La traducción ya está publicada' using errcode = '22023';
  end if;
  if state_row.draft_source_hash <> state_row.source_hash
     or state_row.draft_source_revision <> state_row.source_revision then
    raise exception 'El borrador corresponde a una fuente anterior' using errcode = '40001';
  end if;

  perform set_config('app.translation_editor_publish_state', state_row.id::text, true);
  perform public.translation_write_value(
    state_row.resource_type, state_row.resource_id, state_row.field_name,
    state_row.target_language, state_row.draft_value, auth.uid()
  );

  update public.translation_field_state
  set status = 'reviewed', translation_method = 'manual', provider = null,
      translated_source_hash = source_hash, translated_revision = source_revision,
      translated_at = now(), reviewed_at = coalesce(approved_at, now()),
      reviewed_by = coalesce(approved_by, auth.uid()),
      is_protected = true, protection_reason = 'manual', publication_status = 'published',
      published_at = now(), published_by = auth.uid(), withdrawn_at = null, withdrawn_by = null,
      workflow_status = 'none', draft_value = null, draft_source_hash = null,
      draft_source_revision = null, draft_updated_at = null, draft_updated_by = null,
      submitted_at = null, submitted_by = null, approved_at = null, approved_by = null,
      last_error_code = null, last_error = null,
      lock_version = lock_version + 1, updated_at = now()
  where id = state_row.id
  returning lock_version into next_lock_version;

  insert into public.admin_audit_log(actor_user_id, action, module, previous_value, new_value)
  values (
    auth.uid(), 'translation.publish', 'translations',
    jsonb_build_object('state_id', state_row.id, 'workflow_status', state_row.workflow_status,
      'publication_status', state_row.publication_status, 'lock_version', state_row.lock_version,
      'resource_type', state_row.resource_type, 'resource_id', state_row.resource_id,
      'field_name', state_row.field_name, 'target_language', state_row.target_language),
    jsonb_build_object('state_id', state_row.id, 'workflow_status', 'none',
      'publication_status', 'published', 'lock_version', next_lock_version)
  );
  return next_lock_version;
end
$$;

revoke all on function public.translation_publish_draft(uuid, bigint) from public, anon, authenticated, service_role;
grant execute on function public.translation_publish_draft(uuid, bigint) to authenticated;

commit;
