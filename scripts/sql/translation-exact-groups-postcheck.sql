\set ON_ERROR_STOP on

do $$ declare fn regprocedure;begin
  foreach fn in array array[
    'public.translation_admin_exact_group_inventory(text[],text,text,text,text,text,integer,integer)'::regprocedure,
    'public.translation_admin_exact_group_members(text[],text,text,text,text,integer,integer)'::regprocedure,
    'public.translation_admin_apply_exact_group_proposal(uuid,bigint,jsonb)'::regprocedure
  ] loop
    if not exists(select 1 from pg_proc where oid=fn and prosecdef and proconfig@>array['search_path=pg_catalog, public']) then raise exception 'Seguridad incorrecta: %',fn;end if;
    if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where p.oid=fn and acl.grantee=0 and acl.privilege_type='EXECUTE') or has_function_privilege('anon',fn,'EXECUTE') then raise exception 'Grant inseguro: %',fn;end if;
  end loop;
  if not has_function_privilege('service_role','public.translation_admin_exact_group_inventory(text[],text,text,text,text,text,integer,integer)','EXECUTE') or has_function_privilege('authenticated','public.translation_admin_exact_group_inventory(text[],text,text,text,text,text,integer,integer)','EXECUTE') then raise exception 'ACL de inventario incorrecta';end if;
  if not has_function_privilege('authenticated','public.translation_admin_apply_exact_group_proposal(uuid,bigint,jsonb)','EXECUTE') or has_function_privilege('service_role','public.translation_admin_apply_exact_group_proposal(uuid,bigint,jsonb)','EXECUTE') then raise exception 'ACL de mutación incorrecta';end if;
  if to_regclass('public.translation_field_state_exact_group_idx') is null then raise exception 'Falta índice exacto';end if;
end $$;
select 'translation_exact_groups_postcheck: PASS' result;
