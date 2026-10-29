do $$
declare signature text;owner_name text;is_definer boolean;settings text[];public_execute boolean;
begin
  if not (select relrowsecurity from pg_class where oid='public.translation_initial_load_runs'::regclass) or not (select relrowsecurity from pg_class where oid='public.translation_initial_load_groups'::regclass) then raise exception 'RLS temporal ausente';end if;
  foreach signature in array array[
    'public.translation_initial_load_start(uuid,uuid,integer,bigint)','public.translation_initial_load_enqueue(uuid,integer)',
    'public.translation_initial_load_refresh(uuid)','public.translation_initial_load_qa_candidates(uuid,integer)',
    'public.translation_initial_load_record_qa(uuid,text,text,text,text,text,text[])','public.translation_initial_load_fanout(uuid,integer,integer)',
    'public.translation_initial_load_status(uuid)','public.translation_initial_load_finish(uuid)'] loop
    select r.rolname,p.prosecdef,p.proconfig,exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') into owner_name,is_definer,settings,public_execute from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid=signature::regprocedure;
    if owner_name<>'postgres' or not is_definer or not ('search_path=pg_catalog, public'=any(settings)) then raise exception 'Seguridad incorrecta: %',signature;end if;
    if not has_function_privilege('service_role',signature,'EXECUTE') or has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE') or public_execute then raise exception 'ACL incorrecta: %',signature;end if;
  end loop;
  if has_table_privilege('service_role','public.translation_initial_load_runs','SELECT') or has_table_privilege('authenticated','public.translation_initial_load_groups','SELECT') then raise exception 'Tablas operativas expuestas';end if;
end $$;
select 'translation_initial_load_postcheck: PASS' result;
