begin;
create or replace function public.translation_initial_load_quarantine_publish_failures(p_run_id uuid)
returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare affected integer;
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501';end if;
  if not exists(select 1 from public.translation_initial_load_runs where id=p_run_id) then raise exception 'Ejecución no encontrada' using errcode='P0002';end if;
  update public.translation_field_state s set status='error',last_error_code='initial_load_publish_revalidation_failed',
    last_error='La publicación inicial omitió este borrador por un conflicto de integridad. Requiere revisión.',
    lock_version=lock_version+1,updated_at=now()
  where s.publication_status='unpublished' and s.status='machine_translated'
    and exists(select 1 from public.admin_audit_log a where a.action='translation.initial_load.publish_skipped'
      and a.new_value->>'run_id'=p_run_id::text and a.previous_value->>'state_id'=s.id::text);
  get diagnostics affected=row_count;
  return affected;
end $$;
revoke all on function public.translation_initial_load_quarantine_publish_failures(uuid) from public,anon,authenticated,service_role;
grant execute on function public.translation_initial_load_quarantine_publish_failures(uuid) to service_role;
commit;
