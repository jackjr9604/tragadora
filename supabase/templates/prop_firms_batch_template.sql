-- Plantilla manual para preparar lotes de Prop Firms verificadas.
-- No es una migración y no contiene filas externas listas para insertar.
-- Copia este archivo, completa únicamente datos confirmados y revisa el lote antes de ejecutarlo.

begin;

create temporary table prop_firm_import_batch (
  name text not null,
  slug text not null,
  website_url text,
  logo_url text,
  status text not null default 'inactive',
  short_description_es text,
  primary key (slug),
  check (status in ('active', 'inactive'))
) on commit drop;

-- Agrega filas confirmadas en lotes pequeños. Mantén NULL para datos desconocidos.
-- Ejemplo de forma (comentado deliberadamente):
-- insert into prop_firm_import_batch
--   (name, slug, website_url, logo_url, status, short_description_es)
-- values
--   ('Nombre confirmado', 'slug-confirmado', 'https://sitio-oficial.example', null, 'inactive', null);

-- Evita sobrescribir firmas existentes: el lote falla si un slug ya existe.
do $$
begin
  if exists (
    select 1
    from prop_firm_import_batch batch
    join public.platforms platform on platform.slug = batch.slug
  ) then
    raise exception 'El lote contiene slugs que ya existen en platforms';
  end if;
end;
$$;

with inserted_platforms as (
  insert into public.platforms (
    name,
    slug,
    type,
    website_url,
    logo_url,
    status
  )
  select
    name,
    slug,
    'prop_firm',
    website_url,
    logo_url,
    status
  from prop_firm_import_batch
  returning id, slug
)
insert into public.platform_translations (
  platform_id,
  language,
  short_description
)
select
  inserted.id,
  'es',
  batch.short_description_es
from inserted_platforms inserted
join prop_firm_import_batch batch using (slug)
where batch.short_description_es is not null;

-- Revisión previa al commit. Cambia rollback por commit solo después de validar.
select
  platform.id,
  platform.name,
  platform.slug,
  platform.website_url,
  platform.status
from public.platforms platform
join prop_firm_import_batch batch using (slug)
order by platform.name;

rollback;
