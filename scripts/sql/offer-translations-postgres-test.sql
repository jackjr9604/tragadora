\set ON_ERROR_STOP on

do $$
declare offer_record record;
begin
  for offer_record in
    select id,language,promo_code,discount_value,discount_type
    from public.offers where promo_code like 'LEGACY-%' order by language
  loop
    if (select count(*) from public.translation_field_state
        where resource_type='offer_translation' and resource_id=offer_record.id::text)<>10 then
      raise exception 'La oferta % no creó 10 estados',offer_record.promo_code;
    end if;
    if exists(select 1 from public.translation_field_state
      where resource_type='offer_translation' and resource_id=offer_record.id::text
        and source_language<>offer_record.language) then
      raise exception 'Idioma fuente incorrecto para %',offer_record.promo_code;
    end if;
    if exists(select 1 from public.translation_field_state
      where resource_type='offer_translation' and resource_id=offer_record.id::text
        and target_language=offer_record.language) then
      raise exception 'El idioma fuente aparece como destino para %',offer_record.promo_code;
    end if;
    if offer_record.discount_value not in (10,15,20) or offer_record.discount_type<>'percentage' then
      raise exception 'La migración alteró condiciones comerciales';
    end if;
  end loop;
  if exists(select 1 from public.offer_translations) then
    raise exception 'La inicialización creó o sobrescribió textos traducidos';
  end if;
  if exists(select 1 from public.translation_jobs where resource_type='offer_translation') then
    raise exception 'La inicialización creó jobs';
  end if;
end $$;

set role authenticated;
select set_config('app.test_permissions','',false);
do $$ begin
  begin
    perform public.translation_save_manual(
      'offer_translation',(select id::text from public.offers where promo_code='LEGACY-EN'),
      'title','es',to_jsonb('Traducción no autorizada'::text),true
    );
    raise exception 'La escritura sin offers.update no fue rechazada';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('app.test_permissions','offers.update',false);
select public.translation_save_manual(
  'offer_translation',(select id::text from public.offers where promo_code='LEGACY-EN'),
  'title','es',to_jsonb('Oferta traducida ES'::text),true
);

do $$
declare en_id uuid := (select id from public.offers where promo_code='LEGACY-EN');
begin
  if (select title from public.offer_translations where offer_id=en_id and language='es')<>'Oferta traducida ES' then
    raise exception 'No guardó la traducción ES de una fuente EN';
  end if;
  if not (select is_protected from public.translation_field_state
    where resource_type='offer_translation' and resource_id=en_id::text
      and field_name='title' and target_language='es') then
    raise exception 'No protegió la traducción manual';
  end if;
  begin
    perform public.translation_write_value(
      'offer_translation',en_id::text,'title','en',to_jsonb('No permitido'::text),null
    );
    raise exception 'Permitió escribir sobre el idioma fuente';
  exception when sqlstate '22023' then null;
  end;
end $$;

update public.offers set title='Updated original EN' where promo_code='LEGACY-EN';

do $$
declare en_id uuid := (select id from public.offers where promo_code='LEGACY-EN');
begin
  if (select status from public.translation_field_state
      where resource_type='offer_translation' and resource_id=en_id::text
        and field_name='title' and target_language='es')<>'stale' then
    raise exception 'No marcó stale tras cambiar la fuente EN';
  end if;
  if (select title from public.offer_translations where offer_id=en_id and language='es')<>'Oferta traducida ES' then
    raise exception 'Sobrescribió una traducción protegida';
  end if;
end $$;

insert into public.offers(title,description,discount_value,discount_type,promo_code,language)
values('Nova oferta PT','Nova descrição',5,'percentage','NEW-PT','pt');

do $$
declare pt_id uuid := (select id from public.offers where promo_code='NEW-PT');
begin
  if (select count(*) from public.translation_field_state
      where resource_type='offer_translation' and resource_id=pt_id::text)<>4 then
    raise exception 'El trigger INSERT no registró los cuatro campos presentes para PT';
  end if;
  if exists(select 1 from public.translation_field_state
      where resource_type='offer_translation' and resource_id=pt_id::text
        and source_language<>'pt') then
    raise exception 'El trigger INSERT perdió el idioma fuente PT';
  end if;
end $$;

update public.offers set language='en' where promo_code='NEW-PT';
do $$
declare changed_id uuid := (select id from public.offers where promo_code='NEW-PT');
begin
  if exists(select 1 from public.translation_field_state
      where resource_type='offer_translation' and resource_id=changed_id::text
        and (source_language<>'en' or target_language='en')) then
    raise exception 'El trigger UPDATE no realineó los estados al cambiar PT a EN';
  end if;
end $$;

create temporary table deleted_offer_context as
select id from public.offers where promo_code='NEW-PT';
delete from public.offers where promo_code='NEW-PT';
do $$ begin
  if exists(select 1 from public.translation_field_state
      where resource_type='offer_translation'
        and resource_id=(select id::text from deleted_offer_context)
        and status<>'error') then
    raise exception 'El trigger DELETE no invalidó todos los estados';
  end if;
end $$;

do $$ begin
  if has_function_privilege('anon','public.translation_write_value(text,text,text,text,jsonb,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.translation_write_value(text,text,text,text,jsonb,uuid)','EXECUTE')
    or has_function_privilege('anon','public.translation_register_offer_source_change_internal(text,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.translation_register_offer_source_change_internal(text,text,text)','EXECUTE') then
    raise exception 'Un helper SECURITY DEFINER interno quedó ejecutable públicamente';
  end if;
  if not has_function_privilege('authenticated','public.translation_save_manual(text,text,text,text,jsonb,boolean)','EXECUTE') then
    raise exception 'authenticated perdió acceso a la RPC administrativa protegida';
  end if;
  if exists(select 1 from public.translation_jobs where resource_type='offer_translation') then
    raise exception 'Las pruebas crearon jobs automáticamente';
  end if;
end $$;
