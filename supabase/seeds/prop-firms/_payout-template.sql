-- PLANTILLA: configuración manual legítima para incorporar una Prop Firm
-- al sistema de monitoreo de payouts. No inserta payouts ni métricas.

begin;

do $$
declare
  v_platform_slug text := '__replace_platform_slug__';
  v_platform_id uuid;
  v_source_name text := '__REPLACE_SOURCE_NAME__';
  v_source_type text := 'blockchain'; -- blockchain | official_api | provider | public_page
  v_source_url text := null;
  v_source_status boolean := false;   -- activar solo cuando config esté validado
  v_source_config jsonb := jsonb_build_object(
    'chain', '__REPLACE_CHAIN__',
    'chain_id', 0,
    'token_symbol', '__REPLACE_TOKEN_SYMBOL__',
    'token_address', '__REPLACE_TOKEN_ADDRESS__',
    'decimals', 6,
    'settlement_address', '__REPLACE_SETTLEMENT_ADDRESS__',
    'verification', '__REPLACE_VERIFICATION__',
    'history_page', 1,
    'history_complete', false
  );
  v_payout_source_id uuid;
begin
  if v_platform_slug like '__%' or v_source_name like '__%' then
    raise exception 'Completa platform_slug y source_name';
  end if;
  if v_source_config::text like '%__REPLACE_%' then
    raise exception 'Completa todos los placeholders de payout_sources.config';
  end if;
  if v_source_type = 'blockchain' and (
    coalesce(v_source_config->>'chain', '') = ''
    or coalesce((v_source_config->>'chain_id')::integer, 0) <= 0
    or coalesce(v_source_config->>'token_address', '') = ''
    or coalesce(v_source_config->>'settlement_address', '') = ''
  ) then
    raise exception 'La configuración blockchain requiere chain, chain_id, token_address y settlement_address';
  end if;

  select id into strict v_platform_id
  from public.platforms
  where slug = v_platform_slug and type = 'prop_firm';

  -- payout_sources no tiene una clave natural versionada en las migraciones.
  -- Conservamos el ID buscando por platform_id + name y abortamos si hay duplicados.
  if (
    select count(*) > 1
    from public.payout_sources
    where platform_id = v_platform_id and name = v_source_name
  ) then
    raise exception 'Existen payout_sources duplicadas para platform_id + name';
  end if;

  select id into v_payout_source_id
  from public.payout_sources
  where platform_id = v_platform_id and name = v_source_name;

  if found then
    update public.payout_sources set
      source_type = v_source_type,
      source_url = v_source_url,
      config = v_source_config,
      status = v_source_status
    where id = v_payout_source_id;
  else
    insert into public.payout_sources (
      platform_id, name, source_type, source_url, config, status
    ) values (
      v_platform_id, v_source_name, v_source_type, v_source_url,
      v_source_config, v_source_status
    ) returning id into v_payout_source_id;
  end if;

  -- Estado editorial/operativo de investigación: una fila por plataforma.
  insert into public.platform_research_status (
    platform_id, payout_tracking_status, priority, notes
  ) values (
    v_platform_id,
    'researching', -- unknown | researching | trackable | partially_trackable | not_trackable
    'medium',      -- low | medium | high
    null
  )
  on conflict (platform_id) do update set
    payout_tracking_status = excluded.payout_tracking_status,
    priority = excluded.priority,
    notes = excluded.notes,
    updated_at = now();
end;
$$;

-- Mappings externos son opcionales y se cargan únicamente con identidad
-- confirmada. La clave real es (platform_id, provider).
-- Ejemplo deliberadamente comentado:
-- insert into public.external_platform_mappings (
--   platform_id, provider, external_name, external_slug,
--   external_market, external_url, active
-- )
-- select p.id, 'mondotraders', '__EXTERNAL_NAME__', '__external_slug__',
--   'futures', 'https://...', true
-- from public.platforms p
-- where p.slug = '__replace_platform_slug__'
-- on conflict (platform_id, provider) do update set
--   external_name = excluded.external_name,
--   external_slug = excluded.external_slug,
--   external_market = excluded.external_market,
--   external_url = excluded.external_url,
--   active = excluded.active;

commit;
