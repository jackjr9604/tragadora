-- FTMO · preparación legítima del módulo de Payouts
--
-- Auditoría local:
-- - No existe collector blockchain/API específico para FTMO.
-- - Los collectors externos requieren un external_platform_mapping activo.
-- - No hay mapping FTMO versionado para propfirmmatch ni mondotraders.
-- - No se conoce desde el repositorio un payout_source FTMO confirmado.
--
-- Por esas razones este seed NO crea payout_sources, mappings, payouts,
-- platform_payout_metrics ni snapshots. Solo registra que FTMO requiere
-- investigación antes de activar seguimiento automático.
--
-- La política comercial de rewards (primera solicitud desde el día 14,
-- revisión y envío estimados, splits y condiciones) pertenece a
-- challenge_reward_options y no a payout_sources.
--
-- Métodos confirmados: Bank Transfer, Crypto y Skrill ya existen en el
-- catálogo versionado. Visa Direct / Mastercard Send no existe actualmente
-- como transaction_method y no se crea desde este seed.

begin;

do $$
declare
  v_platform_id uuid;
begin
  select id into strict v_platform_id
  from public.platforms
  where slug = 'ftmo' and type = 'prop_firm';

  insert into public.platform_research_status (
    platform_id,
    payout_policy_checked,
    payout_tracking_status,
    priority,
    notes
  ) values (
    v_platform_id,
    true,
    'researching',
    'medium',
    'Política de rewards documentada. No existe todavía en el repositorio un collector o mapping externo confirmado para FTMO; no crear payout_source hasta identificar una fuente compatible.'
  )
  on conflict (platform_id) do update set
    payout_policy_checked = excluded.payout_policy_checked,
    notes = coalesce(public.platform_research_status.notes, excluded.notes),
    last_reviewed_at = now(),
    updated_at = now();
end;
$$;

commit;
