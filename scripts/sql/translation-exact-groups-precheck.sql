\set ON_ERROR_STOP on

do $$ begin
  if current_setting('server_version_num')::integer/10000 not in(15,17) then raise exception 'PostgreSQL no validado: %',version();end if;
  if to_regclass('public.translation_field_state') is null or to_regclass('public.translation_jobs') is null or to_regclass('public.translation_resource_types') is null then raise exception 'Faltan dependencias de traducción';end if;
  if to_regprocedure('public.translation_effective_source_language(text,text)') is null or to_regprocedure('public.translation_read_value(text,text,text,text)') is null or to_regprocedure('public.translation_validate_editor_value(text,text,jsonb)') is null then raise exception 'Faltan helpers previos';end if;
  if to_regprocedure('public.translation_admin_exact_group_inventory(text[],text,text,text,text,text,integer,integer)') is not null or to_regprocedure('public.translation_admin_exact_group_members(text[],text,text,text,text,integer,integer)') is not null or to_regprocedure('public.translation_admin_apply_exact_group_proposal(uuid,bigint,jsonb)') is not null then raise exception 'Las RPC exactas ya existen';end if;
end $$;
select 'translation_exact_groups_precheck: PASS' result;
