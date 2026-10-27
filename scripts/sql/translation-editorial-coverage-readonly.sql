-- Tradagora: inventario editorial ES/EN/PT (SOLO LECTURA).
-- Diseñado para Supabase SQL Editor después de aplicar
-- 202610270001_translation_editorial_coverage.sql.
-- No crea objetos ni modifica datos.

-- 1) Totales por idioma de destino activo y publicado.
with scoped as (
  select s.*
  from public.translation_field_state s
  join public.languages l on l.code = s.target_language
  where l.is_active
    and l.publication_status = 'published'
    and not l.is_default
    and (s.resource_type <> 'account_plan_translation' or s.field_name <> 'payout_frequency' or exists (
      select 1 from public.account_plans ap where ap.id::text = s.resource_id and nullif(btrim(ap.payout_frequency), '') is not null
    ))
), classified as (
  select s.*,
    (
      s.publication_status = 'published'
      and s.translated_source_hash = s.source_hash
      and s.translated_revision = s.source_revision
      and (
        s.status = 'reviewed'
        or (s.status = 'imported_unreviewed' and s.is_protected)
      )
    ) is true as is_complete,
    (
      s.status = 'stale'
      or (
        s.translated_source_hash is not null
        and s.translated_revision is not null
        and (
          s.translated_source_hash is distinct from s.source_hash
          or s.translated_revision is distinct from s.source_revision
        )
      )
    ) as is_stale
  from scoped s
)
select
  target_language,
  count(*)::bigint as total_translatable_fields,
  count(*) filter (where is_complete)::bigint as completed_fields,
  count(*) filter (where not is_complete)::bigint as pending_fields,
  count(*) filter (
    where status = 'machine_translated'
       or (workflow_status = 'draft' and translation_method = 'libretranslate')
  )::bigint as automatic_review_fields,
  count(*) filter (where is_stale)::bigint as stale_fields,
  count(*) filter (where is_protected)::bigint as protected_fields,
  count(*) filter (where status = 'error')::bigint as error_fields
from classified
group by target_language
order by target_language;

-- 2) Cobertura por módulo e idioma. Permite localizar Pendientes EN y PT.
with scoped as (
  select s.*
  from public.translation_field_state s
  join public.languages l on l.code = s.target_language
  where l.is_active
    and l.publication_status = 'published'
    and not l.is_default
    and (s.resource_type <> 'account_plan_translation' or s.field_name <> 'payout_frequency' or exists (
      select 1 from public.account_plans ap where ap.id::text = s.resource_id and nullif(btrim(ap.payout_frequency), '') is not null
    ))
), classified as (
  select s.*,
    (
      s.publication_status = 'published'
      and s.translated_source_hash = s.source_hash
      and s.translated_revision = s.source_revision
      and (
        s.status = 'reviewed'
        or (s.status = 'imported_unreviewed' and s.is_protected)
      )
    ) is true as is_complete,
    (
      s.status = 'stale'
      or (
        s.translated_source_hash is not null
        and s.translated_revision is not null
        and (
          s.translated_source_hash is distinct from s.source_hash
          or s.translated_revision is distinct from s.source_revision
        )
      )
    ) as is_stale
  from scoped s
)
select
  resource_type,
  target_language,
  count(*)::bigint as total_translatable_fields,
  count(*) filter (where is_complete)::bigint as completed_fields,
  count(*) filter (where not is_complete)::bigint as pending_fields,
  count(*) filter (
    where status = 'machine_translated'
       or (workflow_status = 'draft' and translation_method = 'libretranslate')
  )::bigint as automatic_review_fields,
  count(*) filter (where is_stale)::bigint as stale_fields,
  count(*) filter (where is_protected)::bigint as protected_fields,
  count(*) filter (where status = 'error')::bigint as error_fields
from classified
group by resource_type, target_language
order by resource_type, target_language;

-- 3) Pendientes EN/PT, paginables manualmente sin exponer textos.
-- Cambie LIMIT/OFFSET solamente si necesita recorrer todo el inventario.
with classified as (
  select s.*,
    (
      s.publication_status = 'published'
      and s.translated_source_hash = s.source_hash
      and s.translated_revision = s.source_revision
      and (
        s.status = 'reviewed'
        or (s.status = 'imported_unreviewed' and s.is_protected)
      )
    ) is true as is_complete
  from public.translation_field_state s
  join public.languages l on l.code = s.target_language
  where l.is_active
    and l.publication_status = 'published'
    and not l.is_default
    and (s.resource_type <> 'account_plan_translation' or s.field_name <> 'payout_frequency' or exists (
      select 1 from public.account_plans ap where ap.id::text = s.resource_id and nullif(btrim(ap.payout_frequency), '') is not null
    ))
    and s.target_language in ('en', 'pt')
)
select
  resource_type,
  resource_id,
  field_name,
  target_language,
  status,
  workflow_status,
  publication_status,
  is_protected,
  updated_at
from classified
where not is_complete
order by target_language, resource_type, updated_at desc, resource_id, field_name
limit 500 offset 0;
