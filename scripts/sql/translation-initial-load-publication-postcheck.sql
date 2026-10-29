do $$
declare fn regprocedure:='public.translation_initial_load_publish(uuid,integer)'::regprocedure;
begin
  if not (select prosecdef from pg_proc where oid=fn) then raise exception 'SECURITY DEFINER ausente';end if;
  if not exists(select 1 from pg_proc p cross join lateral unnest(coalesce(p.proconfig,'{}')) c where p.oid=fn and regexp_replace(c,'\s+','','g')='search_path=pg_catalog,public') then raise exception 'search_path inseguro';end if;
  if not has_function_privilege('service_role',fn,'execute') or has_function_privilege('anon',fn,'execute') or has_function_privilege('authenticated',fn,'execute') then raise exception 'ACL insegura';end if;
end $$;
select 'translation_initial_load_publication_postcheck: PASS' result;
