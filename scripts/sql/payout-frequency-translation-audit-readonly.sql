-- Tradagora: diagnóstico de payout_frequency (SOLO LECTURA).
-- No modifica planes, traducciones, estados ni jobs.

-- 1) Nulos, vacíos y cantidad exacta de originales distintos.
select
  count(*)::bigint as total_plans,
  count(*) filter (where payout_frequency is null)::bigint as null_values,
  count(*) filter (where payout_frequency is not null and btrim(payout_frequency) = '')::bigint as blank_values,
  count(distinct payout_frequency) filter (where nullif(btrim(payout_frequency), '') is not null)::bigint as exact_distinct_values
from public.account_plans;

-- 2) Frecuencias exactas. No se normalizan mayúsculas, guiones, espacios internos
-- ni unidades comerciales porque esas diferencias pueden ser significativas.
select payout_frequency as exact_source_text, count(*)::bigint as plans
from public.account_plans
where nullif(btrim(payout_frequency), '') is not null
group by payout_frequency
order by plans desc, exact_source_text;

-- 3) Estados creados para fuentes nulas o vacías. Son estados no traducibles y
-- deben excluirse de cobertura; esta consulta no los elimina.
select s.target_language, s.status, s.workflow_status, s.publication_status,
       count(*)::bigint as states
from public.translation_field_state s
join public.account_plans ap on ap.id::text = s.resource_id
where s.resource_type = 'account_plan_translation'
  and s.field_name = 'payout_frequency'
  and nullif(btrim(ap.payout_frequency), '') is null
group by s.target_language, s.status, s.workflow_status, s.publication_status
order by s.target_language, s.status, s.workflow_status, s.publication_status;

-- 4) Cobertura real por idioma para fuentes no vacías.
with classified as (
  select s.*,
    (s.publication_status = 'published'
      and s.translated_source_hash = s.source_hash
      and s.translated_revision = s.source_revision
      and (s.status = 'reviewed' or (s.status = 'imported_unreviewed' and s.is_protected))) is true as complete
  from public.translation_field_state s
  join public.account_plans ap on ap.id::text = s.resource_id
  where s.resource_type = 'account_plan_translation'
    and s.field_name = 'payout_frequency'
    and nullif(btrim(ap.payout_frequency), '') is not null
)
select target_language,
       count(*)::bigint as total,
       count(*) filter (where complete)::bigint as complete,
       count(*) filter (where not complete)::bigint as pending,
       count(*) filter (where status = 'machine_translated')::bigint as machine_translated,
       count(*) filter (where status = 'stale')::bigint as stale,
       count(*) filter (where is_protected)::bigint as protected
from classified
group by target_language
order by target_language;

-- 5) Reutilización estrictamente exacta disponible. Una propuesta donante debe
-- estar publicada, revisada, vigente y no vacía. Los receptores protegidos,
-- publicados o con workflow activo quedan excluidos.
with donors as (
  select distinct on (s.source_hash, s.target_language)
    s.source_hash, s.target_language, s.resource_id as donor_resource_id,
    apt.payout_frequency as proposed_translation
  from public.translation_field_state s
  join public.account_plan_translations apt
    on apt.account_plan_id::text = s.resource_id and apt.language = s.target_language
  where s.resource_type = 'account_plan_translation'
    and s.field_name = 'payout_frequency'
    and s.status = 'reviewed'
    and s.publication_status = 'published'
    and s.translated_source_hash = s.source_hash
    and s.translated_revision = s.source_revision
    and nullif(btrim(apt.payout_frequency), '') is not null
  order by s.source_hash, s.target_language, s.reviewed_at desc nulls last, s.updated_at desc
), eligible as (
  select s.id, s.source_hash, s.target_language, ap.payout_frequency as exact_source_text
  from public.translation_field_state s
  join public.account_plans ap on ap.id::text = s.resource_id
  where s.resource_type = 'account_plan_translation'
    and s.field_name = 'payout_frequency'
    and nullif(btrim(ap.payout_frequency), '') is not null
    and not s.is_protected
    and s.publication_status = 'unpublished'
    and s.workflow_status = 'none'
    and s.status in ('missing', 'stale', 'error', 'machine_translated')
)
select e.target_language, e.exact_source_text, d.proposed_translation,
       count(*)::bigint as eligible_pending_fields
from eligible e
join donors d using (source_hash, target_language)
group by e.target_language, e.exact_source_text, d.proposed_translation
order by eligible_pending_fields desc, e.target_language, e.exact_source_text;

-- 6) Resumen de cuánto trabajo puede reutilizar una propuesta aprobada exacta.
with donors as (
  select distinct s.source_hash, s.target_language
  from public.translation_field_state s
  join public.account_plan_translations apt
    on apt.account_plan_id::text = s.resource_id and apt.language = s.target_language
  where s.resource_type = 'account_plan_translation' and s.field_name = 'payout_frequency'
    and s.status = 'reviewed' and s.publication_status = 'published'
    and s.translated_source_hash = s.source_hash and s.translated_revision = s.source_revision
    and nullif(btrim(apt.payout_frequency), '') is not null
), eligible as (
  select s.* from public.translation_field_state s
  join public.account_plans ap on ap.id::text = s.resource_id
  where s.resource_type = 'account_plan_translation' and s.field_name = 'payout_frequency'
    and nullif(btrim(ap.payout_frequency), '') is not null and not s.is_protected
    and s.publication_status = 'unpublished' and s.workflow_status = 'none'
    and s.status in ('missing', 'stale', 'error', 'machine_translated')
)
select e.target_language,
       count(*)::bigint as eligible_pending,
       count(*) filter (where d.source_hash is not null)::bigint as reusable_from_reviewed_exact,
       count(*) filter (where d.source_hash is null)::bigint as requires_new_translation
from eligible e
left join donors d using (source_hash, target_language)
group by e.target_language
order by e.target_language;
