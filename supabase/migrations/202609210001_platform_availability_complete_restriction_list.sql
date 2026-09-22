begin;

-- Señal editorial mínima: la fuente pretende enumerar todas las jurisdicciones
-- restringidas para la firma/market de esta regla. No representa una fila
-- "available" y no sustituye la evidencia individual de una restricción.
alter table public.platform_availability
  add column if not exists restriction_list_complete boolean not null default false;

comment on column public.platform_availability.restriction_list_complete is
  'True únicamente cuando la fuente oficial pretende ser una lista completa de restricciones para el market de la regla; permite inferir disponibilidad por ausencia.';

commit;
