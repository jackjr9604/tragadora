do $$
declare
  fn regprocedure:='public.translation_initial_load_refresh(uuid)'::regprocedure;
  definition text;
  is_security_definer boolean;
  function_config text[];
begin
  select pg_get_functiondef(p.oid),p.prosecdef,p.proconfig
  into definition,is_security_definer,function_config
  from pg_proc p where p.oid=fn;
  if definition not ilike '%for update of g skip locked%'
     or definition not ilike '%limit 200%'
     or definition not ilike '%limit 500%' then
    raise exception 'translation_initial_load_refresh no usa procesamiento por lotes';
  end if;
  if is_security_definer is distinct from true then
    raise exception 'SECURITY DEFINER incorrecto en translation_initial_load_refresh';
  end if;
  if not exists(
    select 1 from unnest(coalesce(function_config,array[]::text[])) config(value)
    where regexp_replace(config.value,'\s+','','g')='search_path=pg_catalog,public'
  ) then
    raise exception 'search_path incorrecto en translation_initial_load_refresh';
  end if;
  if not has_function_privilege('service_role',fn,'EXECUTE')
     or has_function_privilege('anon',fn,'EXECUTE')
     or has_function_privilege('authenticated',fn,'EXECUTE')
     or exists(
       select 1 from pg_proc p
       cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
       where p.oid=fn and acl.grantee=0 and acl.privilege_type='EXECUTE'
     ) then
    raise exception 'ACL incorrecta en translation_initial_load_refresh';
  end if;
end $$;

select 'translation_initial_load_refresh_batches_postcheck: PASS' result;
