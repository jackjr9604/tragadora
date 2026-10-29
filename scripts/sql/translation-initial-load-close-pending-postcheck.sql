do $$declare fn regprocedure:='public.translation_initial_load_close_pending(uuid,jsonb)'::regprocedure;definition text;begin
 select pg_get_functiondef(fn) into definition;
 if definition not ilike '%translation_save_draft%' or definition not ilike '%translation_submit_review%' or definition not ilike '%translation_approve_draft%' or definition not ilike '%translation_publish_draft%' then raise exception 'Transiciones editoriales incompletas';end if;
 if not (select prosecdef from pg_proc where oid=fn) then raise exception 'SECURITY DEFINER ausente';end if;
 if not has_function_privilege('service_role',fn,'execute') or has_function_privilege('anon',fn,'execute') or has_function_privilege('authenticated',fn,'execute') then raise exception 'ACL insegura';end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.platform_translations'::regclass and tgname='translation_platform_publish_defaults' and tgenabled<>'D' and not tgisinternal) then raise exception 'Guard de publicación de plataformas ausente';end if;
end$$;
select 'translation_initial_load_close_pending_postcheck: PASS' result;
