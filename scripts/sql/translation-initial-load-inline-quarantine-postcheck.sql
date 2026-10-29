do $$
declare fn regprocedure:='public.translation_initial_load_publish(uuid,integer)'::regprocedure;definition text;
begin
 select pg_get_functiondef(fn) into definition;
 if definition not ilike '%initial_load_publish_revalidation_failed%' or definition not ilike '%quarantined_count%' then raise exception 'Cuarentena inline ausente';end if;
 if not (select prosecdef from pg_proc where oid=fn) then raise exception 'SECURITY DEFINER ausente';end if;
 if not has_function_privilege('service_role',fn,'execute') or has_function_privilege('anon',fn,'execute') or has_function_privilege('authenticated',fn,'execute') then raise exception 'ACL insegura';end if;
end$$;
select 'translation_initial_load_inline_quarantine_postcheck: PASS' result;
