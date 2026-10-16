\set ON_ERROR_STOP on
begin;

insert into public.translation_resource_types(resource_type) values('blog_post_translation') on conflict do nothing;
insert into public.translation_resource_fields(resource_type,field_name) values('blog_post_translation','title') on conflict do nothing;

insert into public.translation_jobs(
  id,logical_key,idempotency_key,resource_type,resource_id,field_name,source_language,target_language,
  source_hash,source_revision,status,requested_provider,provider_used,error_code,last_error,
  started_at,completed_at,input_characters,output_characters,created_at
) values
 ('33000000-0000-4000-8000-000000000001','m1','metrics-1','blog_post_translation','metrics-blog','title','es','en','h',1,'succeeded','libretranslate','libretranslate-local',null,null,now()-interval '10 minutes',now()-interval '9 minutes',100,120,now()-interval '11 minutes'),
 ('33000000-0000-4000-8000-000000000002','m2','metrics-2','blog_post_translation','metrics-blog','title','es','pt','h',1,'succeeded','libretranslate','libretranslate-local',null,null,now()-interval '8 minutes',now()-interval '6 minutes',80,100,now()-interval '9 minutes'),
 ('33000000-0000-4000-8000-000000000003','m3','metrics-3','blog_post_translation','metrics-blog','title','es','en','h',1,'failed','libretranslate',null,'local_provider_unavailable','private endpoint detail',now()-interval '5 minutes',now()-interval '4 minutes',50,null,now()-interval '6 minutes'),
 ('33000000-0000-4000-8000-000000000004','m4','metrics-4','blog_post_translation','metrics-blog','title','es','pt','h',1,'failed','libretranslate',null,'translation_failed','La traducción alteró Markdown protegido.',now()-interval '4 minutes',now()-interval '3 minutes',40,null,now()-interval '5 minutes'),
 ('33000000-0000-4000-8000-000000000005','m5','metrics-5','blog_post_translation','metrics-pending','title','es','en','h',1,'queued','libretranslate',null,null,null,null,null,null,null,now()-interval '2 hours');

do $$ declare m record;before_jobs jsonb;after_jobs jsonb;begin
  select jsonb_agg(to_jsonb(j) order by j.id) into before_jobs from public.translation_jobs j where j.id::text like '33000000-%';
  select * into m from public.translation_admin_jobs_metrics(array['blog_post_translation'],'24h','blog_post_translation',null,'es',null,'libretranslate');
  if m.terminal_jobs<>4 or m.succeeded_jobs<>2 or m.failed_jobs<>2 or m.completed_jobs<>2
     or m.success_rate<>0.5 or m.failure_rate<>0.5 or m.duration_samples<>2
     or round(m.average_duration_seconds)<>90 or round(m.p50_duration_seconds)<>90 or m.p95_duration_seconds is not null
     or m.processed_characters<>400 or m.oldest_pending_age_seconds<7100 then
    raise exception 'Agregación operativa incorrecta: %',to_jsonb(m);
  end if;
  if m.error_distribution<>jsonb_build_object('protected_content_validation',1,'recoverable_connectivity',1) then
    raise exception 'Clasificación segura incorrecta: %',m.error_distribution;
  end if;
  select * into m from public.translation_admin_jobs_metrics(array['blog_post_translation'],'7d','blog_post_translation','sin-resultados','es','en','libretranslate');
  if m.terminal_jobs<>0 or m.success_rate is not null or m.failure_rate is not null
     or m.average_duration_seconds is not null or m.p50_duration_seconds is not null or m.p95_duration_seconds is not null
     or m.processed_characters is not null or m.error_distribution is not null or m.oldest_pending_created_at is not null then
    raise exception 'Ausencias convertidas en cero o datos inventados: %',to_jsonb(m);
  end if;
  select jsonb_agg(to_jsonb(j) order by j.id) into after_jobs from public.translation_jobs j where j.id::text like '33000000-%';
  if before_jobs is distinct from after_jobs then raise exception 'La RPC modificó trabajos';end if;
end $$;

do $$ begin
  begin perform public.translation_admin_jobs_metrics(array['blog_post_translation'],'1y');raise exception 'Aceptó periodo inválido';exception when sqlstate '22023' then null;end;
  begin perform public.translation_admin_jobs_metrics(array['unknown'],'24h');raise exception 'Aceptó recurso no autorizado';exception when sqlstate '22023' then null;end;
  if has_function_privilege('anon','public.translation_admin_jobs_metrics(text[],text,text,text,text,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.translation_admin_jobs_metrics(text[],text,text,text,text,text,text)','EXECUTE')
     or not has_function_privilege('service_role','public.translation_admin_jobs_metrics(text[],text,text,text,text,text,text)','EXECUTE') then
    raise exception 'Permisos incorrectos en RPC de métricas';
  end if;
end $$;

select 'translation job operational metrics postgres tests passed' result;
rollback;
