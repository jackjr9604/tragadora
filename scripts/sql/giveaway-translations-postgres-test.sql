\set ON_ERROR_STOP on

do $$ begin
 if(select count(*) from public.translation_field_state where resource_type='giveaway_translation')<>22 then raise exception 'Metadata 3D.4 inesperada';end if;
 if exists(select 1 from public.giveaway_translations) then raise exception 'Inicialización escribió traducciones';end if;
 if exists(select 1 from public.translation_jobs where resource_type='giveaway_translation') then raise exception 'Inicialización creó jobs';end if;
end $$;

insert into public.giveaways(slug,title,short_description,prize_title,prize_description,starts_at,ends_at,badge,reveal_title,reveal_content,status)
values('trigger-giveaway','Prueba trigger','Texto fuente','Premio trigger','Descripción trigger',now(),now()+interval '1 day','Nueva','Resultado','Contenido','draft');
do $$ begin
 if(select count(*) from public.translation_field_state where resource_type='giveaway_translation' and resource_id=(select id::text from public.giveaways where slug='trigger-giveaway'))<>14 then raise exception 'INSERT no registró los siete campos para EN/PT';end if;
end $$;

set role authenticated;select set_config('app.test_permissions','',false);
do $$ begin
 if(select count(*) from public.giveaway_translations)<>0 then raise exception 'RLS expuso traducciones sin permiso';end if;
 begin perform public.translation_save_manual('giveaway_translation',(select id::text from public.giveaways limit 1),'title','en',to_jsonb('Annual giveaway'::text),true);raise exception 'Escritura RPC sin permiso aceptada';exception when insufficient_privilege then null;end;
 begin insert into public.giveaway_translations(giveaway_id,language,title) values((select id from public.giveaways limit 1),'en','Directa');raise exception 'Escritura directa aceptada';exception when insufficient_privilege then null;end;
end $$;
reset role;

select set_config('app.test_permissions','giveaways.update',false);
select public.translation_save_manual('giveaway_translation',(select id::text from public.giveaways where slug='annual-giveaway'),'title','en',to_jsonb('Annual giveaway'::text),true);
select public.translation_save_manual('giveaway_translation',(select id::text from public.giveaways where slug='annual-giveaway'),'short_description','pt',to_jsonb('Participe agora'::text),true);
select public.translation_save_manual('giveaway_translation',(select id::text from public.giveaways where slug='annual-giveaway'),'prize_title','en',to_jsonb('Funded account'::text),true);
select public.translation_save_manual('giveaway_translation',(select id::text from public.giveaways where slug='annual-giveaway'),'reveal_content','en',to_jsonb('Official result'::text),true);
do $$ begin
 if(select title from public.giveaway_translations where giveaway_id=(select id from public.giveaways where slug='annual-giveaway') and language='en')<>'Annual giveaway' then raise exception 'No guardó traducción';end if;
 if not(select is_protected from public.translation_field_state where resource_type='giveaway_translation' and resource_id=(select id::text from public.giveaways where slug='annual-giveaway') and field_name='title' and target_language='en') then raise exception 'No protegió traducción';end if;
 begin perform public.translation_write_value('giveaway_translation',(select id::text from public.giveaways limit 1),'badge','en','["bad"]'::jsonb,null);raise exception 'Aceptó tipo inválido';exception when sqlstate '22023' then null;end;
end $$;

set role authenticated;select set_config('app.test_permissions','giveaways.view',false);
do $$ begin if(select count(*) from public.giveaway_translations)<>2 then raise exception 'RLS no permitió lectura con giveaways.view';end if;end $$;
reset role;

create temporary table giveaway_integrity_before as select id,slug,prize_quantity,starts_at,ends_at,participation_url,rules_url,status from public.giveaways;
update public.giveaways set title='Sorteo anual actualizado' where slug='annual-giveaway';
do $$ begin
 if(select status from public.translation_field_state where resource_type='giveaway_translation' and resource_id=(select id::text from public.giveaways where slug='annual-giveaway') and field_name='title' and target_language='en')<>'stale' then raise exception 'No marcó stale';end if;
 if(select title from public.giveaway_translations where giveaway_id=(select id from public.giveaways where slug='annual-giveaway') and language='en')<>'Annual giveaway' then raise exception 'Sobrescribió traducción protegida';end if;
 if exists(select 1 from public.giveaways g join giveaway_integrity_before b using(id) where (g.slug,g.prize_quantity,g.starts_at,g.ends_at,g.participation_url,g.rules_url,g.status) is distinct from (b.slug,b.prize_quantity,b.starts_at,b.ends_at,b.participation_url,b.rules_url,b.status)) then raise exception 'Alteró datos operativos';end if;
end $$;

-- Compatibilidad con adaptadores anteriores.
select set_config('app.test_permissions','communities.update',false);
select public.translation_save_manual('community_translation',(select id::text from public.communities where slug='futures-hub'),'badge','en',to_jsonb('Featured after 3D.4'::text),true);
select set_config('app.test_permissions','tools.update',false);
select public.translation_save_manual('tool_translation',(select id::text from public.tools where slug='risk-calculator'),'badge','en',to_jsonb('Own after 3D.4'::text),true);
select set_config('app.test_permissions','platforms.update',false);
select public.translation_save_manual('broker_detail_translation',(select platform_id::text from public.broker_details limit 1),'regulation_summary','en',to_jsonb('Broker after 3D.4'::text),true);

create temporary table deleted_giveaway as select id from public.giveaways where slug='closed-giveaway';
delete from public.giveaways where slug='closed-giveaway';
do $$ begin
 if exists(select 1 from public.translation_field_state where resource_type='giveaway_translation' and resource_id=(select id::text from deleted_giveaway) and status<>'error') then raise exception 'DELETE no invalidó estados';end if;
 if has_function_privilege('anon','public.translation_read_value_before_giveaways(text,text,text,text)','EXECUTE') or has_function_privilege('authenticated','public.translation_read_value_before_giveaways(text,text,text,text)','EXECUTE') or has_function_privilege('anon','public.translation_write_value_before_giveaways(text,text,text,text,jsonb,uuid)','EXECUTE') or has_function_privilege('authenticated','public.translation_write_value_before_giveaways(text,text,text,text,jsonb,uuid)','EXECUTE') or has_function_privilege('anon','public.translation_write_giveaway_value(text,text,text,jsonb)','EXECUTE') then raise exception 'Helper expuesto';end if;
end $$;
