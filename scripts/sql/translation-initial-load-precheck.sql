do $$
declare name text;
begin
  foreach name in array array['translation_field_state','translation_jobs','admin_audit_log','profiles'] loop
    if to_regclass('public.'||name) is null then raise exception 'Dependencia ausente: %',name;end if;
  end loop;
  if to_regprocedure('public.translation_effective_source_language(text,text)') is null or to_regprocedure('public.translation_read_value(text,text,text,text)') is null or to_regprocedure('public.translation_validate_editor_value(text,text,jsonb)') is null or to_regprocedure('public.translation_admin_apply_exact_group_proposal(uuid,bigint,jsonb)') is null then raise exception 'Helpers editoriales incompletos';end if;
  if to_regclass('public.translation_initial_load_runs') is not null or to_regprocedure('public.translation_initial_load_start(uuid,uuid,integer,bigint)') is not null then raise exception 'La infraestructura temporal ya existe';end if;
end $$;
select 'translation_initial_load_precheck: PASS' result;
