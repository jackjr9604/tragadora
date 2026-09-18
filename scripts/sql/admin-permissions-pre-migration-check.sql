-- SOLO LECTURA. Ejecutar ANTES de 202609170001/002; no altera datos ni esquema.
-- El inventario remoto completo debe cotejarse con cada DROP de la migración 002.

-- A. Todas las policies de las tablas afectadas, incluidas las lecturas públicas.
with scope(schema_name, table_name) as (values
  ('public','platforms'),('public','profiles'),('public','prop_firm_details'),
  ('public','platform_availability'),('public','platform_markets'),
  ('public','platform_instruments'),('public','platform_trading_platforms'),
  ('public','platform_transaction_methods'),('public','platform_translations'),
  ('public','countries'),('public','instrument_categories'),
  ('public','trading_platforms'),('public','transaction_methods'),
  ('public','challenges'),('public','account_plans'),('public','challenge_phases'),
  ('public','challenge_variants'),('public','challenge_variant_phases'),
  ('public','challenge_reward_options'),('public','payouts'),
  ('public','payout_evidence'),('public','payout_sources'),
  ('public','platform_payout_metrics'),('public','external_platform_mappings'),
  ('public','platform_research_status'),('public','offers'),
  ('public','affiliate_links'),('public','affiliate_clicks'),
  ('public','home_featured_platforms'),('public','site_content'),
  ('public','languages'),
  ('public','media'),('public','media_categories'),('public','trading_profiles'),
  ('storage','objects')
)
select s.schema_name, s.table_name, p.policyname, p.cmd, p.roles,
  p.permissive, p.qual, p.with_check
from scope s left join pg_catalog.pg_policies p
  on p.schemaname = s.schema_name and p.tablename = s.table_name
order by s.schema_name, s.table_name, p.policyname;

-- B. Dependencias de las funciones antiguas, sin filtrar a las tablas conocidas.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_catalog.pg_policies
where position('is_admin(' in pg_catalog.lower(coalesce(qual,''))) > 0
   or position('is_admin(' in pg_catalog.lower(coalesce(with_check,''))) > 0
   or position('is_editor(' in pg_catalog.lower(coalesce(qual,''))) > 0
   or position('is_editor(' in pg_catalog.lower(coalesce(with_check,''))) > 0
order by schemaname, tablename, policyname;

-- C. Policies ALL existentes (especialmente en public y storage).
select schemaname, tablename, policyname, roles, permissive, qual, with_check
from pg_catalog.pg_policies
where schemaname in ('public','storage') and cmd = 'ALL'
order by schemaname, tablename, policyname;

-- D. Escrituras potencialmente demasiado amplias para authenticated/public.
-- Incluye CHECK true y toda escritura protegida solo por is_admin/is_editor.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_catalog.pg_policies
where schemaname in ('public','storage')
  and cmd in ('ALL','INSERT','UPDATE','DELETE')
  and roles && array['anon','authenticated','public']::name[]
  and (
    pg_catalog.regexp_replace(coalesce(with_check,qual,''), '[()[:space:]]', '', 'g') = 'true'
    or position('is_admin(' in pg_catalog.lower(coalesce(qual,''))) > 0
    or position('is_admin(' in pg_catalog.lower(coalesce(with_check,''))) > 0
    or position('is_editor(' in pg_catalog.lower(coalesce(qual,''))) > 0
    or position('is_editor(' in pg_catalog.lower(coalesce(with_check,''))) > 0
  )
order by schemaname, tablename, policyname;

-- E. Estado RLS de todas las tablas públicas previstas por 002 y Storage.
with expected(schema_name, table_name) as (values
  ('public','platforms'),('public','profiles'),('public','prop_firm_details'),
  ('public','platform_availability'),('public','platform_markets'),
  ('public','platform_instruments'),('public','platform_trading_platforms'),
  ('public','platform_transaction_methods'),('public','platform_translations'),
  ('public','countries'),('public','instrument_categories'),
  ('public','trading_platforms'),('public','transaction_methods'),
  ('public','challenges'),('public','account_plans'),('public','challenge_phases'),
  ('public','challenge_variants'),('public','challenge_variant_phases'),
  ('public','challenge_reward_options'),('public','payouts'),
  ('public','payout_evidence'),('public','payout_sources'),
  ('public','platform_payout_metrics'),('public','external_platform_mappings'),
  ('public','platform_research_status'),('public','offers'),
  ('public','affiliate_links'),('public','affiliate_clicks'),
  ('public','home_featured_platforms'),('public','site_content'),
  ('public','languages'),
  ('public','media'),('public','media_categories'),('public','trading_profiles'),
  ('storage','objects')
)
select e.schema_name, e.table_name, c.oid is not null as table_exists,
  c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from expected e left join pg_catalog.pg_namespace n on n.nspname = e.schema_name
left join pg_catalog.pg_class c on c.relnamespace = n.oid and c.relname = e.table_name
order by e.schema_name, e.table_name;

-- F. Grants de profiles a nivel de tabla y columna.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'profiles'
order by grantee, privilege_type;
select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
order by grantee, column_name, privilege_type;

-- G. Policies de objetos y visibilidad del bucket media.
select policyname, cmd, roles, permissive, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
select id, public from storage.buckets where id = 'media';

-- H. Conteo de roles y detalle de perfiles administrativos.
select role, count(*) as profile_count from public.profiles group by role order by role;
select id, role, created_at from public.profiles
where role in ('super_admin','admin','editor') order by role, created_at;

-- J. Comparación exacta de TODOS los DROP POLICY de 002 contra pg_policies.
-- Una fila exists_remotely=false requiere revisión, incluso si DROP IF EXISTS
-- permitiría continuar. La consulta es declarativa y no ejecuta DROP alguno.
-- expected_drop=false identifica una policy REMOTA ADICIONAL no eliminada por 002;
-- revisar especialmente si cmd permite escritura o qual/with_check usa is_admin/is_editor.
with expected(schema_name, table_name, policy_name) as (values
  ('public','platforms','Admins manage platforms'),
  ('public','platforms','Anyone can view active platforms'),
  ('public','prop_firm_details','Admins manage prop firm details'),
  ('public','platform_availability','Admins manage availability'),
  ('public','platform_translations','Editors manage translations'),
  ('public','platform_markets','platform_markets_public_read'),
  ('public','platform_markets','Admins can view platform markets'),
  ('public','platform_markets','Admins can insert platform markets'),
  ('public','platform_markets','Admins can update platform markets'),
  ('public','platform_markets','Admins can delete platform markets'),
  ('public','trading_platforms','trading_platforms_public_read'),
  ('public','trading_platforms','trading_platforms_admin_insert'),
  ('public','trading_platforms','trading_platforms_admin_update'),
  ('public','trading_platforms','trading_platforms_admin_delete'),
  ('public','transaction_methods','transaction_methods_public_read'),
  ('public','transaction_methods','transaction_methods_admin_insert'),
  ('public','transaction_methods','transaction_methods_admin_update'),
  ('public','transaction_methods','transaction_methods_admin_delete'),
  ('public','instrument_categories','instrument_categories_public_read'),
  ('public','instrument_categories','instrument_categories_admin_insert'),
  ('public','instrument_categories','instrument_categories_admin_update'),
  ('public','instrument_categories','instrument_categories_admin_delete'),
  ('public','platform_trading_platforms','platform_trading_platforms_admin_all'),
  ('public','platform_transaction_methods','platform_transaction_methods_admin_all'),
  ('public','platform_instruments','platform_instruments_admin_all'),
  ('public','countries','Admins manage countries'),
  ('public','challenges','Admins manage challenges'),
  ('public','challenges','Anyone can view active challenges'),
  ('public','account_plans','Admins manage account plans'),
  ('public','challenge_phases','challenge_phases_admin_insert'),
  ('public','challenge_phases','challenge_phases_admin_update'),
  ('public','challenge_phases','challenge_phases_admin_delete'),
  ('public','challenge_variants','challenge_variants_admin_all'),
  ('public','challenge_variant_phases','challenge_variant_phases_admin_all'),
  ('public','challenge_reward_options','challenge_reward_options_admin_insert'),
  ('public','challenge_reward_options','challenge_reward_options_admin_update'),
  ('public','challenge_reward_options','challenge_reward_options_admin_delete'),
  ('public','offers','Admins manage offers'),
  ('public','offers','Anyone can view active offers'),
  ('public','payouts','Admins manage payouts'),
  ('public','payouts','Anyone can view verified payouts'),
  ('public','payout_evidence','Users can view own payout evidence'),
  ('public','payout_evidence','Admins manage payout evidence'),
  ('public','payout_sources','Admins can view payout sources'),
  ('public','payout_sources','Admins can insert payout sources'),
  ('public','payout_sources','Admins can update payout sources'),
  ('public','payout_sources','Admins can delete payout sources'),
  ('public','platform_payout_metrics','platform_payout_metrics_admin_insert'),
  ('public','platform_payout_metrics','platform_payout_metrics_admin_update'),
  ('public','platform_payout_metrics','platform_payout_metrics_admin_delete'),
  ('public','external_platform_mappings','external_platform_mappings_admin_read'),
  ('public','external_platform_mappings','external_platform_mappings_admin_insert'),
  ('public','external_platform_mappings','external_platform_mappings_admin_update'),
  ('public','external_platform_mappings','external_platform_mappings_admin_delete'),
  ('public','platform_research_status','platform_research_status_admin_read'),
  ('public','platform_research_status','platform_research_status_admin_insert'),
  ('public','platform_research_status','platform_research_status_admin_update'),
  ('public','platform_research_status','platform_research_status_admin_delete'),
  ('public','affiliate_links','Admins manage affiliate links'),
  ('public','affiliate_clicks','System records affiliate clicks'),
  ('public','affiliate_clicks','Admins view affiliate clicks'),
  ('public','home_featured_platforms','home_featured_platforms_admin_all'),
  ('public','site_content','Editors manage site content'),
  ('public','languages','Admins can view languages'),
  ('public','languages','Admins can insert languages'),
  ('public','languages','Admins can update languages'),
  ('public','languages','Admins can delete languages'),
  ('public','media','Editors manage media'),
  ('public','media','Authenticated users can insert media'),
  ('public','media','media_admin_update'),
  ('public','media_categories','media_categories_admin_read'),
  ('public','media_categories','media_categories_admin_insert'),
  ('public','media_categories','media_categories_admin_update'),
  ('public','media_categories','media_categories_admin_delete'),
  ('storage','objects','Authenticated users can upload media'),
  ('storage','objects','Authenticated users can view media'),
  ('public','profiles','Admins can manage profiles'),
  ('public','profiles','Users can view own profile'),
  ('public','profiles','Users can update own profile'),
  ('public','trading_profiles','Users manage own trading profile')
), actual as (
  select p.* from pg_catalog.pg_policies p
  where exists (select 1 from expected e
    where e.schema_name = p.schemaname and e.table_name = p.tablename)
)
select coalesce(e.schema_name,p.schemaname) as schema_name,
  coalesce(e.table_name,p.tablename) as table_name,
  coalesce(e.policy_name,p.policyname) as policy_name,
  e.policy_name is not null as expected_drop,
  p.policyname is not null as exists_remotely,
  p.cmd, p.roles, p.qual, p.with_check
from expected e full outer join actual p
  on p.schemaname = e.schema_name and p.tablename = e.table_name
  and p.policyname = e.policy_name
order by schema_name, table_name, policy_name;

-- I. Owner, SECURITY DEFINER, search_path y EXECUTE de funciones heredadas.
select n.nspname as schema_name, p.proname,
  pg_catalog.pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer, p.proconfig as function_config,
  exists (select 1 from pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f',p.proowner))) a
    where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_execute,
  pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('is_admin','is_editor')
order by p.proname;
