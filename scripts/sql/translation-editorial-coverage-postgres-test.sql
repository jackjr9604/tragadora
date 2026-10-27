\set ON_ERROR_STOP on
begin;

insert into public.languages(code,name,native_name,is_active,is_default,sort_order,publication_status,ui_catalog_available,seo_ready)
values ('es','Spanish','Español',true,true,1,'published',true,true),
       ('en','English','English',true,false,2,'published',true,true),
       ('pt','Portuguese','Português',true,false,3,'published',true,true);

insert into public.translation_resource_types(resource_type,description,adapter_key)
values ('coverage_test','Cobertura sintética','coverage_test');
insert into public.translation_resource_fields(resource_type,field_name)
values ('coverage_test','complete'),('coverage_test','machine'),('coverage_test','stale'),
       ('coverage_test','imported'),('coverage_test','withdrawn'),('coverage_test','failed');

-- One complete resource in both target languages.
insert into public.translation_field_state(resource_type,resource_id,field_name,source_language,target_language,source_hash,translated_source_hash,source_revision,translated_revision,status,translation_method,is_protected,protection_reason,reviewed_at,publication_status)
values
('coverage_test','complete-resource','complete','es','en',repeat('a',64),repeat('a',64),1,1,'reviewed','manual',true,'reviewed',now(),'published'),
('coverage_test','complete-resource','complete','es','pt',repeat('a',64),repeat('a',64),1,1,'reviewed','manual',true,'reviewed',now(),'published'),
-- Automatic EN draft and a still-missing PT field.
('coverage_test','work-resource','machine','es','en',repeat('b',64),repeat('b',64),1,1,'machine_translated','libretranslate',false,null,null,'unpublished'),
('coverage_test','work-resource','machine','es','pt',repeat('b',64),null,1,null,'missing',null,false,null,null,'unpublished'),
-- Published but stale EN must remain pending.
('coverage_test','work-resource','stale','es','en',repeat('c',64),repeat('d',64),2,1,'stale','manual',true,'manual',now(),'published'),
-- Historical protected import is complete; an unprotected one is not.
('coverage_test','work-resource','imported','es','en',repeat('e',64),repeat('e',64),1,1,'imported_unreviewed','imported',true,'imported',null,'published'),
('coverage_test','work-resource','imported','es','pt',repeat('e',64),repeat('e',64),1,1,'imported_unreviewed','imported',false,null,null,'published'),
-- Withdrawn reviewed content becomes pending again.
('coverage_test','work-resource','withdrawn','es','pt',repeat('f',64),repeat('f',64),1,1,'reviewed','manual',true,'reviewed',now(),'unpublished'),
('coverage_test','work-resource','failed','es','pt',repeat('1',64),null,1,null,'error',null,false,null,null,'unpublished');

set local request.jwt.claim.role='service_role';

do $$
declare en record; pt record; complete_row record; pending_row record; summary_row record;
begin
  select * into en from public.translation_admin_language_coverage(array['coverage_test']) where target_language='en';
  select * into pt from public.translation_admin_language_coverage(array['coverage_test']) where target_language='pt';
  if en.total_fields<>4 or en.completed_fields<>2 or en.pending_fields<>2 or en.automatic_review_fields<>1 or en.stale_fields<>1 or en.protected_fields<>3 or en.error_fields<>0 then
    raise exception 'Cobertura EN incorrecta: %',row_to_json(en);
  end if;
  if pt.total_fields<>5 or pt.completed_fields<>1 or pt.pending_fields<>4 or pt.automatic_review_fields<>0 or pt.stale_fields<>0 or pt.protected_fields<>2 or pt.error_fields<>1 then
    raise exception 'Cobertura PT incorrecta: %',row_to_json(pt);
  end if;

  select * into complete_row from public.translation_admin_content_center_inventory(array['coverage_test'],null,null,'published',null,1,25);
  if complete_row.resource_id is distinct from 'complete-resource' or complete_row.pending_count<>0 or complete_row.published_count<>2 then
    raise exception 'La bandeja publicada no aisló el recurso completo';
  end if;
  select * into pending_row from public.translation_admin_content_center_inventory(array['coverage_test'],null,null,'pending',null,1,25);
  if pending_row.resource_id is distinct from 'work-resource' or pending_row.pending_count<>6 then
    raise exception 'La bandeja pendiente no conserva el trabajo editorial real: %',row_to_json(pending_row);
  end if;
  select * into summary_row from public.translation_admin_content_center_summary(array['coverage_test']);
  if summary_row.resources<>2 or summary_row.fields<>9 or summary_row.pending<>1 or summary_row.published<>1 or summary_row.partial<>1 or summary_row.stale<>1 or summary_row.error<>1 then
    raise exception 'Resumen global incorrecto: %',row_to_json(summary_row);
  end if;
end $$;

do $$
begin
  perform set_config('request.jwt.claim.role','anon',true);
  begin
    perform * from public.translation_admin_language_coverage(array['coverage_test']);
    raise exception 'anon ejecutó una RPC privilegiada';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
