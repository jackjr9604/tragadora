insert into public.translation_resource_types(resource_type) values('blog_post_translation'),('offer_translation');
insert into public.translation_resource_fields values('blog_post_translation','title'),('offer_translation','description');
insert into public.translation_jobs(logical_key,idempotency_key,resource_type,resource_id,field_name,source_language,target_language,source_hash,source_revision,status,requested_provider,provider_used,error_code,last_error,created_at)
values
 ('a','a1','blog_post_translation','blog-1','title','es','en','h',1,'queued','libretranslate',null,null,null,now()-interval '3 minutes'),
 ('b','b1','blog_post_translation','blog-1','title','es','pt','h',1,'succeeded','libretranslate','libretranslate-local',null,null,now()-interval '2 minutes'),
 ('c','c1','offer_translation','offer-1','description','es','en','h',1,'failed','libretranslate',null,'local_provider_unavailable','offline',now()-interval '1 minute');

do $$ declare rows_count integer; total_value bigint; begin
  select count(*),max(total_count) into rows_count,total_value from public.translation_admin_jobs_inventory(
    array['blog_post_translation','offer_translation'],null,null,null,null,null,null,null,null,null,'created_desc',1,2);
  if rows_count<>2 or total_value<>3 then raise exception 'Paginación o total incorrecto';end if;
  select count(*) into rows_count from public.translation_admin_jobs_inventory(
    array['blog_post_translation'],'succeeded','blog_post_translation','blog-1','es','pt','libretranslate-local',now()-interval '1 day',now()+interval '1 day',null,'created_desc',1,25);
  if rows_count<>1 then raise exception 'Filtros combinados incorrectos';end if;
end $$;

do $$ declare s record; begin
 select * into s from public.translation_admin_jobs_summary(array['blog_post_translation','offer_translation']);
 if s.total<>3 or s.queued<>1 or s.succeeded<>1 or s.failed<>1 or s.recoverable<>1 then raise exception 'Conteos incorrectos';end if;
end $$;

select public.translation_worker_heartbeat('windows-test','ready',array['PT','es','en','es'],now(),now(),null);
select public.translation_worker_heartbeat('windows-test','degraded',array['es','en'],now(),now(),'provider_unavailable');
do $$ declare h record; begin
 select * into h from public.translation_admin_worker_status(120);
 if h.availability<>'degraded' or h.active_workers<>0 or h.supported_languages<>array['en','es'] or h.last_error_code<>'provider_unavailable' then raise exception 'Heartbeat incorrecto';end if;
 if (select count(*) from public.translation_worker_instances where worker_id='windows-test')<>1 then raise exception 'Heartbeat no idempotente';end if;
 if exists(select 1 from public.translation_worker_instances where provider<>'libretranslate-local') then raise exception 'Proveedor inválido';end if;
end $$;

do $$ begin
 begin perform public.translation_admin_jobs_inventory(array['unknown']);raise exception 'Aceptó recurso inválido';exception when sqlstate '22023' then null;end;
 begin perform public.translation_admin_jobs_inventory(array['blog_post_translation'],p_page_size=>51);raise exception 'Aceptó página inválida';exception when sqlstate '22023' then null;end;
 begin perform public.translation_admin_jobs_inventory(array['blog_post_translation'],p_created_from=>now(),p_created_to=>now()-interval '1 day');raise exception 'Aceptó fechas inválidas';exception when sqlstate '22023' then null;end;
 begin perform public.translation_worker_heartbeat('bad worker','ready',array['es'],now(),now(),null);raise exception 'Aceptó worker inválido';exception when sqlstate '22023' then null;end;
end $$;

do $$ begin
 if has_function_privilege('anon','public.translation_worker_heartbeat(text,text,text[],timestamptz,timestamptz,text)','EXECUTE')
 or has_function_privilege('authenticated','public.translation_worker_heartbeat(text,text,text[],timestamptz,timestamptz,text)','EXECUTE')
 or has_function_privilege('anon','public.translation_admin_jobs_inventory(text[],text,text,text,text,text,text,timestamptz,timestamptz,text,text,integer,integer)','EXECUTE')
 or has_function_privilege('authenticated','public.translation_admin_jobs_summary(text[],text,text,text,text,text,text,timestamptz,timestamptz,text)','EXECUTE')
 or has_function_privilege('authenticated','public.translation_admin_worker_status(integer)','EXECUTE') then raise exception 'RPC privilegiada expuesta';end if;
 if not has_function_privilege('service_role','public.translation_admin_jobs_inventory(text[],text,text,text,text,text,text,timestamptz,timestamptz,text,text,integer,integer)','EXECUTE') then raise exception 'service_role sin lectura';end if;
 if has_table_privilege('authenticated','public.translation_worker_instances','SELECT') then raise exception 'Heartbeat expuesto';end if;
end $$;

do $$ declare before_jobs jsonb;after_jobs jsonb;begin
 select jsonb_agg(to_jsonb(j) order by id) into before_jobs from public.translation_jobs j;
 perform public.translation_admin_jobs_summary(array['blog_post_translation','offer_translation']);
 perform public.translation_admin_worker_status(120);
 select jsonb_agg(to_jsonb(j) order by id) into after_jobs from public.translation_jobs j;
 if before_jobs is distinct from after_jobs then raise exception 'Las lecturas modificaron trabajos';end if;
end $$;

select 'translation jobs monitoring postgres tests passed' result;
