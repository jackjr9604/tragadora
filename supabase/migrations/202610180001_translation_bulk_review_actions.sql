begin;

-- Mantiene la RPC individual como única transición de aprobación y añade
-- auditoría sin cambiar su firma ni publicar contenido.
create or replace function public.translation_approve_draft(
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
  if state_row.workflow_status <> 'in_review' or state_row.draft_value is null then
    raise exception 'El borrador no está en revisión' using errcode = '22023';
  end if;
  if state_row.draft_source_hash <> state_row.source_hash
     or state_row.draft_source_revision <> state_row.source_revision then
    raise exception 'El borrador corresponde a una fuente anterior' using errcode = '40001';
  end if;

  update public.translation_field_state
  set workflow_status = 'approved',
      approved_at = now(),
      approved_by = auth.uid(),
      lock_version = lock_version + 1,
      updated_at = now()
  where id = state_row.id
  returning lock_version into next_lock_version;

  insert into public.admin_audit_log(actor_user_id, action, module, previous_value, new_value)
  values (
    auth.uid(), 'translation.approve', 'translations',
    jsonb_build_object('state_id', state_row.id, 'workflow_status', state_row.workflow_status,
      'lock_version', state_row.lock_version, 'resource_type', state_row.resource_type,
      'resource_id', state_row.resource_id, 'field_name', state_row.field_name,
      'target_language', state_row.target_language),
    jsonb_build_object('state_id', state_row.id, 'workflow_status', 'approved',
      'lock_version', next_lock_version)
  );
  return next_lock_version;
end
$$;

-- Rechazar devuelve el borrador a edición. No elimina el borrador, no cambia
-- su protección y nunca escribe el valor público.
create or replace function public.translation_reject_draft(
  p_state_id uuid,
  p_expected_lock_version bigint,
  p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  state_row public.translation_field_state%rowtype;
  clean_reason text := btrim(coalesce(p_reason, ''));
  next_lock_version bigint;
begin
  if char_length(clean_reason) < 5 or char_length(clean_reason) > 500 then
    raise exception 'El motivo debe tener entre 5 y 500 caracteres' using errcode = '22023';
  end if;

  select * into state_row
  from public.translation_field_state
  where id = p_state_id
  for update;
  if not found then raise exception 'Estado no encontrado' using errcode = 'P0002'; end if;

  perform public.translation_assert_admin_permission(state_row.resource_type);
  perform public.translation_editor_assert_version(state_row, p_expected_lock_version);
  perform public.translation_editor_assert_source(state_row);
  if state_row.workflow_status <> 'in_review' or state_row.draft_value is null then
    raise exception 'El borrador no está en revisión' using errcode = '22023';
  end if;
  if state_row.draft_source_hash <> state_row.source_hash
     or state_row.draft_source_revision <> state_row.source_revision then
    raise exception 'El borrador corresponde a una fuente anterior' using errcode = '40001';
  end if;

  update public.translation_field_state
  set workflow_status = 'draft',
      submitted_at = null,
      submitted_by = null,
      approved_at = null,
      approved_by = null,
      lock_version = lock_version + 1,
      updated_at = now()
  where id = state_row.id
  returning lock_version into next_lock_version;

  insert into public.admin_audit_log(actor_user_id, action, module, previous_value, new_value)
  values (
    auth.uid(), 'translation.reject', 'translations',
    jsonb_build_object('state_id', state_row.id, 'workflow_status', state_row.workflow_status,
      'lock_version', state_row.lock_version, 'resource_type', state_row.resource_type,
      'resource_id', state_row.resource_id, 'field_name', state_row.field_name,
      'target_language', state_row.target_language),
    jsonb_build_object('state_id', state_row.id, 'workflow_status', 'draft',
      'lock_version', next_lock_version, 'reason', clean_reason)
  );
  return next_lock_version;
end
$$;

revoke all on function public.translation_approve_draft(uuid, bigint) from public, anon, authenticated, service_role;
grant execute on function public.translation_approve_draft(uuid, bigint) to authenticated;
revoke all on function public.translation_reject_draft(uuid, bigint, text) from public, anon, authenticated, service_role;
grant execute on function public.translation_reject_draft(uuid, bigint, text) to authenticated;

commit;
