-- Solo lectura. Ejecutar en el SQL editor para conocer el estado real de producción.
-- Umbrales operativos iniciales: oficial 36 h (cron cada 12 h), Mondo 48 h (diario).
select p.slug, ps.id, ps.name, ps.source_type, ps.status,
       ps.config->'collector' as collector,
       ps.last_sync_at, ps.last_success_at, ps.last_error,
       case
         when not ps.status then 'DISABLED'
         when ps.source_type = 'public_page' and ps.config->'collector' is null then 'MISSING_COLLECTOR'
         when ps.source_type = 'public_page' and ps.config#>>'{collector,enabled}' = 'false' then 'COLLECTOR_DISABLED'
         when ps.last_success_at is null then 'NEVER_SUCCEEDED'
         when ps.last_success_at < now() - interval '36 hours' then 'REVIEW_STALE_SOURCE'
         else 'RECENT_SOURCE_SUCCESS'
       end as audit_status
from public.payout_sources ps
join public.platforms p on p.id = ps.platform_id
order by p.slug, ps.name;

-- Fecha de captura no equivale a última comprobación: UNCHANGED no inserta otra fila.
select p.slug, m.source_type, m.source_name, m.period_key,
       m.collected_at, now() - m.collected_at as snapshot_age,
       m.amount, m.currency, m.verification_level
from public.platform_payout_metrics m
join public.platforms p on p.id = m.platform_id
where m.is_current and m.metric_type = 'payout_summary'
order by m.collected_at nulls first, p.slug, m.period_key;

-- Fuentes configuradas para el proceso externo diario (no cubre reglas/precios).
select p.slug, epm.external_name, epm.external_url, epm.active
from public.external_platform_mappings epm
join public.platforms p on p.id = epm.platform_id
where epm.provider = 'mondotraders'
order by epm.active desc, p.slug;

-- Qué snapshot está eligiendo la web; revisar prioridad oficial antigua vs externo reciente.
select slug, period_key, display_total_source_name, display_total_source_type,
       display_total_amount, display_total_updated_at
from public.platform_payout_period_summary
order by display_total_updated_at nulls first, slug, period_key;
