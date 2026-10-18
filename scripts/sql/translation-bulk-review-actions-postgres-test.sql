\set ON_ERROR_STOP on

begin;

create temporary table review_test_ids(kind text primary key,state_id uuid,lock_version bigint);
insert into review_test_ids
select 'approve',id,lock_version from public.translation_field_state
where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000002'
  and field_name='title' and target_language='en';
insert into review_test_ids
select 'reject',id,lock_version from public.translation_field_state
where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000002'
  and field_name='excerpt' and target_language='pt';
insert into review_test_ids
select 'denied',id,lock_version from public.translation_field_state
where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000003'
  and field_name='title' and target_language='en';
grant select on review_test_ids to authenticated;

do $$ begin
  if has_function_privilege('anon','public.translation_reject_draft(uuid,bigint,text)','EXECUTE')
     or has_function_privilege('service_role','public.translation_reject_draft(uuid,bigint,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.translation_reject_draft(uuid,bigint,text)','EXECUTE') then
    raise exception 'Permisos incorrectos para translation_reject_draft';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','85100000-0000-4000-8000-000000000001',true);
select public.translation_approve_draft(state_id,lock_version) from review_test_ids where kind='approve';
select public.translation_reject_draft(state_id,lock_version,'Requiere una corrección editorial local.') from review_test_ids where kind='reject';
reset role;

do $$ begin
  if not exists(select 1 from public.translation_field_state s join review_test_ids t on t.kind='approve' and t.state_id=s.id
    where s.workflow_status='approved' and s.publication_status='unpublished' and s.lock_version=t.lock_version+1) then
    raise exception 'Aprobación no respetó estado, publicación o lock_version';
  end if;
  if not exists(select 1 from public.translation_field_state s join review_test_ids t on t.kind='reject' and t.state_id=s.id
    where s.workflow_status='draft' and s.publication_status='unpublished' and s.lock_version=t.lock_version+1 and s.draft_value is not null) then
    raise exception 'Rechazo no devolvió el borrador de forma segura';
  end if;
  if (select count(*) from public.admin_audit_log where actor_user_id='85100000-0000-4000-8000-000000000001'
      and action in ('translation.approve','translation.reject'))<>2 then
    raise exception 'No se registró la auditoría editorial';
  end if;
  if exists(select 1 from public.translation_field_state s join review_test_ids t on t.state_id=s.id
      where s.publication_status='published') then
    raise exception 'Una decisión editorial publicó contenido';
  end if;
end $$;

-- Repetición con el snapshot antiguo: debe fallar por concurrencia y no duplicar auditoría.
set local role authenticated;
select set_config('request.jwt.claim.sub','85100000-0000-4000-8000-000000000001',true);
do $$ begin
  begin
    perform public.translation_approve_draft(state_id,lock_version) from review_test_ids where kind='approve';
    raise exception 'La aprobación repetida ignoró lock_version';
  exception when serialization_failure then null;
  end;
end $$;
reset role;

-- Usuario con solo blog.view no puede aprobar.
set local role authenticated;
select set_config('request.jwt.claim.sub','85100000-0000-4000-8000-000000000002',true);
do $$ begin
  begin
    perform public.translation_approve_draft(state_id,lock_version) from review_test_ids where kind='denied';
    raise exception 'Usuario sin blog.update pudo aprobar';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Motivo obligatorio y acotado.
set local role authenticated;
select set_config('request.jwt.claim.sub','85100000-0000-4000-8000-000000000001',true);
do $$ begin
  begin
    perform public.translation_reject_draft(state_id,lock_version,'no') from review_test_ids where kind='denied';
    raise exception 'Se aceptó un motivo inválido';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

rollback;
