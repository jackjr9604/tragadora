-- Migración determinista. Requiere 202609170001. No cambia is_admin()/is_editor().
-- Solo se eliminan policies por nombre; una aserción final aborta si queda un bypass.
begin;

-- PLATFORMS: lectura pública activa y administración por acción.
drop policy if exists "Admins manage platforms" on public.platforms;
drop policy if exists "Anyone can view active platforms" on public.platforms;
create policy "Anyone can view active platforms" on public.platforms for select to public using (status = 'active');
create policy tg_platforms_view on public.platforms for select to authenticated using (public.has_admin_permission('platforms.view'));
create policy tg_platforms_create on public.platforms for insert to authenticated with check (public.has_admin_permission('platforms.create'));
create policy tg_platforms_update on public.platforms for update to authenticated using (public.has_admin_permission('platforms.update')) with check (public.has_admin_permission('platforms.update'));
create policy tg_platforms_delete on public.platforms for delete to authenticated using (public.has_admin_permission('platforms.delete'));

-- Details y disponibilidad: conservar sus SELECT públicos existentes.
drop policy if exists "Admins manage prop firm details" on public.prop_firm_details;
create policy tg_details_view on public.prop_firm_details for select to authenticated using (public.has_admin_permission('platforms.view'));
create policy tg_details_create on public.prop_firm_details for insert to authenticated with check (public.has_admin_permission('platforms.create'));
create policy tg_details_update on public.prop_firm_details for update to authenticated using (public.has_admin_permission('platforms.update')) with check (public.has_admin_permission('platforms.update'));
create policy tg_details_delete on public.prop_firm_details for delete to authenticated using (public.has_admin_permission('platforms.delete'));
drop policy if exists "Admins manage availability" on public.platform_availability;
create policy tg_availability_view on public.platform_availability for select to authenticated using (public.has_admin_permission('platforms.view'));
create policy tg_availability_create on public.platform_availability for insert to authenticated with check (public.has_admin_permission('platforms.create'));
create policy tg_availability_update on public.platform_availability for update to authenticated using (public.has_admin_permission('platforms.update')) with check (public.has_admin_permission('platforms.update'));
create policy tg_availability_delete on public.platform_availability for delete to authenticated using (public.has_admin_permission('platforms.delete'));

-- Platform translations: remover ALL is_editor(); conservar su SELECT público.
drop policy if exists "Editors manage translations" on public.platform_translations;
create policy tg_platform_translations_view on public.platform_translations for select to authenticated using (public.has_admin_permission('platforms.view'));
create policy tg_platform_translations_create on public.platform_translations for insert to authenticated with check (public.has_admin_permission('platforms.create'));
create policy tg_platform_translations_update on public.platform_translations for update to authenticated using (public.has_admin_permission('platforms.update')) with check (public.has_admin_permission('platforms.update'));
create policy tg_platform_translations_delete on public.platform_translations for delete to authenticated using (public.has_admin_permission('platforms.delete'));

-- Platform markets: regla pública exacta de la migración 202609010002.
drop policy if exists platform_markets_public_read on public.platform_markets;
create policy platform_markets_public_read on public.platform_markets for select to public using (
  exists (select 1 from public.platforms p where p.id = platform_markets.platform_id and p.type = 'prop_firm' and p.status = 'active')
);
drop policy if exists "Admins can view platform markets" on public.platform_markets;
drop policy if exists "Admins can insert platform markets" on public.platform_markets;
drop policy if exists "Admins can update platform markets" on public.platform_markets;
drop policy if exists "Admins can delete platform markets" on public.platform_markets;
create policy tg_platform_markets_view on public.platform_markets for select to authenticated using (public.has_admin_permission('platforms.view'));
create policy tg_platform_markets_create on public.platform_markets for insert to authenticated with check (public.has_admin_permission('platforms.create'));
create policy tg_platform_markets_update on public.platform_markets for update to authenticated using (public.has_admin_permission('platforms.update')) with check (public.has_admin_permission('platforms.update'));
create policy tg_platform_markets_delete on public.platform_markets for delete to authenticated using (public.has_admin_permission('platforms.delete'));

-- Catálogos Phase 1: status=true público, inactivos solo platforms.view.
drop policy if exists trading_platforms_public_read on public.trading_platforms;
create policy trading_platforms_public_read on public.trading_platforms for select to public using (status);
drop policy if exists trading_platforms_admin_insert on public.trading_platforms;
drop policy if exists trading_platforms_admin_update on public.trading_platforms;
drop policy if exists trading_platforms_admin_delete on public.trading_platforms;
create policy tg_trading_platforms_view on public.trading_platforms for select to authenticated using (public.has_admin_permission('platforms.view'));
create policy tg_trading_platforms_create on public.trading_platforms for insert to authenticated with check (public.has_admin_permission('platforms.create'));
create policy tg_trading_platforms_update on public.trading_platforms for update to authenticated using (public.has_admin_permission('platforms.update')) with check (public.has_admin_permission('platforms.update'));
create policy tg_trading_platforms_delete on public.trading_platforms for delete to authenticated using (public.has_admin_permission('platforms.delete'));
drop policy if exists transaction_methods_public_read on public.transaction_methods;
create policy transaction_methods_public_read on public.transaction_methods for select to public using (status);
drop policy if exists transaction_methods_admin_insert on public.transaction_methods;
drop policy if exists transaction_methods_admin_update on public.transaction_methods;
drop policy if exists transaction_methods_admin_delete on public.transaction_methods;
create policy tg_transaction_methods_view on public.transaction_methods for select to authenticated using (public.has_admin_permission('platforms.view'));
create policy tg_transaction_methods_create on public.transaction_methods for insert to authenticated with check (public.has_admin_permission('platforms.create'));
create policy tg_transaction_methods_update on public.transaction_methods for update to authenticated using (public.has_admin_permission('platforms.update')) with check (public.has_admin_permission('platforms.update'));
create policy tg_transaction_methods_delete on public.transaction_methods for delete to authenticated using (public.has_admin_permission('platforms.delete'));
drop policy if exists instrument_categories_public_read on public.instrument_categories;
create policy instrument_categories_public_read on public.instrument_categories for select to public using (status);
drop policy if exists instrument_categories_admin_insert on public.instrument_categories;
drop policy if exists instrument_categories_admin_update on public.instrument_categories;
drop policy if exists instrument_categories_admin_delete on public.instrument_categories;
create policy tg_instrument_categories_view on public.instrument_categories for select to authenticated using (public.has_admin_permission('platforms.view'));
create policy tg_instrument_categories_create on public.instrument_categories for insert to authenticated with check (public.has_admin_permission('platforms.create'));
create policy tg_instrument_categories_update on public.instrument_categories for update to authenticated using (public.has_admin_permission('platforms.update')) with check (public.has_admin_permission('platforms.update'));
create policy tg_instrument_categories_delete on public.instrument_categories for delete to authenticated using (public.has_admin_permission('platforms.delete'));

-- Relaciones Phase 1: sus SELECT públicos con EXISTS(catalog.status) quedan intactos.
drop policy if exists platform_trading_platforms_admin_all on public.platform_trading_platforms;
create policy tg_platform_trading_platforms_view on public.platform_trading_platforms for select to authenticated using (public.has_admin_permission('platforms.view'));
create policy tg_platform_trading_platforms_create on public.platform_trading_platforms for insert to authenticated with check (public.has_admin_permission('platforms.create'));
create policy tg_platform_trading_platforms_update on public.platform_trading_platforms for update to authenticated using (public.has_admin_permission('platforms.update')) with check (public.has_admin_permission('platforms.update'));
create policy tg_platform_trading_platforms_delete on public.platform_trading_platforms for delete to authenticated using (public.has_admin_permission('platforms.delete'));
drop policy if exists platform_transaction_methods_admin_all on public.platform_transaction_methods;
create policy tg_platform_transaction_methods_view on public.platform_transaction_methods for select to authenticated using (public.has_admin_permission('platforms.view'));
create policy tg_platform_transaction_methods_create on public.platform_transaction_methods for insert to authenticated with check (public.has_admin_permission('platforms.create'));
create policy tg_platform_transaction_methods_update on public.platform_transaction_methods for update to authenticated using (public.has_admin_permission('platforms.update')) with check (public.has_admin_permission('platforms.update'));
create policy tg_platform_transaction_methods_delete on public.platform_transaction_methods for delete to authenticated using (public.has_admin_permission('platforms.delete'));
drop policy if exists platform_instruments_admin_all on public.platform_instruments;
create policy tg_platform_instruments_view on public.platform_instruments for select to authenticated using (public.has_admin_permission('platforms.view'));
create policy tg_platform_instruments_create on public.platform_instruments for insert to authenticated with check (public.has_admin_permission('platforms.create'));
create policy tg_platform_instruments_update on public.platform_instruments for update to authenticated using (public.has_admin_permission('platforms.update')) with check (public.has_admin_permission('platforms.update'));
create policy tg_platform_instruments_delete on public.platform_instruments for delete to authenticated using (public.has_admin_permission('platforms.delete'));

-- Countries: conservar la policy SELECT pública previa sin alterar predicado.
drop policy if exists "Admins manage countries" on public.countries;
create policy tg_countries_view on public.countries for select to authenticated using (public.has_admin_permission('platforms.view'));
create policy tg_countries_create on public.countries for insert to authenticated with check (public.has_admin_permission('platforms.create'));
create policy tg_countries_update on public.countries for update to authenticated using (public.has_admin_permission('platforms.update')) with check (public.has_admin_permission('platforms.update'));
create policy tg_countries_delete on public.countries for delete to authenticated using (public.has_admin_permission('platforms.delete'));

-- Challenges: las lecturas públicas de planes/fases/variantes/rewards quedan intactas.
drop policy if exists "Admins manage challenges" on public.challenges;
drop policy if exists "Anyone can view active challenges" on public.challenges;
create policy "Anyone can view active challenges" on public.challenges for select to public using (status = 'active');
create policy tg_challenges_view on public.challenges for select to authenticated using (public.has_admin_permission('challenges.view'));
create policy tg_challenges_create on public.challenges for insert to authenticated with check (public.has_admin_permission('challenges.create'));
create policy tg_challenges_update on public.challenges for update to authenticated using (public.has_admin_permission('challenges.update')) with check (public.has_admin_permission('challenges.update'));
create policy tg_challenges_delete on public.challenges for delete to authenticated using (public.has_admin_permission('challenges.delete'));
drop policy if exists "Admins manage account plans" on public.account_plans;
create policy tg_account_plans_view on public.account_plans for select to authenticated using (public.has_admin_permission('challenges.view'));
create policy tg_account_plans_create on public.account_plans for insert to authenticated with check (public.has_admin_permission('challenges.create'));
create policy tg_account_plans_update on public.account_plans for update to authenticated using (public.has_admin_permission('challenges.update')) with check (public.has_admin_permission('challenges.update'));
create policy tg_account_plans_delete on public.account_plans for delete to authenticated using (public.has_admin_permission('challenges.delete'));
drop policy if exists challenge_phases_admin_insert on public.challenge_phases;
drop policy if exists challenge_phases_admin_update on public.challenge_phases;
drop policy if exists challenge_phases_admin_delete on public.challenge_phases;
create policy tg_challenge_phases_view on public.challenge_phases for select to authenticated using (public.has_admin_permission('challenges.view'));
create policy tg_challenge_phases_create on public.challenge_phases for insert to authenticated with check (public.has_admin_permission('challenges.create'));
create policy tg_challenge_phases_update on public.challenge_phases for update to authenticated using (public.has_admin_permission('challenges.update')) with check (public.has_admin_permission('challenges.update'));
create policy tg_challenge_phases_delete on public.challenge_phases for delete to authenticated using (public.has_admin_permission('challenges.delete'));
drop policy if exists challenge_variants_admin_all on public.challenge_variants;
create policy tg_challenge_variants_view on public.challenge_variants for select to authenticated using (public.has_admin_permission('challenges.view'));
create policy tg_challenge_variants_create on public.challenge_variants for insert to authenticated with check (public.has_admin_permission('challenges.create'));
create policy tg_challenge_variants_update on public.challenge_variants for update to authenticated using (public.has_admin_permission('challenges.update')) with check (public.has_admin_permission('challenges.update'));
create policy tg_challenge_variants_delete on public.challenge_variants for delete to authenticated using (public.has_admin_permission('challenges.delete'));
drop policy if exists challenge_variant_phases_admin_all on public.challenge_variant_phases;
create policy tg_challenge_variant_phases_view on public.challenge_variant_phases for select to authenticated using (public.has_admin_permission('challenges.view'));
create policy tg_challenge_variant_phases_create on public.challenge_variant_phases for insert to authenticated with check (public.has_admin_permission('challenges.create'));
create policy tg_challenge_variant_phases_update on public.challenge_variant_phases for update to authenticated using (public.has_admin_permission('challenges.update')) with check (public.has_admin_permission('challenges.update'));
create policy tg_challenge_variant_phases_delete on public.challenge_variant_phases for delete to authenticated using (public.has_admin_permission('challenges.delete'));
drop policy if exists challenge_reward_options_admin_insert on public.challenge_reward_options;
drop policy if exists challenge_reward_options_admin_update on public.challenge_reward_options;
drop policy if exists challenge_reward_options_admin_delete on public.challenge_reward_options;
create policy tg_challenge_reward_options_view on public.challenge_reward_options for select to authenticated using (public.has_admin_permission('challenges.view'));
create policy tg_challenge_reward_options_create on public.challenge_reward_options for insert to authenticated with check (public.has_admin_permission('challenges.create'));
create policy tg_challenge_reward_options_update on public.challenge_reward_options for update to authenticated using (public.has_admin_permission('challenges.update')) with check (public.has_admin_permission('challenges.update'));
create policy tg_challenge_reward_options_delete on public.challenge_reward_options for delete to authenticated using (public.has_admin_permission('challenges.delete'));

-- Offers: lectura pública status=true.
drop policy if exists "Admins manage offers" on public.offers;
drop policy if exists "Anyone can view active offers" on public.offers;
create policy "Anyone can view active offers" on public.offers for select to public using (status = true);
create policy tg_offers_view on public.offers for select to authenticated using (public.has_admin_permission('offers.view'));
create policy tg_offers_create on public.offers for insert to authenticated with check (public.has_admin_permission('offers.create'));
create policy tg_offers_update on public.offers for update to authenticated using (public.has_admin_permission('offers.update')) with check (public.has_admin_permission('offers.update'));
create policy tg_offers_delete on public.offers for delete to authenticated using (public.has_admin_permission('offers.delete'));

-- Payouts: lectura de verificados/automáticos o fila propia, sin is_admin().
drop policy if exists "Admins manage payouts" on public.payouts;
drop policy if exists "Anyone can view verified payouts" on public.payouts;
create policy "Anyone can view verified payouts" on public.payouts for select to public using (
  verification_status in ('verified', 'automatic') or user_id = auth.uid()
);
create policy tg_payouts_view on public.payouts for select to authenticated using (public.has_admin_permission('payouts.view'));
create policy tg_payouts_create on public.payouts for insert to authenticated with check (public.has_admin_permission('payouts.create'));
create policy tg_payouts_update on public.payouts for update to authenticated using (public.has_admin_permission('payouts.update')) with check (public.has_admin_permission('payouts.update'));
create policy tg_payouts_delete on public.payouts for delete to authenticated using (public.has_admin_permission('payouts.delete'));

-- Evidencia: usuario ve solo evidencia de sus payouts; administración separada.
drop policy if exists "Users can view own payout evidence" on public.payout_evidence;
create policy "Users can view own payout evidence" on public.payout_evidence for select to authenticated using (
  exists (select 1 from public.payouts p where p.id = payout_evidence.payout_id and p.user_id = auth.uid())
);
drop policy if exists "Admins manage payout evidence" on public.payout_evidence;
create policy tg_payout_evidence_view on public.payout_evidence for select to authenticated using (public.has_admin_permission('payouts.view'));
create policy tg_payout_evidence_create on public.payout_evidence for insert to authenticated with check (public.has_admin_permission('payouts.create'));
create policy tg_payout_evidence_update on public.payout_evidence for update to authenticated using (public.has_admin_permission('payouts.update')) with check (public.has_admin_permission('payouts.update'));
create policy tg_payout_evidence_delete on public.payout_evidence for delete to authenticated using (public.has_admin_permission('payouts.delete'));

-- Payout sources y métricas externas. El admin gestiona mappings en Payouts.
drop policy if exists "Admins can view payout sources" on public.payout_sources;
drop policy if exists "Admins can insert payout sources" on public.payout_sources;
drop policy if exists "Admins can update payout sources" on public.payout_sources;
drop policy if exists "Admins can delete payout sources" on public.payout_sources;
create policy tg_payout_sources_view on public.payout_sources for select to authenticated using (public.has_admin_permission('payouts.view'));
create policy tg_payout_sources_create on public.payout_sources for insert to authenticated with check (public.has_admin_permission('payouts.create'));
create policy tg_payout_sources_update on public.payout_sources for update to authenticated using (public.has_admin_permission('payouts.update')) with check (public.has_admin_permission('payouts.update'));
create policy tg_payout_sources_delete on public.payout_sources for delete to authenticated using (public.has_admin_permission('payouts.delete'));
drop policy if exists platform_payout_metrics_admin_insert on public.platform_payout_metrics;
drop policy if exists platform_payout_metrics_admin_update on public.platform_payout_metrics;
drop policy if exists platform_payout_metrics_admin_delete on public.platform_payout_metrics;
-- platform_payout_metrics_public_read USING true permanece intacta.
create policy tg_payout_metrics_create on public.platform_payout_metrics for insert to authenticated with check (public.has_admin_permission('payouts.create'));
create policy tg_payout_metrics_update on public.platform_payout_metrics for update to authenticated using (public.has_admin_permission('payouts.update')) with check (public.has_admin_permission('payouts.update'));
create policy tg_payout_metrics_delete on public.platform_payout_metrics for delete to authenticated using (public.has_admin_permission('payouts.delete'));
drop policy if exists external_platform_mappings_admin_read on public.external_platform_mappings;
drop policy if exists external_platform_mappings_admin_insert on public.external_platform_mappings;
drop policy if exists external_platform_mappings_admin_update on public.external_platform_mappings;
drop policy if exists external_platform_mappings_admin_delete on public.external_platform_mappings;
create policy tg_external_mappings_view on public.external_platform_mappings for select to authenticated using (public.has_admin_permission('payouts.view'));
create policy tg_external_mappings_create on public.external_platform_mappings for insert to authenticated with check (public.has_admin_permission('payouts.create'));
create policy tg_external_mappings_update on public.external_platform_mappings for update to authenticated using (public.has_admin_permission('payouts.update')) with check (public.has_admin_permission('payouts.update'));
create policy tg_external_mappings_delete on public.external_platform_mappings for delete to authenticated using (public.has_admin_permission('payouts.delete'));

-- Investigación: no hay platform_research.delete; el DELETE anterior desaparece.
drop policy if exists platform_research_status_admin_read on public.platform_research_status;
drop policy if exists platform_research_status_admin_insert on public.platform_research_status;
drop policy if exists platform_research_status_admin_update on public.platform_research_status;
drop policy if exists platform_research_status_admin_delete on public.platform_research_status;
create policy tg_research_view on public.platform_research_status for select to authenticated using (public.has_admin_permission('platform_research.view'));
create policy tg_research_create on public.platform_research_status for insert to authenticated with check (public.has_admin_permission('platform_research.create'));
create policy tg_research_update on public.platform_research_status for update to authenticated using (public.has_admin_permission('platform_research.update')) with check (public.has_admin_permission('platform_research.update'));

-- Affiliates: /go usa createAdminClient/service_role; no INSERT directo de clicks.
drop policy if exists "Admins manage affiliate links" on public.affiliate_links;
create policy tg_affiliate_links_view on public.affiliate_links for select to authenticated using (public.has_admin_permission('affiliate_links.view'));
create policy tg_affiliate_links_create on public.affiliate_links for insert to authenticated with check (public.has_admin_permission('affiliate_links.create'));
create policy tg_affiliate_links_update on public.affiliate_links for update to authenticated using (public.has_admin_permission('affiliate_links.update')) with check (public.has_admin_permission('affiliate_links.update'));
create policy tg_affiliate_links_delete on public.affiliate_links for delete to authenticated using (public.has_admin_permission('affiliate_links.delete'));
drop policy if exists "System records affiliate clicks" on public.affiliate_clicks;
drop policy if exists "Admins view affiliate clicks" on public.affiliate_clicks;
create policy tg_affiliate_clicks_view on public.affiliate_clicks for select to authenticated using (public.has_admin_permission('affiliate_links.view'));

-- Home: home_featured_platforms_public_read permanece intacta.
drop policy if exists home_featured_platforms_admin_all on public.home_featured_platforms;
create policy tg_home_view on public.home_featured_platforms for select to authenticated using (public.has_admin_permission('home.view'));
create policy tg_home_create on public.home_featured_platforms for insert to authenticated with check (public.has_admin_permission('home.create'));
create policy tg_home_update on public.home_featured_platforms for update to authenticated using (public.has_admin_permission('home.update')) with check (public.has_admin_permission('home.update'));
create policy tg_home_delete on public.home_featured_platforms for delete to authenticated using (public.has_admin_permission('home.delete'));

-- Content: lectura pública de site_content/languages no se toca.
drop policy if exists "Editors manage site content" on public.site_content;
create policy tg_site_content_view on public.site_content for select to authenticated using (public.has_admin_permission('content.view'));
create policy tg_site_content_create on public.site_content for insert to authenticated with check (public.has_admin_permission('content.create'));
create policy tg_site_content_update on public.site_content for update to authenticated using (public.has_admin_permission('content.update')) with check (public.has_admin_permission('content.update'));
create policy tg_site_content_delete on public.site_content for delete to authenticated using (public.has_admin_permission('content.delete'));
drop policy if exists "Admins can view languages" on public.languages;
drop policy if exists "Admins can insert languages" on public.languages;
drop policy if exists "Admins can update languages" on public.languages;
drop policy if exists "Admins can delete languages" on public.languages;
create policy tg_languages_view on public.languages for select to authenticated using (public.has_admin_permission('content.view'));
create policy tg_languages_create on public.languages for insert to authenticated with check (public.has_admin_permission('content.create'));
create policy tg_languages_update on public.languages for update to authenticated using (public.has_admin_permission('content.update')) with check (public.has_admin_permission('content.update'));
create policy tg_languages_delete on public.languages for delete to authenticated using (public.has_admin_permission('content.delete'));
-- Media: conservar "Anyone can view media" y lectura pública de categorías.
drop policy if exists "Editors manage media" on public.media;
drop policy if exists "Authenticated users can insert media" on public.media;
drop policy if exists media_admin_update on public.media;
create policy tg_media_create on public.media for insert to authenticated with check (public.has_admin_permission('media.create'));
create policy tg_media_update on public.media for update to authenticated using (public.has_admin_permission('media.update')) with check (public.has_admin_permission('media.update'));
create policy tg_media_delete on public.media for delete to authenticated using (public.has_admin_permission('media.delete'));
drop policy if exists media_categories_admin_read on public.media_categories;
drop policy if exists media_categories_admin_insert on public.media_categories;
drop policy if exists media_categories_admin_update on public.media_categories;
drop policy if exists media_categories_admin_delete on public.media_categories;
create policy tg_media_categories_view on public.media_categories for select to authenticated using (public.has_admin_permission('media.view'));
create policy tg_media_categories_create on public.media_categories for insert to authenticated with check (public.has_admin_permission('media.create'));
create policy tg_media_categories_update on public.media_categories for update to authenticated using (public.has_admin_permission('media.update')) with check (public.has_admin_permission('media.update'));
create policy tg_media_categories_delete on public.media_categories for delete to authenticated using (public.has_admin_permission('media.delete'));

-- Storage: imágenes públicas via URL del bucket; no hay reemplazo/borrado UI.
drop policy if exists "Authenticated users can upload media" on storage.objects;
create policy tg_storage_media_upload on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.has_admin_permission('media.create'));
drop policy if exists "Authenticated users can view media" on storage.objects;
create policy tg_storage_media_admin_view on storage.objects for select to authenticated using (bucket_id = 'media' and public.has_admin_permission('media.view'));

-- Profiles: acceso propio sin is_admin(); solo users.view permite lectura global.
drop policy if exists "Admins can manage profiles" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Users can update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy tg_profiles_super_admin_view on public.profiles for select to authenticated using (public.has_admin_permission('users.view'));
revoke update on public.profiles from public, anon, authenticated;
revoke update (id, role, created_at, updated_at) on public.profiles from public, anon, authenticated;
grant update (name, username, avatar_url, country_code, preferred_language) on public.profiles to authenticated;
grant update on public.profiles to service_role;
-- guard_profile_role_trigger (001) protege además role/id/created_at.

-- Trading profiles no son plataforma ni usuarios administrativos.
drop policy if exists "Users manage own trading profile" on public.trading_profiles;
create policy "Users manage own trading profile" on public.trading_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Validación fail-closed: la consulta NO genera policies; revierte la migración
-- completa si queda algún is_admin()/is_editor() en las tablas migradas.
do $$ begin
  if exists (
    select 1 from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.tablename in (
        'platforms','prop_firm_details','platform_translations','platform_availability',
        'platform_markets','platform_instruments','platform_trading_platforms',
        'platform_transaction_methods','trading_platforms','transaction_methods',
        'instrument_categories','countries','challenges','account_plans',
        'challenge_phases','challenge_variants','challenge_variant_phases',
        'challenge_reward_options','offers','payouts','payout_evidence',
        'payout_sources','platform_payout_metrics','external_platform_mappings',
        'platform_research_status','affiliate_links','affiliate_clicks',
        'home_featured_platforms','site_content','languages',
        'media','media_categories','profiles','trading_profiles'
      )
      and (position('is_admin(' in pg_catalog.lower(coalesce(p.qual,''))) > 0
        or position('is_admin(' in pg_catalog.lower(coalesce(p.with_check,''))) > 0
        or position('is_editor(' in pg_catalog.lower(coalesce(p.qual,''))) > 0
        or position('is_editor(' in pg_catalog.lower(coalesce(p.with_check,''))) > 0)
  ) then
    raise exception 'Persisten policies is_admin()/is_editor() fuera del inventario. Revisar pg_policies antes de aplicar.';
  end if;
  if exists (
    select 1 from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.tablename in ('platforms','prop_firm_details','platform_translations',
        'platform_availability','platform_markets','platform_instruments',
        'platform_trading_platforms','platform_transaction_methods','countries',
        'challenges','account_plans','challenge_phases','challenge_variants',
        'challenge_variant_phases','challenge_reward_options','offers','payouts',
        'payout_evidence','payout_sources','platform_payout_metrics',
        'external_platform_mappings','platform_research_status','affiliate_links',
        'affiliate_clicks','home_featured_platforms','site_content','languages',
        'media','media_categories','profiles')
      and p.cmd in ('ALL','INSERT','UPDATE','DELETE')
      and p.roles && array['authenticated','public']::name[]
      and pg_catalog.regexp_replace(coalesce(p.with_check, p.qual, ''), '[()[:space:]]', '', 'g') = 'true'
  ) then
    raise exception 'Persiste una policy de escritura autenticada WITH CHECK true. Revisar pg_policies.';
  end if;
  -- Una expresión equivalente a TRUE podría eludir la comparación textual.
  -- Ninguna escritura administrativa vieja debe sobrevivir con otro nombre.
  if exists (
    select 1 from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.tablename in ('platforms','prop_firm_details','platform_translations',
        'platform_availability','platform_markets','platform_instruments',
        'platform_trading_platforms','platform_transaction_methods','countries',
        'trading_platforms','transaction_methods','instrument_categories',
        'challenges','account_plans','challenge_phases','challenge_variants',
        'challenge_variant_phases','challenge_reward_options','offers','payouts',
        'payout_evidence','payout_sources','platform_payout_metrics',
        'external_platform_mappings','platform_research_status','affiliate_links',
        'affiliate_clicks','home_featured_platforms','site_content','languages',
        'media','media_categories','profiles',
        'trading_profiles')
      and p.cmd in ('ALL','INSERT','UPDATE','DELETE')
      and p.roles && array['anon','authenticated','public']::name[]
      and pg_catalog.left(p.policyname, 3) <> 'tg_'
      and not (p.tablename = 'profiles' and p.policyname = 'Users can update own profile')
      and not (p.tablename = 'trading_profiles' and p.policyname = 'Users manage own trading profile')
  ) then
    raise exception 'Persiste una policy de escritura no inventariada. Revisar pg_policies antes de aplicar.';
  end if;
end $$;

commit;
