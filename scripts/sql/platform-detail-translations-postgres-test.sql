\set ON_ERROR_STOP on

do $$ begin
  if (select count(*) from public.translation_field_state where resource_type='broker_detail_translation')<>2 then
    raise exception 'Broker no inicializó dos destinos para un campo';
  end if;
  if (select count(*) from public.translation_field_state where resource_type='exchange_detail_translation')<>4 then
    raise exception 'Exchange no inicializó dos destinos para dos campos';
  end if;
  if exists(select 1 from public.broker_detail_translations) or exists(select 1 from public.exchange_detail_translations) then
    raise exception 'La inicialización escribió traducciones';
  end if;
  if exists(select 1 from public.translation_jobs where resource_type in ('broker_detail_translation','exchange_detail_translation')) then
    raise exception 'La inicialización creó jobs';
  end if;
end $$;

-- Los adaptadores de Bloques 2, 3B y 3C deben conservar su comportamiento.
insert into public.site_content(key,language,value,type) values('test.3d1.compatibility','es','Fuente ES','text');
select set_config('app.test_permissions','content.update',false);
select public.translation_save_manual('site_content','test.3d1.compatibility','value','en',to_jsonb('English value'::text),true);
select set_config('app.test_permissions','offers.update',false);
select public.translation_save_manual('offer_translation',(select id::text from public.offers limit 1),'title','en',to_jsonb('Translated offer'::text),true);
select set_config('app.test_permissions','challenges.update',false);
select public.translation_save_manual('challenge_phase_translation',(select id::text from public.challenge_phases limit 1),'name','en',to_jsonb('Evaluation'::text),true);

set role authenticated;
select set_config('app.test_permissions','',false);
do $$ begin
  begin
    perform public.translation_save_manual('broker_detail_translation',(select platform_id::text from public.broker_details limit 1),'regulation_summary','en',to_jsonb('Regulated'::text),true);
    raise exception 'La escritura sin platforms.update no fue rechazada';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('app.test_permissions','platforms.update',false);
select public.translation_save_manual('broker_detail_translation',(select platform_id::text from public.broker_details limit 1),'regulation_summary','en',to_jsonb('Regulated in two jurisdictions'::text),true);
select public.translation_save_manual('exchange_detail_translation',(select platform_id::text from public.exchange_details limit 1),'product_summary','en',to_jsonb('Spot and futures'::text),true);
select public.translation_save_manual('exchange_detail_translation',(select platform_id::text from public.exchange_details limit 1),'regulation_summary','pt',to_jsonb('Exchange licenciado'::text),true);

do $$ begin
  if (select regulation_summary from public.broker_detail_translations where language='en')<>'Regulated in two jurisdictions' then raise exception 'No guardó broker EN'; end if;
  if (select product_summary from public.exchange_detail_translations where language='en')<>'Spot and futures' then raise exception 'No guardó exchange EN'; end if;
  if not (select is_protected from public.translation_field_state where resource_type='broker_detail_translation' and target_language='en') then raise exception 'No protegió traducción manual'; end if;
  begin
    perform public.translation_write_value('exchange_detail_translation',(select platform_id::text from public.exchange_details limit 1),'product_summary','en','["invalid"]'::jsonb,null);
    raise exception 'Aceptó JSONB no string';
  exception when sqlstate '22023' then null; end;
end $$;

update public.broker_details set regulation_summary='Regulación actualizada';
do $$ begin
  if (select status from public.translation_field_state where resource_type='broker_detail_translation' and target_language='en')<>'stale' then raise exception 'No marcó broker stale'; end if;
  if (select regulation_summary from public.broker_detail_translations where language='en')<>'Regulated in two jurisdictions' then raise exception 'Sobrescribió traducción protegida'; end if;
end $$;

update public.exchange_details set product_summary='Spot, futuros y opciones';
do $$ begin
  if (select status from public.translation_field_state where resource_type='exchange_detail_translation' and field_name='product_summary' and target_language='en')<>'stale' then raise exception 'No marcó producto stale'; end if;
end $$;

create temporary table deleted_exchange as select platform_id from public.exchange_details;
delete from public.exchange_details;
do $$ begin
  if exists(select 1 from public.translation_field_state where resource_type='exchange_detail_translation' and resource_id=(select platform_id::text from deleted_exchange) and status<>'error') then raise exception 'DELETE no invalidó estados'; end if;
  if has_function_privilege('anon','public.translation_read_value_before_platform_details(text,text,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.translation_read_value_before_platform_details(text,text,text,text)','EXECUTE')
    or has_function_privilege('anon','public.translation_write_value_before_platform_details(text,text,text,text,jsonb,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.translation_write_value_before_platform_details(text,text,text,text,jsonb,uuid)','EXECUTE')
    or has_function_privilege('anon','public.translation_write_platform_detail_value(text,text,text,text,jsonb)','EXECUTE') then
    raise exception 'Helper SECURITY DEFINER expuesto';
  end if;
end $$;
