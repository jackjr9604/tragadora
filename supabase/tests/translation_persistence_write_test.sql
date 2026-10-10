-- Ejecutar únicamente después de aplicar 202610100001 en una base local.
-- Toda la prueba ocurre dentro de una transacción y termina con ROLLBACK.

begin;

create temporary table translation_write_trigger_events (
  operation text not null,
  pros jsonb,
  description text
) on commit drop;

create or replace function pg_temp.capture_translation_write()
returns trigger
language plpgsql
as $$
begin
  insert into translation_write_trigger_events (operation, pros, description)
  values (tg_op, new.pros, new.description);
  return new;
end
$$;

create trigger translation_write_test_capture
after insert or update on public.platform_translations
for each row execute function pg_temp.capture_translation_write();

do $$
declare
  source_platform_id uuid;
  source_language text;
  target_language text;
  captured jsonb;
begin
  select pt.platform_id, pt.language
  into source_platform_id, source_language
  from public.platform_translations pt
  join public.languages l on l.code=pt.language
  where l.is_default and l.is_active
  order by pt.platform_id
  limit 1;

  select l.code into target_language
  from public.languages l
  where l.is_active and l.code<>source_language
  order by l.sort_order, l.code
  limit 1;

  if source_platform_id is null or target_language is null then
    raise exception 'La prueba requiere una plataforma fuente y un idioma destino activo';
  end if;

  -- Fuerza el camino INSERT sin dejar cambios permanentes.
  delete from public.platform_translations
  where platform_id=source_platform_id and language=target_language;
  delete from translation_write_trigger_events;

  perform public.translation_write_value(
    'platform_translation',source_platform_id::text,'pros',target_language,
    '["Ventaja A","Ventaja B"]'::jsonb,null
  );

  select pros into captured from public.platform_translations
  where platform_id=source_platform_id and language=target_language;
  if captured is distinct from '["Ventaja A","Ventaja B"]'::jsonb then
    raise exception 'INSERT JSONB de pros incorrecto: %', captured;
  end if;
  if (select count(*) from translation_write_trigger_events where operation='INSERT') <> 1 then
    raise exception 'El INSERT debe disparar exactamente una vez el trigger de captura';
  end if;
  if exists (
    select 1 from translation_write_trigger_events
    where operation='INSERT' and pros is distinct from '["Ventaja A","Ventaja B"]'::jsonb
  ) then
    raise exception 'El trigger observó una fila INSERT incompleta';
  end if;

  -- Camino UPDATE sobre la misma fila.
  perform public.translation_write_value(
    'platform_translation',source_platform_id::text,'description',target_language,
    to_jsonb('Descripción actualizada'::text),null
  );
  if (select description from public.platform_translations
      where platform_id=source_platform_id and language=target_language)
      is distinct from 'Descripción actualizada' then
    raise exception 'UPDATE de description incorrecto';
  end if;
  if (select count(*) from translation_write_trigger_events where operation='UPDATE') <> 1 then
    raise exception 'El UPDATE debe disparar exactamente una vez el trigger de captura';
  end if;

  -- text/rich_text solo aceptan cadenas JSONB.
  begin
    perform public.translation_write_value(
      'platform_translation',source_platform_id::text,'description',target_language,
      '{"incorrecto":true}'::jsonb,null
    );
    raise exception 'Se aceptó un objeto para description';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.translation_write_value(
      'platform_translation',source_platform_id::text,'short_description',target_language,
      '123'::jsonb,null
    );
    raise exception 'Se aceptó un número para short_description';
  exception when sqlstate '22023' then null;
  end;

  -- pros/cons deben ser arrays no vacíos compuestos solo por cadenas.
  begin
    perform public.translation_write_value(
      'platform_translation',source_platform_id::text,'pros',target_language,
      '["válido",42]'::jsonb,null
    );
    raise exception 'Se aceptó un array mixto para pros';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.translation_write_value(
      'platform_translation',source_platform_id::text,'cons',target_language,
      '[]'::jsonb,null
    );
    raise exception 'Se aceptó un array vacío para cons';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.translation_write_value(
      'platform_translation',source_platform_id::text,'cons',target_language,
      '"no-array"'::jsonb,null
    );
    raise exception 'Se aceptó una cadena para cons';
  exception when sqlstate '22023' then null;
  end;
end
$$;

rollback;
