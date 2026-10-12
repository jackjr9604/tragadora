\set ON_ERROR_STOP on

do $$ begin
  if (select count(*) from public.translation_field_state where resource_type='tool_translation')<>34 then
    raise exception 'Metadata inesperada para tool_translation: %',(select count(*) from public.translation_field_state where resource_type='tool_translation');
  end if;
  if exists(select 1 from public.tool_translations) then raise exception 'La inicialización escribió traducciones'; end if;
  if exists(select 1 from public.translation_jobs where resource_type='tool_translation') then raise exception 'La inicialización creó jobs'; end if;
end $$;

set role authenticated;
select set_config('app.test_permissions','',false);
do $$ begin
  begin
    perform public.translation_save_manual('tool_translation',(select id::text from public.tools where slug='risk-calculator'),'short_description','en',to_jsonb('Calculate risk'::text),true);
    raise exception 'Escritura sin tools.update no rechazada';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('app.test_permissions','tools.update',false);
select public.translation_save_manual('tool_translation',(select id::text from public.tools where slug='risk-calculator'),'name','en',to_jsonb('Risk calculator'::text),true);
select public.translation_save_manual('tool_translation',(select id::text from public.tools where slug='risk-calculator'),'short_description','en',to_jsonb('Calculate risk'::text),true);
select public.translation_save_manual('tool_translation',(select id::text from public.tools where slug='risk-calculator'),'category_label','pt',to_jsonb('Risco'::text),true);
select public.translation_save_manual('tool_translation',(select id::text from public.tools where slug='external-brand'),'short_description','en',to_jsonb('Charting tool'::text),true);

do $$ begin
  if (select name from public.tool_translations where tool_id=(select id from public.tools where slug='risk-calculator') and language='en')<>'Risk calculator' then raise exception 'No guardó name EN'; end if;
  if not (select is_protected from public.translation_field_state where resource_type='tool_translation' and resource_id=(select id::text from public.tools where slug='risk-calculator') and field_name='name' and target_language='en') then raise exception 'No protegió traducción manual'; end if;
  begin
    perform public.translation_write_value('tool_translation',(select id::text from public.tools where slug='external-brand'),'name','en',to_jsonb('Translated brand'::text),null);
    raise exception 'Permitió traducir marca externa';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.translation_write_value('tool_translation',(select id::text from public.tools where slug='risk-calculator'),'badge','en','["invalid"]'::jsonb,null);
    raise exception 'Aceptó JSONB no string';
  exception when sqlstate '22023' then null; end;
end $$;

update public.tools set short_description='Riesgo actualizado' where slug='risk-calculator';
do $$ begin
  if (select status from public.translation_field_state where resource_type='tool_translation' and resource_id=(select id::text from public.tools where slug='risk-calculator') and field_name='short_description' and target_language='en')<>'stale' then raise exception 'No marcó stale'; end if;
  if (select short_description from public.tool_translations where tool_id=(select id from public.tools where slug='risk-calculator') and language='en')<>'Calculate risk' then raise exception 'Sobrescribió traducción protegida'; end if;
end $$;

-- La categoría estable no cambia: solo cambia su etiqueta traducida.
do $$ begin
  if (select category from public.tools where slug='risk-calculator')<>'risk' then raise exception 'Modificó identidad de categoría'; end if;
  if (select category_label from public.tool_translations where tool_id=(select id from public.tools where slug='risk-calculator') and language='pt')<>'Risco' then raise exception 'No conservó etiqueta localizada'; end if;
end $$;

-- Compatibilidad de adaptadores anteriores.
insert into public.site_content(key,language,value,type) values('test.3d2.compatibility','es','Fuente ES','text');
select set_config('app.test_permissions','content.update',false);
select public.translation_save_manual('site_content','test.3d2.compatibility','value','en',to_jsonb('English'::text),true);
select set_config('app.test_permissions','offers.update',false);
select public.translation_save_manual('offer_translation',(select id::text from public.offers limit 1),'title','en',to_jsonb('Offer EN'::text),true);
select set_config('app.test_permissions','challenges.update',false);
select public.translation_save_manual('challenge_phase_translation',(select id::text from public.challenge_phases limit 1),'name','en',to_jsonb('Phase EN'::text),true);
select set_config('app.test_permissions','platforms.update',false);
select public.translation_save_manual('broker_detail_translation',(select platform_id::text from public.broker_details limit 1),'regulation_summary','en',to_jsonb('Broker EN'::text),true);

create temporary table deleted_tool as select id from public.tools where slug='external-brand';
delete from public.tools where slug='external-brand';
do $$ begin
  if exists(select 1 from public.translation_field_state where resource_type='tool_translation' and resource_id=(select id::text from deleted_tool) and status<>'error') then raise exception 'DELETE no invalidó estados'; end if;
  if has_function_privilege('anon','public.translation_read_value_before_tools(text,text,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.translation_read_value_before_tools(text,text,text,text)','EXECUTE')
    or has_function_privilege('anon','public.translation_write_value_before_tools(text,text,text,text,jsonb,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.translation_write_value_before_tools(text,text,text,text,jsonb,uuid)','EXECUTE')
    or has_function_privilege('anon','public.translation_write_tool_value(text,text,text,jsonb)','EXECUTE') then
    raise exception 'Helper SECURITY DEFINER expuesto';
  end if;
end $$;
