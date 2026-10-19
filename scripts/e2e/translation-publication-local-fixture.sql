\set ON_ERROR_STOP on
set role supabase_admin;

do $$begin
  if to_regclass('public.tradagora_local_e2e_guard') is null then
    raise exception 'ABORTADO: fixture exclusiva del baseline E2E local';
  end if;
end$$;

delete from public.admin_audit_log
where actor_user_id='85100000-0000-4000-8000-000000000001' and action='translation.publish';

update public.translation_field_state
set status='machine_translated',workflow_status='approved',publication_status='unpublished',
    draft_value=case field_name when 'tags' then jsonb_build_array('approved','local') else to_jsonb(('Approved '||field_name||' '||target_language)::text) end,
    draft_source_hash=source_hash,draft_source_revision=source_revision,
    approved_at=now(),approved_by='85100000-0000-4000-8000-000000000001',
    lock_version=10,is_protected=false,protection_reason=null,updated_at=now()
where resource_type='blog_post_translation'
  and resource_id in ('85110000-0000-4000-8000-000000000001','85110000-0000-4000-8000-000000000002','85110000-0000-4000-8000-000000000003');

-- Protección manual sigue siendo publicable porque la aprobación humana
-- autoriza exactamente este snapshot; la protección se conserva al publicar.
update public.translation_field_state set is_protected=true,protection_reason='manual'
where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000001'
  and field_name='title' and target_language='en';

-- Conflictos visibles y no seleccionables.
update public.translation_field_state set status='stale'
where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000001'
  and field_name='excerpt' and target_language='en';
alter table public.translation_field_state disable trigger translation_editorial_state_guard;
update public.translation_field_state set draft_source_hash=repeat('0',64)
where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000001'
  and field_name='body_markdown' and target_language='en';
alter table public.translation_field_state enable trigger translation_editorial_state_guard;
update public.translation_field_state set publication_status='published',workflow_status='none',
  status='reviewed',translated_source_hash=source_hash,translated_revision=source_revision,
  draft_value=null,draft_source_hash=null,draft_source_revision=null,draft_updated_at=null,draft_updated_by=null,
  submitted_at=null,submitted_by=null,approved_at=null,approved_by=null,published_at=now(),
  is_protected=true,protection_reason='manual'
where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000001'
  and field_name='category' and target_language='en';
