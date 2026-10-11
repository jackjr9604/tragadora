import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync('supabase/migrations/202610100002_offer_translations.sql', 'utf8')

test('la migración conserva una identidad offer_id + language y no copia condiciones comerciales', () => {
  assert.match(sql, /primary key \(offer_id, language\)/i)
  assert.doesNotMatch(sql, /offer_translations[\s\S]{0,400}(discount_value|promo_code|affiliate_link_id)/i)
})

test('registra exactamente los cinco campos y no crea jobs', () => {
  for (const field of ['title', 'description', 'free_account_label', 'hot_badge', 'short_highlight']) {
    assert.match(sql, new RegExp(`'offer_translation','${field}'`))
  }
  assert.match(sql, /if exists\(select 1 from public\.translation_jobs where resource_type='offer_translation'\)/i)
  assert.doesNotMatch(sql, /insert into public\.translation_jobs/i)
})

test('usa triggers separados y permisos granulares de offers', () => {
  assert.match(sql, /translation_offer_source_insert_trigger/i)
  assert.match(sql, /translation_offer_source_update_trigger/i)
  assert.match(sql, /translation_offer_source_delete_trigger/i)
  assert.match(sql, /when 'offer_translation' then 'offers\.update'/i)
  assert.match(sql, /resource_type='offer_translation' and public\.has_admin_permission\('offers\.view'\)/i)
})

test('protege escrituras directas y mantiene la inicialización sin textos ni jobs', () => {
  assert.match(sql, /revoke all on public\.offer_translations from public,anon,authenticated/i)
  assert.doesNotMatch(sql, /insert into public\.offer_translations[\s\S]{0,300}select[\s\S]{0,100}from public\.offers/i)
})

test('usa offers.language como fuente activa y conserva el fallback al idioma base', () => {
  assert.match(sql, /select l\.code from public\.languages l where l\.code=o\.language and l\.is_active/i)
  assert.match(sql, /translation_register_offer_source_change_internal/i)
  assert.doesNotMatch(sql, /translation_register_source_change_internal\('offer_translation'/i)
})

test('revoca los helpers SECURITY DEFINER del adaptador de ofertas', () => {
  assert.match(sql, /revoke all on function public\.translation_register_offer_source_change_internal\(text,text,text\) from public,anon,authenticated/i)
  assert.match(sql, /when 'offer_translation' then 'offers\.update'/i)
})
