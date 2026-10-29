do $$begin
 if pg_get_functiondef('public.translation_initial_load_publish(uuid,integer)'::regprocedure) not ilike '%translation_editor_publish_batch%' then raise exception 'Seed atómico ausente';end if;
 if pg_get_functiondef('public.translation_invalidate_direct_target_edit(text,text,text,text,boolean)'::regprocedure) not ilike '%translation_editor_publish_batch%' then raise exception 'Guard de lote ausente';end if;
end$$;
select 'translation_initial_load_platform_seed_postcheck: PASS' result;
