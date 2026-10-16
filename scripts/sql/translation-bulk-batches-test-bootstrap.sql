\set ON_ERROR_STOP on
\ir translation-job-admin-actions-test-bootstrap.sql

-- El bootstrap heredado precede a 3E.6; reproduce las columnas de languages
-- que ya existen en el esquema remoto actual sin ejecutar RPC administrativas.
alter table public.languages
  add column if not exists ui_catalog_available boolean not null default false,
  add column if not exists seo_ready boolean not null default false,
  add column if not exists libretranslate_status text not null default 'unknown',
  add column if not exists libretranslate_checked_at timestamptz;
update public.languages set ui_catalog_available=true,seo_ready=true,
  libretranslate_status=case when code in ('es','en','pt') then 'supported' else 'unsupported' end,
  libretranslate_checked_at=now();

\ir ../../supabase/migrations/202610160003_translation_bulk_batches.sql
