\set ON_ERROR_STOP on
begin;

update public.translation_field_state
set workflow_status='approved',publication_status='unpublished',status='machine_translated',
    draft_source_hash=source_hash,draft_source_revision=source_revision,lock_version=7,
    approved_at=now(),approved_by='85100000-0000-4000-8000-000000000001'
where resource_type='blog_post_translation'
  and resource_id in ('85110000-0000-4000-8000-000000000002','85110000-0000-4000-8000-000000000003')
  and ((field_name='title' and target_language='en') or (field_name='excerpt' and target_language='pt'));

create temporary table publication_test_ids(kind text primary key,state_id uuid,lock_version bigint);
insert into publication_test_ids
select 'publish',id,lock_version from public.translation_field_state
where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000002'
  and field_name='title' and target_language='en';
insert into publication_test_ids
select 'concurrent',id,lock_version from public.translation_field_state
where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000002'
  and field_name='excerpt' and target_language='pt';
insert into publication_test_ids
select 'denied',id,lock_version from public.translation_field_state
where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000003'
  and field_name='title' and target_language='en';
grant select on publication_test_ids to authenticated;

do $$begin
 if has_function_privilege('anon','public.translation_publish_draft(uuid,bigint)','EXECUTE')
    or has_function_privilege('service_role','public.translation_publish_draft(uuid,bigint)','EXECUTE')
    or not has_function_privilege('authenticated','public.translation_publish_draft(uuid,bigint)','EXECUTE') then
   raise exception 'Permisos incorrectos para translation_publish_draft';
 end if;
end$$;

set local role authenticated;
select set_config('request.jwt.claim.sub','85100000-0000-4000-8000-000000000001',true);
select public.translation_publish_draft(state_id,lock_version) from publication_test_ids where kind='publish';
reset role;

do $$begin
 if not exists(select 1 from public.translation_field_state s join publication_test_ids t on t.kind='publish' and t.state_id=s.id
   where s.workflow_status='none' and s.publication_status='published' and s.status='reviewed'
     and s.is_protected and s.draft_value is null and s.lock_version=t.lock_version+1) then
   raise exception 'La publicación no produjo un estado público protegido y coherente';
 end if;
 if (select count(*) from public.admin_audit_log where actor_user_id='85100000-0000-4000-8000-000000000001' and action='translation.publish')<>1 then
   raise exception 'No se registró auditoría por publicación';
 end if;
end$$;

-- Idempotencia/concurrencia: el snapshot anterior no puede volver a publicar.
set local role authenticated;
select set_config('request.jwt.claim.sub','85100000-0000-4000-8000-000000000001',true);
do $$begin begin
 perform public.translation_publish_draft(state_id,lock_version) from publication_test_ids where kind='publish';
 raise exception 'La repetición ignoró lock_version';
exception when serialization_failure then null;end;end$$;
reset role;

-- Cambio concurrente: solo falla ese elemento.
update public.translation_field_state set lock_version=lock_version+1 where id=(select state_id from publication_test_ids where kind='concurrent');
set local role authenticated;
select set_config('request.jwt.claim.sub','85100000-0000-4000-8000-000000000001',true);
do $$begin begin
 perform public.translation_publish_draft(state_id,lock_version) from publication_test_ids where kind='concurrent';
 raise exception 'La publicación ignoró cambio concurrente';
exception when serialization_failure then null;end;end$$;
reset role;

-- Un usuario sin permiso update no publica.
set local role authenticated;
select set_config('request.jwt.claim.sub','85100000-0000-4000-8000-000000000002',true);
do $$begin begin
 perform public.translation_publish_draft(state_id,lock_version) from publication_test_ids where kind='denied';
 raise exception 'Usuario sin blog.update pudo publicar';
exception when insufficient_privilege then null;end;end$$;
reset role;

rollback;
