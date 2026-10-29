do $$begin
  if to_regclass('public.translation_initial_load_runs') is not null or to_regclass('public.translation_initial_load_groups') is not null then raise exception 'Las tablas temporales persisten';end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'translation_initial_load_%') then raise exception 'Las RPC temporales persisten';end if;
end$$;
select 'translation_initial_load_cleanup_postcheck: PASS' result;
