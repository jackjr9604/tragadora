\set ON_ERROR_STOP on

do $$begin
 if exists(select 1 from pg_policies where schemaname='public' and tablename='languages' and policyname in('tg_languages_create','tg_languages_update','tg_languages_delete')) then raise exception 'unsafe policies remain';end if;
 if has_table_privilege('authenticated','public.languages','insert') or has_table_privilege('authenticated','public.languages','update') or has_table_privilege('authenticated','public.languages','delete') then raise exception 'authenticated still has direct DML';end if;
 if has_function_privilege('anon','public.translation_admin_language_inventory()','execute') or has_function_privilege('authenticated','public.translation_admin_language_inventory()','execute') then raise exception 'inventory exposed';end if;
 if not has_function_privilege('service_role','public.translation_admin_language_inventory()','execute') then raise exception 'service role missing inventory';end if;
end$$;

set role service_role;
select set_config('request.jwt.claim.role','service_role',false);
select public.translation_admin_sync_ui_catalog(array['es','en','pt']);
select (public.translation_admin_create_language('fr','French','Français',30,'00000000-0000-0000-0000-000000000001')).code;
do $$declare r public.languages%rowtype;begin select * into r from public.languages where code='fr';if r.is_active or r.publication_status<>'draft' or r.ui_catalog_available then raise exception 'unsafe create defaults';end if;end$$;

-- Publicar sin catálogo UI/SEO falla y no deja cambios parciales.
do $$declare v bigint;begin select lock_version into v from public.languages where code='fr';begin perform public.translation_admin_set_language_state('fr',v,true,'published',false,'00000000-0000-0000-0000-000000000001');raise exception 'publish unexpectedly succeeded';exception when sqlstate '22023' then null;end;end$$;
do $$begin if exists(select 1 from public.languages where code='fr' and (is_active or publication_status<>'draft')) then raise exception 'failed transaction persisted';end if;end$$;

-- El worker informa compatibilidad y habilita auto_translate solo después.
select public.translation_worker_report_languages(array['es','en','pt','fr']);
do $$declare v bigint;begin select lock_version into v from public.languages where code='fr';perform public.translation_admin_update_language('fr',v,'French','Français',30,true,true,'00000000-0000-0000-0000-000000000001');end$$;
do $$begin update public.languages set ui_catalog_available=true where code='fr';end$$;
do $$declare v bigint;begin select lock_version into v from public.languages where code='fr';perform public.translation_admin_set_language_state('fr',v,true,'ready',false,'00000000-0000-0000-0000-000000000001');end$$;

-- Control de concurrencia.
do $$declare v bigint;begin select lock_version-1 into v from public.languages where code='fr';begin perform public.translation_admin_update_language('fr',v,'X','X',30,false,true,'00000000-0000-0000-0000-000000000001');raise exception 'stale write succeeded';exception when sqlstate '40001' then null;end;end$$;

-- Idioma fuente y publicados están protegidos.
do $$declare v bigint;begin select lock_version into v from public.languages where code='es';begin perform public.translation_admin_set_language_state('es',v,false,'draft',true,'00000000-0000-0000-0000-000000000001');raise exception 'source disabled';exception when sqlstate '42501' then null;end;end$$;
do $$declare v bigint;begin select lock_version into v from public.languages where code='en';begin perform public.translation_admin_set_language_state('en',v,false,'ready',false,'00000000-0000-0000-0000-000000000001');raise exception 'published withdrawn without confirmation';exception when sqlstate '22023' then null;end;end$$;

-- Dependencias bloquean DELETE y permanecen intactas.
insert into public.translation_field_state(resource_type,resource_id,field_name,source_language,target_language,status) values('site_content','home.title','value','es','fr','missing');
do $$declare v bigint;begin update public.languages set is_active=false,auto_translate=false where code='fr';select lock_version into v from public.languages where code='fr';begin perform public.translation_admin_delete_language('fr',v,'00000000-0000-0000-0000-000000000001');raise exception 'dependent language deleted';exception when sqlstate '23503' then null;end;end$$;
do $$begin if not exists(select 1 from public.languages where code='fr') or not exists(select 1 from public.translation_field_state where target_language='fr') then raise exception 'dependency changed';end if;end$$;

reset role;
set role anon;
select set_config('request.jwt.claim.role','anon',false);
do $$begin begin perform public.translation_admin_language_inventory();raise exception 'anon unexpectedly executed inventory';exception when insufficient_privilege then null;end;end$$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
do $$begin begin perform public.translation_admin_create_language('de','German','Deutsch',40,'00000000-0000-0000-0000-000000000001');raise exception 'authenticated unexpectedly created language';exception when insufficient_privilege then null;end;end$$;
reset role;
select set_config('request.jwt.claim.role','service_role',false);

do $$begin
 if (select count(*) from public.languages where code in('es','en','pt') and publication_status='published' and is_active and ui_catalog_available and seo_ready)<>3 then raise exception 'existing public languages changed';end if;
 if (select count(*) from public.translation_jobs)<>0 then raise exception 'jobs were created';end if;
 if (select count(*) from public.admin_audit_log)<>3 then raise exception 'unexpected audit count';end if;
end$$;
