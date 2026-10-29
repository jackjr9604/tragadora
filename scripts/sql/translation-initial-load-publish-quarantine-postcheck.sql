do $$declare fn regprocedure:='public.translation_initial_load_quarantine_publish_failures(uuid)'::regprocedure;begin
 if not (select prosecdef from pg_proc where oid=fn) then raise exception 'SECURITY DEFINER ausente';end if;
 if not has_function_privilege('service_role',fn,'execute') or has_function_privilege('anon',fn,'execute') or has_function_privilege('authenticated',fn,'execute') then raise exception 'ACL insegura';end if;
end$$;
select 'translation_initial_load_publish_quarantine_postcheck: PASS' result;
