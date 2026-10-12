\set ON_ERROR_STOP on

do $$ begin
 if(select count(*) from public.translation_field_state where resource_type='blog_post_translation')<>20 then raise exception 'Metadata 3D.5 inesperada';end if;
 if exists(select 1 from public.blog_post_translations) then raise exception 'Inicialización escribió traducciones';end if;
 if exists(select 1 from public.translation_jobs where resource_type='blog_post_translation') then raise exception 'Inicialización creó jobs';end if;
end $$;

insert into public.blog_posts(slug,title,excerpt,body_markdown,category,tags,status) values('trigger-post','Prueba trigger','Texto fuente','# Fuente','Noticias',array['uno','dos'],'draft');
do $$ begin
 if(select count(*) from public.translation_field_state where resource_type='blog_post_translation' and resource_id=(select id::text from public.blog_posts where slug='trigger-post'))<>10 then raise exception 'INSERT no registró cinco campos para EN/PT';end if;
end $$;

set role authenticated;select set_config('app.test_permissions','',false);
do $$ begin
 if(select count(*) from public.blog_post_translations)<>0 then raise exception 'RLS expuso traducciones sin permiso';end if;
 begin perform public.translation_save_manual('blog_post_translation',(select id::text from public.blog_posts limit 1),'title','en',to_jsonb('Title'::text),true);raise exception 'Escritura RPC sin permiso aceptada';exception when insufficient_privilege then null;end;
 begin insert into public.blog_post_translations(blog_post_id,language,title) values((select id from public.blog_posts limit 1),'en','Directa');raise exception 'Escritura directa aceptada';exception when insufficient_privilege then null;end;
end $$;
reset role;

select set_config('app.test_permissions','blog.update',false);
select public.translation_save_manual('blog_post_translation',(select id::text from public.blog_posts where slug='market-guide'),'title','en',to_jsonb('Market guide'::text),true);
select public.translation_save_manual('blog_post_translation',(select id::text from public.blog_posts where slug='market-guide'),'excerpt','en',to_jsonb('A practical guide'::text),true);
select public.translation_save_manual('blog_post_translation',(select id::text from public.blog_posts where slug='market-guide'),'body_markdown','en',to_jsonb(E'# Guide\n\nUse `const risk = 1` and visit [Tools](/herramientas?lang=en).\n\n![Chart](https://example.com/chart.png)'::text),true);
select public.translation_save_manual('blog_post_translation',(select id::text from public.blog_posts where slug='market-guide'),'category','en',to_jsonb('Education'::text),true);
select public.translation_save_manual('blog_post_translation',(select id::text from public.blog_posts where slug='market-guide'),'tags','en','["markets","risk"]'::jsonb,true);

do $$ declare expected text:=E'# Guide\n\nUse `const risk = 1` and visit [Tools](/herramientas?lang=en).\n\n![Chart](https://example.com/chart.png)'; begin
 if(select body_markdown from public.blog_post_translations where blog_post_id=(select id from public.blog_posts where slug='market-guide') and language='en')<>expected then raise exception 'Alteró Markdown traducido';end if;
 if(select tags from public.blog_post_translations where blog_post_id=(select id from public.blog_posts where slug='market-guide') and language='en')<>'["markets","risk"]'::jsonb then raise exception 'No guardó tags JSONB';end if;
 if not(select is_protected from public.translation_field_state where resource_type='blog_post_translation' and resource_id=(select id::text from public.blog_posts where slug='market-guide') and field_name='body_markdown' and target_language='en') then raise exception 'No protegió traducción';end if;
 begin perform public.translation_write_value('blog_post_translation',(select id::text from public.blog_posts limit 1),'title','en','["bad"]'::jsonb,null);raise exception 'Aceptó texto no string';exception when sqlstate '22023' then null;end;
 begin perform public.translation_write_value('blog_post_translation',(select id::text from public.blog_posts limit 1),'tags','en','["ok",2]'::jsonb,null);raise exception 'Aceptó tags no string';exception when sqlstate '22023' then null;end;
 begin perform public.translation_write_value('blog_post_translation',(select id::text from public.blog_posts limit 1),'tags','en','[]'::jsonb,null);raise exception 'Aceptó tags vacíos';exception when sqlstate '22023' then null;end;
end $$;

set role authenticated;select set_config('app.test_permissions','blog.view',false);
do $$ begin if(select count(*) from public.blog_post_translations)<>1 then raise exception 'RLS no permitió lectura con blog.view';end if;end $$;
reset role;

create temporary table blog_integrity_before as select id,slug,author_name,is_featured,status,published_at,cover_media_id from public.blog_posts;
update public.blog_posts set title='Guía actualizada' where slug='market-guide';
do $$ begin
 if(select status from public.translation_field_state where resource_type='blog_post_translation' and resource_id=(select id::text from public.blog_posts where slug='market-guide') and field_name='title' and target_language='en')<>'stale' then raise exception 'No marcó stale';end if;
 if(select title from public.blog_post_translations where blog_post_id=(select id from public.blog_posts where slug='market-guide') and language='en')<>'Market guide' then raise exception 'Sobrescribió traducción protegida';end if;
 if exists(select 1 from public.blog_posts p join blog_integrity_before b using(id) where (p.slug,p.author_name,p.is_featured,p.status,p.published_at,p.cover_media_id) is distinct from (b.slug,b.author_name,b.is_featured,b.status,b.published_at,b.cover_media_id)) then raise exception 'Alteró identidad o publicación';end if;
end $$;

-- Compatibilidad con adaptadores anteriores.
select set_config('app.test_permissions','giveaways.update',false);
select public.translation_save_manual('giveaway_translation',(select id::text from public.giveaways where slug='annual-giveaway'),'badge','en',to_jsonb('Featured after 3D.5'::text),true);
select set_config('app.test_permissions','communities.update',false);
select public.translation_save_manual('community_translation',(select id::text from public.communities where slug='futures-hub'),'badge','en',to_jsonb('Featured after 3D.5'::text),true);
select set_config('app.test_permissions','tools.update',false);
select public.translation_save_manual('tool_translation',(select id::text from public.tools where slug='risk-calculator'),'badge','en',to_jsonb('Own after 3D.5'::text),true);
select set_config('app.test_permissions','platforms.update',false);
select public.translation_save_manual('broker_detail_translation',(select platform_id::text from public.broker_details limit 1),'regulation_summary','en',to_jsonb('Broker after 3D.5'::text),true);

create temporary table deleted_post as select id from public.blog_posts where slug='risk-notes';
delete from public.blog_posts where slug='risk-notes';
do $$ begin
 if exists(select 1 from public.translation_field_state where resource_type='blog_post_translation' and resource_id=(select id::text from deleted_post) and status<>'error') then raise exception 'DELETE no invalidó estados';end if;
 if has_function_privilege('anon','public.translation_read_value_before_blog(text,text,text,text)','EXECUTE') or has_function_privilege('authenticated','public.translation_read_value_before_blog(text,text,text,text)','EXECUTE') or has_function_privilege('anon','public.translation_write_value_before_blog(text,text,text,text,jsonb,uuid)','EXECUTE') or has_function_privilege('authenticated','public.translation_write_value_before_blog(text,text,text,text,jsonb,uuid)','EXECUTE') or has_function_privilege('anon','public.translation_write_blog_value(text,text,text,jsonb)','EXECUTE') then raise exception 'Helper expuesto';end if;
end $$;
