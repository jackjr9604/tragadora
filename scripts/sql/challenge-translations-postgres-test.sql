\set ON_ERROR_STOP on

do $$ begin
  if (select count(*) from public.translation_field_state where resource_type in (
    'challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation',
    'account_plan_translation','challenge_reward_translation'))<>18 then
    raise exception 'La inicialización no creó los 18 estados esperados';
  end if;
  if exists(select 1 from public.challenge_phase_translations)
    or exists(select 1 from public.challenge_variant_translations)
    or exists(select 1 from public.challenge_variant_phase_translations)
    or exists(select 1 from public.account_plan_translations)
    or exists(select 1 from public.challenge_reward_translations) then
    raise exception 'La inicialización escribió traducciones';
  end if;
  if exists(select 1 from public.translation_jobs where resource_type like 'challenge_%' or resource_type='account_plan_translation') then
    raise exception 'La inicialización creó jobs';
  end if;
end $$;

-- El wrapper 3C debe conservar sin cambios los adaptadores de Bloque 2.
insert into public.site_content(key,language,value,type) values('test.3c.compatibility','es','Fuente ES','text');
select set_config('app.test_permissions','content.update',false);
select public.translation_save_manual('site_content','test.3c.compatibility','value','en',to_jsonb('English value'::text),true);
insert into public.platforms default values;
insert into public.platform_translations(platform_id,language,description)
select id,'es','Descripción fuente' from public.platforms order by id desc limit 1;
select set_config('app.test_permissions','platforms.update',false);
select public.translation_save_manual('platform_translation',(select id::text from public.platforms order by id desc limit 1),'description','en',to_jsonb('Source description'::text),true);
do $$ begin
  if (select value from public.site_content where key='test.3c.compatibility' and language='en')<>'English value' then
    raise exception 'El wrapper rompió site_content';
  end if;
  if (select description from public.platform_translations where language='en' order by platform_id desc limit 1)<>'Source description' then
    raise exception 'El wrapper rompió platform_translations';
  end if;
end $$;

set role authenticated;
select set_config('app.test_permissions','',false);
do $$ begin
  begin
    perform public.translation_save_manual('challenge_phase_translation',(select id::text from public.challenge_phases limit 1),'name','en',to_jsonb('Evaluation'::text),true);
    raise exception 'La escritura sin challenges.update no fue rechazada';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('app.test_permissions','challenges.update',false);
select public.translation_save_manual('challenge_phase_translation',(select id::text from public.challenge_phases limit 1),'name','en',to_jsonb('Evaluation'::text),true);
select public.translation_save_manual('challenge_reward_translation',(select id::text from public.challenge_reward_options limit 1),'name','pt',to_jsonb('Recompensa padrão'::text),true);
select public.translation_save_manual('account_plan_translation',(select id::text from public.account_plans limit 1),'payout_frequency','en',to_jsonb('Every 14 days'::text),true);

do $$ begin
  if (select name from public.challenge_phase_translations where language='en')<>'Evaluation' then raise exception 'No guardó fase EN'; end if;
  if (select name from public.challenge_reward_translations where language='pt')<>'Recompensa padrão' then raise exception 'No guardó reward PT'; end if;
  if (select payout_frequency from public.account_plan_translations where language='en')<>'Every 14 days' then raise exception 'No guardó plan EN'; end if;
  if not (select is_protected from public.translation_field_state where resource_type='challenge_phase_translation' and field_name='name' and target_language='en') then raise exception 'No protegió traducción manual'; end if;
  begin
    perform public.translation_write_value('challenge_phase_translation',(select id::text from public.challenge_phases limit 1),'name','en','["invalid"]'::jsonb,null);
    raise exception 'Aceptó tipo JSONB inválido';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.translation_write_value('challenge_phase_translation',(select id::text from public.challenge_phases limit 1),'name','en',to_jsonb('  '::text),null);
    raise exception 'Aceptó cadena vacía';
  exception when sqlstate '22023' then null; end;
end $$;

update public.challenge_phases set name='Evaluación actualizada' where phase_number=1;
do $$ begin
  if (select status from public.translation_field_state where resource_type='challenge_phase_translation' and field_name='name' and target_language='en')<>'stale' then raise exception 'No marcó stale'; end if;
  if (select name from public.challenge_phase_translations where language='en')<>'Evaluation' then raise exception 'Sobrescribió traducción protegida'; end if;
end $$;

insert into public.challenge_phases(challenge_id,phase_number,name,profit_target)
select id,2,'Verificación',5 from public.challenges limit 1;
do $$ begin
  if (select count(*) from public.translation_field_state s join public.challenge_phases p on p.id::text=s.resource_id where p.phase_number=2 and s.resource_type='challenge_phase_translation')<>2 then raise exception 'INSERT no registró el único campo presente para dos destinos'; end if;
end $$;

create temporary table deleted_phase as select id from public.challenge_phases where phase_number=2;
delete from public.challenge_phases where phase_number=2;
do $$ begin
  if exists(select 1 from public.translation_field_state where resource_type='challenge_phase_translation' and resource_id=(select id::text from deleted_phase) and status<>'error') then raise exception 'DELETE no invalidó estados'; end if;
  if has_function_privilege('anon','public.translation_write_value(text,text,text,text,jsonb,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.translation_write_value(text,text,text,text,jsonb,uuid)','EXECUTE')
    or has_function_privilege('anon','public.translation_read_value_before_challenges(text,text,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.translation_read_value_before_challenges(text,text,text,text)','EXECUTE')
    or has_function_privilege('anon','public.translation_write_value_before_challenges(text,text,text,text,jsonb,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.translation_write_value_before_challenges(text,text,text,text,jsonb,uuid)','EXECUTE')
    or has_function_privilege('anon','public.translation_write_challenge_value(text,text,text,text,jsonb)','EXECUTE') then
    raise exception 'Helper SECURITY DEFINER expuesto';
  end if;
end $$;
