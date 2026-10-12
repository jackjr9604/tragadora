\set ON_ERROR_STOP on

do $$ begin
 if(select count(*) from public.translation_field_state where resource_type='community_translation')<>16 then raise exception 'Metadata 3D.3 inesperada';end if;
 if exists(select 1 from public.community_translations) then raise exception 'Inicialización escribió traducciones';end if;
 if exists(select 1 from public.translation_jobs where resource_type='community_translation') then raise exception 'Inicialización creó jobs';end if;
end $$;

set role authenticated;select set_config('app.test_permissions','',false);
do $$ begin begin perform public.translation_save_manual('community_translation',(select id::text from public.communities limit 1),'badge','en',to_jsonb('Featured'::text),true);raise exception 'Escritura sin permiso aceptada';exception when insufficient_privilege then null;end;end $$;
reset role;

select set_config('app.test_permissions','communities.update',false);
select public.translation_save_manual('community_translation',(select id::text from public.communities where slug='futures-hub'),'short_description','en',to_jsonb('Futures community'::text),true);
select public.translation_save_manual('community_translation',(select id::text from public.communities where slug='futures-hub'),'category_label','pt',to_jsonb('Educação'::text),true);
select public.translation_save_manual('community_translation',(select id::text from public.communities where slug='futures-hub'),'region_label','en',to_jsonb('Worldwide'::text),true);
select public.translation_save_manual('community_translation',(select id::text from public.communities where slug='futures-hub'),'badge','en',to_jsonb('Featured'::text),true);
do $$ begin
 if(select short_description from public.community_translations where community_id=(select id from public.communities where slug='futures-hub') and language='en')<>'Futures community' then raise exception 'No guardó traducción';end if;
 if not(select is_protected from public.translation_field_state where resource_type='community_translation' and resource_id=(select id::text from public.communities where slug='futures-hub') and field_name='badge' and target_language='en') then raise exception 'No protegió traducción';end if;
 begin perform public.translation_write_value('community_translation',(select id::text from public.communities limit 1),'badge','en','["bad"]'::jsonb,null);raise exception 'Aceptó tipo inválido';exception when sqlstate '22023' then null;end;
end $$;

update public.communities set short_description='Descripción actualizada' where slug='futures-hub';
do $$ begin
 if(select status from public.translation_field_state where resource_type='community_translation' and resource_id=(select id::text from public.communities where slug='futures-hub') and field_name='short_description' and target_language='en')<>'stale' then raise exception 'No marcó stale';end if;
 if(select short_description from public.community_translations where community_id=(select id from public.communities where slug='futures-hub') and language='en')<>'Futures community' then raise exception 'Sobrescribió traducción protegida';end if;
 if(select category from public.communities where slug='futures-hub')<>'education' then raise exception 'Alteró categoría estable';end if;
end $$;

-- Compatibilidad con adaptadores anteriores.
select set_config('app.test_permissions','tools.update',false);
select public.translation_save_manual('tool_translation',(select id::text from public.tools where slug='risk-calculator'),'badge','en',to_jsonb('Own'::text),true);
select set_config('app.test_permissions','platforms.update',false);
select public.translation_save_manual('broker_detail_translation',(select platform_id::text from public.broker_details limit 1),'regulation_summary','en',to_jsonb('Broker EN'::text),true);

create temporary table deleted_community as select id from public.communities where slug='trading-forum';
delete from public.communities where slug='trading-forum';
do $$ begin
 if exists(select 1 from public.translation_field_state where resource_type='community_translation' and resource_id=(select id::text from deleted_community) and status<>'error') then raise exception 'DELETE no invalidó estados';end if;
 if has_function_privilege('anon','public.translation_read_value_before_communities(text,text,text,text)','EXECUTE') or has_function_privilege('authenticated','public.translation_read_value_before_communities(text,text,text,text)','EXECUTE') or has_function_privilege('anon','public.translation_write_value_before_communities(text,text,text,text,jsonb,uuid)','EXECUTE') or has_function_privilege('authenticated','public.translation_write_value_before_communities(text,text,text,text,jsonb,uuid)','EXECUTE') or has_function_privilege('anon','public.translation_write_community_value(text,text,text,jsonb)','EXECUTE') then raise exception 'Helper expuesto';end if;
end $$;
