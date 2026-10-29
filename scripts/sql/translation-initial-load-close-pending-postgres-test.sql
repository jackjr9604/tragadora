begin;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('a5270000-0000-4000-8000-000000000097','authenticated','authenticated','close-pending@local.invalid',crypt('LocalOnly!',gen_salt('bf')),now(),'{}','{}',now(),now()) on conflict(id) do nothing;
select set_config('request.jwt.claim.role','service_role',true);
update public.profiles set role='super_admin' where id='a5270000-0000-4000-8000-000000000097';
set local role service_role;
select public.translation_initial_load_start('a5271000-0000-4000-8000-000000000003','a5270000-0000-4000-8000-000000000097',3500,10000000);
reset role;

do $$declare s public.translation_field_state%rowtype;payload jsonb;result jsonb;begin
 insert into public.platforms(id,type,name,slug,status)
 values('a5272000-0000-4000-8000-000000000001','prop_firm','Fixture Close Pending','fixture-close-pending','active')
 on conflict(id) do nothing;
 insert into public.platform_translations(platform_id,language,short_description,description,pros,cons)
 values('a5272000-0000-4000-8000-000000000001','es','Descripción fuente','Descripción fuente larga','[]','[]')
 on conflict(platform_id,language) do update set short_description=excluded.short_description;
 insert into public.translation_field_state(resource_type,resource_id,field_name,source_language,target_language,source_hash,source_revision,status,publication_status,workflow_status)
 values('platform_translation','a5272000-0000-4000-8000-000000000001','short_description','es','pt',public.translation_hash(to_jsonb('Descripción fuente'::text)),1,'missing','unpublished','none')
 on conflict(resource_type,resource_id,field_name,target_language) do update set source_hash=excluded.source_hash,source_revision=excluded.source_revision,status='missing',publication_status='unpublished',workflow_status='none',draft_value=null,draft_source_hash=null,draft_source_revision=null;
 select * into s from public.translation_field_state where resource_type='platform_translation' and field_name='short_description' and target_language='pt' limit 1;
 if not found then raise exception 'Fixture platform_translation ausente';end if;
 delete from public.platform_translations where platform_id=s.resource_id::uuid and language=s.target_language;
 update public.translation_field_state set status='error',workflow_status='draft',publication_status='unpublished',is_protected=false,protection_reason=null,
   draft_value=to_jsonb('Descrição local validada'::text),draft_source_hash=source_hash,draft_source_revision=source_revision,
   translation_method='libretranslate',lock_version=lock_version+1 where id=s.id returning * into s;
 payload:=jsonb_build_array(jsonb_build_object('state_id',s.id,'expected_lock_version',s.lock_version,'source_hash',s.source_hash,'source_revision',s.source_revision,'value','Descrição local validada'));
 perform set_config('request.jwt.claim.role','service_role',true);set local role service_role;
 result:=public.translation_initial_load_close_pending('a5271000-0000-4000-8000-000000000003',payload);
 reset role;
 if (result->>'published')::integer<>1 or (result->>'errors')::integer<>0 then raise exception 'Cierre falló: %',result;end if;
 if not exists(select 1 from public.translation_field_state where id=s.id and status='reviewed' and publication_status='published' and is_protected) then raise exception 'Estado final incoherente';end if;
 if not exists(select 1 from public.platform_translations where platform_id=s.resource_id::uuid and language=s.target_language and short_description='Descrição local validada') then raise exception 'Fila pública no creada';end if;
 if not exists(select 1 from public.admin_audit_log where action='translation.initial_load.close_pending' and new_value->>'state_id'=s.id::text) then raise exception 'Auditoría ausente';end if;
end$$;

set local role anon;
do $$begin begin perform public.translation_initial_load_close_pending('a5271000-0000-4000-8000-000000000003','[]');raise exception 'anon ejecutó cierre';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
select 'translation_initial_load_close_pending_postgres_test: PASS' result;
