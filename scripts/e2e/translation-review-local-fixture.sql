\set ON_ERROR_STOP on
set role supabase_admin;

do $$ begin
  if to_regclass('public.tradagora_local_e2e_guard') is null then
    raise exception 'ABORTADO: fixture exclusiva del baseline E2E local';
  end if;
end $$;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('00000000-0000-0000-0000-000000000000','85100000-0000-4000-8000-000000000001','authenticated','authenticated','review-admin@local.invalid',crypt('LocalOnly-Review-Admin!',gen_salt('bf')),now(),'','','','', '{"provider":"email","providers":["email"]}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','85100000-0000-4000-8000-000000000002','authenticated','authenticated','review-viewer@local.invalid',crypt('LocalOnly-Review-Viewer!',gen_salt('bf')),now(),'','','','', '{"provider":"email","providers":["email"]}','{}',now(),now())
on conflict(id) do update set instance_id=excluded.instance_id,encrypted_password=excluded.encrypted_password,
  confirmation_token='',recovery_token='',email_change_token_new='',email_change='',raw_app_meta_data=excluded.raw_app_meta_data,updated_at=now();

insert into auth.identities(provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
select id::text,id,jsonb_build_object('sub',id::text,'email',email,'email_verified',true,'phone_verified',false),'email',now(),now(),now()
from auth.users where id in ('85100000-0000-4000-8000-000000000001','85100000-0000-4000-8000-000000000002')
on conflict(provider_id,provider) do update set identity_data=excluded.identity_data,updated_at=now();

select set_config('request.jwt.claim.role','service_role',false);
delete from public.admin_audit_log
where actor_user_id='85100000-0000-4000-8000-000000000001'
  and action in ('translation.approve','translation.reject');
update public.profiles set role='super_admin' where id='85100000-0000-4000-8000-000000000001';
update public.profiles set role='user' where id='85100000-0000-4000-8000-000000000002';
insert into public.user_permission_overrides(user_id,permission_key,allowed)
values
 ('85100000-0000-4000-8000-000000000002','blog.view',true),
 ('85100000-0000-4000-8000-000000000002','blog.update',false)
on conflict(user_id,permission_key) do update set allowed=excluded.allowed;

insert into public.blog_posts(id,slug,title,excerpt,body_markdown,category,tags,author_name,status)
values
 ('85110000-0000-4000-8000-000000000001','e2e-review-one','Fuente sintética uno','Extracto fuente uno',E'# Fuente uno\n\nContenido local.','Pruebas',array['uno','local'],'E2E local','draft'),
 ('85110000-0000-4000-8000-000000000002','e2e-review-two','Fuente sintética dos','Extracto fuente dos',E'# Fuente dos\n\nContenido local.','Pruebas',array['dos','local'],'E2E local','draft'),
 ('85110000-0000-4000-8000-000000000003','e2e-review-three','Fuente sintética tres','Extracto fuente tres',E'# Fuente tres\n\nContenido local.','Pruebas',array['tres','local'],'E2E local','draft')
on conflict(id) do nothing;

update public.translation_field_state
set status='machine_translated',workflow_status='in_review',publication_status='unpublished',
    draft_value=case field_name
      when 'tags' then jsonb_build_array('translated','local')
      else to_jsonb(('Draft '||field_name||' '||target_language)::text)
    end,
    draft_source_hash=source_hash,draft_source_revision=source_revision,
    submitted_at=now(),lock_version=4,is_protected=false,protection_reason=null,updated_at=now()
where resource_type='blog_post_translation'
  and resource_id in ('85110000-0000-4000-8000-000000000001','85110000-0000-4000-8000-000000000002','85110000-0000-4000-8000-000000000003');

-- Protección manual no excluye una revisión humana vigente.
update public.translation_field_state set is_protected=true,protection_reason='manual'
where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000001'
  and field_name='title' and target_language='en';

-- Estados no elegibles visibles en la bandeja.
update public.translation_field_state set status='stale'
where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000001'
  and field_name='excerpt' and target_language='en';

alter table public.translation_field_state disable trigger translation_editorial_state_guard;
update public.translation_field_state set draft_source_hash=repeat('0',64)
where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000001'
  and field_name='body_markdown' and target_language='en';
alter table public.translation_field_state enable trigger translation_editorial_state_guard;

update public.translation_field_state set publication_status='published',status='reviewed',
  translated_source_hash=source_hash,translated_revision=source_revision,reviewed_at=now()
where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000001'
  and field_name='category' and target_language='en';

do $$
declare total integer; eligible integer;
begin
  select count(*) into total from public.translation_field_state
  where resource_type='blog_post_translation' and resource_id like '85110000-0000-4000-8000-%' and workflow_status='in_review';
  if total<>30 then raise exception 'Fixture esperaba 30 estados in_review y obtuvo %',total; end if;
  select count(*) into eligible from public.translation_field_state
  where resource_type='blog_post_translation' and resource_id like '85110000-0000-4000-8000-%'
    and workflow_status='in_review' and draft_value is not null and publication_status='unpublished'
    and status<>'stale' and draft_source_hash=source_hash and draft_source_revision=source_revision and lock_version>0;
  if eligible<>27 then raise exception 'Fixture esperaba 27 estados elegibles y obtuvo %',eligible; end if;
end $$;
