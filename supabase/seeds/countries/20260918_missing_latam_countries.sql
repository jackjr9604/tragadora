-- Estados soberanos LATAM/Caribe requeridos por geography batch 01.
-- Preparado el 2026-09-18. NO modifica países existentes.

begin;

create temp table missing_latam_countries_20260918 (
  code text primary key,
  name text not null,
  region text not null,
  flag text
) on commit drop;

insert into missing_latam_countries_20260918 (code, name, region, flag) values
  ('AG', 'Antigua y Barbuda', 'Caribbean', null),
  ('BS', 'Bahamas', 'Caribbean', null),
  ('BB', 'Barbados', 'Caribbean', null),
  ('BZ', 'Belice', 'LATAM', null),
  ('CU', 'Cuba', 'Caribbean', null),
  ('DM', 'Dominica', 'Caribbean', null),
  ('GD', 'Granada', 'Caribbean', null),
  ('GY', 'Guyana', 'LATAM', null),
  ('HT', 'Haití', 'Caribbean', null),
  ('JM', 'Jamaica', 'Caribbean', null),
  ('KN', 'San Cristóbal y Nieves', 'Caribbean', null),
  ('VC', 'San Vicente y las Granadinas', 'Caribbean', null),
  ('SR', 'Surinam', 'LATAM', null),
  ('TT', 'Trinidad y Tobago', 'Caribbean', null);

do $$
declare
  invalid_regions text;
  conflicting_codes text;
begin
  select string_agg(distinct proposed.region, ', ' order by proposed.region)
    into invalid_regions
  from missing_latam_countries_20260918 proposed
  where not exists (
    select 1
    from public.countries current_country
    where current_country.region = proposed.region
  );

  if invalid_regions is not null then
    raise exception 'Regiones inexistentes en la taxonomía actual: %', invalid_regions;
  end if;

  select string_agg(proposed.code, ', ' order by proposed.code)
    into conflicting_codes
  from missing_latam_countries_20260918 proposed
  join public.countries current_country on current_country.code = proposed.code
  where current_country.name is distinct from proposed.name
     or current_country.region is distinct from proposed.region
     or current_country.flag is distinct from proposed.flag;

  if conflicting_codes is not null then
    raise exception 'Códigos existentes con datos diferentes: %', conflicting_codes;
  end if;
end $$;

insert into public.countries (code, name, region, flag)
select proposed.code, proposed.name, proposed.region, proposed.flag
from missing_latam_countries_20260918 proposed
where not exists (
  select 1
  from public.countries current_country
  where current_country.code = proposed.code
);

do $$
begin
  if (
    select count(*)
    from missing_latam_countries_20260918 proposed
    join public.countries current_country
      on current_country.code = proposed.code
     and current_country.name = proposed.name
     and current_country.region = proposed.region
     and current_country.flag is not distinct from proposed.flag
  ) <> 14 then
    raise exception 'La validación final no encontró los 14 países con los valores esperados';
  end if;
end $$;

commit;
