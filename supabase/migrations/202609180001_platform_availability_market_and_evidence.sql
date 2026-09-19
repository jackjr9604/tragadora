-- Preparada localmente; NO aplicar hasta aprobar pre-check y revisión.
begin;

alter table public.platform_availability
  add column market text,
  add column source_url text,
  add column verified_at timestamptz,
  add column rule_summary text,
  add column restriction_basis text not null default 'unspecified';

alter table public.platform_availability
  add constraint platform_availability_market_check
    check (market is null or market in ('cfd', 'futures', 'crypto', 'options')),
  add constraint platform_availability_market_fk
    foreign key (platform_id, market)
    references public.platform_markets (platform_id, market),
  add constraint platform_availability_basis_check
    check (restriction_basis in ('residence', 'nationality', 'physical_location', 'unspecified')),
  add constraint platform_availability_evidence_check
    check (status = 'unknown' or (nullif(btrim(source_url), '') is not null and verified_at is not null));

-- El nombre real del UNIQUE legacy puede variar; eliminar únicamente el constraint
-- que contiene exactamente platform_id + country_code (no la PK por id).
do $$
declare legacy_name text;
begin
  select con.conname into legacy_name
  from pg_constraint con
  where con.conrelid = 'public.platform_availability'::regclass
    and con.contype = 'u'
    and (
      select array_agg(att.attname::text order by att.attname::text)
      from unnest(con.conkey) as keynum(attnum)
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = keynum.attnum
    ) = array['country_code', 'platform_id']::text[];

  if legacy_name is null then
    raise exception 'No se encontró el UNIQUE legacy (platform_id, country_code); revisar pre-check.';
  end if;
  execute format('alter table public.platform_availability drop constraint %I', legacy_name);
end $$;

-- Dos índices parciales: NULL no duplica reglas generales, sin requerir PG >= 15.
create unique index platform_availability_general_unique_idx
  on public.platform_availability (platform_id, country_code)
  where market is null;

create unique index platform_availability_market_unique_idx
  on public.platform_availability (platform_id, country_code, market)
  where market is not null;

-- No tocar datos, RLS, policies ni grants. Las cinco filas unknown conservan
-- market/source_url/verified_at/rule_summary NULL y basis unspecified.
commit;
