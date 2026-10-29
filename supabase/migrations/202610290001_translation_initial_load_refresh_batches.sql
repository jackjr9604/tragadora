begin;

-- Correccion operativa temporal: evita reescribir todos los grupos pendientes
-- en cada ciclo. Conserva firma, ACL y semantica del runner inicial.
create or replace function public.translation_initial_load_refresh(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
begin
  if auth.role()<>'service_role' then
    raise exception 'Forbidden' using errcode='42501';
  end if;

  with candidates as materialized (
    select
      g.run_id,g.resource_type,g.field_name,g.source_hash,g.target_language,
      case
        when j.status='succeeded' and s.workflow_status='draft'
          and s.draft_source_hash=s.source_hash
          and s.draft_source_revision=s.source_revision then 'proposal_ready'
        when j.status='succeeded' then 'failed'
        when j.status='failed' then 'failed'
        when j.status='cancelled' then 'skipped'
        when j.status='running' then 'processing'
        when j.status in('queued','retry_wait') then 'queued'
        else g.status
      end desired_status,
      case
        when j.status='succeeded' and not (
          s.workflow_status='draft' and s.draft_source_hash=s.source_hash
          and s.draft_source_revision=s.source_revision
        ) then 'proposal_changed'
        when j.status in('failed','cancelled') then coalesce(j.error_code,'job_failed')
        else g.error_code
      end desired_error
    from public.translation_initial_load_groups g
    join public.translation_jobs j on j.id=g.job_id
    join public.translation_field_state s on s.id=g.representative_state_id
    where g.run_id=p_run_id
      and g.status in('queued','processing')
      and j.status in('queued','running','retry_wait','succeeded','failed','cancelled')
      and (
        g.status is distinct from case
          when j.status='succeeded' and s.workflow_status='draft'
            and s.draft_source_hash=s.source_hash
            and s.draft_source_revision=s.source_revision then 'proposal_ready'
          when j.status='succeeded' then 'failed'
          when j.status='failed' then 'failed'
          when j.status='cancelled' then 'skipped'
          when j.status='running' then 'processing'
          when j.status in('queued','retry_wait') then 'queued'
          else g.status
        end
        or (j.status in('failed','cancelled','succeeded') and g.error_code is null)
      )
    order by g.updated_at,g.resource_type,g.field_name,g.target_language,g.source_hash
    for update of g skip locked
    limit 200
  )
  update public.translation_initial_load_groups g
  set status=c.desired_status,error_code=c.desired_error,updated_at=now()
  from candidates c
  where g.run_id=c.run_id and g.resource_type=c.resource_type
    and g.field_name=c.field_name and g.source_hash=c.source_hash
    and g.target_language=c.target_language;

  with terminal_jobs as materialized (
    select j.id
    from public.translation_jobs j
    where j.metadata->>'initial_load_run_id'=p_run_id::text
      and j.metadata->>'budget_scope'='initial_exact_group_load'
      and j.status in('succeeded','failed','cancelled')
      and j.metadata->>'engine'='3e3'
    order by j.updated_at,j.id
    for update skip locked
    limit 500
  )
  update public.translation_jobs j
  set metadata=j.metadata||jsonb_build_object('engine','initial_exact_group_load'),updated_at=now()
  from terminal_jobs t where j.id=t.id;

  return (
    select jsonb_object_agg(status,total)
    from (
      select status,count(*) total
      from public.translation_initial_load_groups
      where run_id=p_run_id group by status
    ) x
  );
end $$;

revoke all on function public.translation_initial_load_refresh(uuid) from public,anon,authenticated,service_role;
grant execute on function public.translation_initial_load_refresh(uuid) to service_role;

commit;
