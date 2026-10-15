import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

test('el CMS edita solo fuente/global y enlaza el workflow común',()=>{
  const editor=readFileSync('components/admin/content/PageContentEditor.tsx','utf8')
  const action=readFileSync('app/admin/content/[page]/actions.ts','utf8')
  assert.match(editor,/savePageSourceContent/)
  assert.match(editor,/content-center\/translations\/site_content/)
  assert.doesNotMatch(editor,/api\/admin\/(?:content\/translate|translations)/)
  assert.doesNotMatch(editor,/overwriteTranslations|translateGroups|applyTranslationBatch/)
  assert.match(action,/eq\('is_default', true\)/)
  assert.match(action,/language: 'global'/)
  assert.doesNotMatch(action,/targetLanguage|target_language/)
})

test('las rutas antiguas de traducción directa fueron retiradas',()=>{
  assert.equal(existsSync('app/api/admin/content/translate/route.ts'),false)
  assert.equal(existsSync('app/api/admin/translations/route.ts'),false)
  assert.equal(existsSync('app/api/admin/content/revalidate/route.ts'),false)
})

test('la migración bloquea DML destino y permite únicamente publication RPC',()=>{
  const sql=readFileSync('supabase/migrations/202610140003_site_content_editorial_enforcement.sql','utf8')
  assert.match(sql,/before insert or update or delete on public\.site_content/i)
  assert.match(sql,/create policy tg_site_content_create[\s\S]*language='global'[\s\S]*l\.is_default/i)
  assert.match(sql,/create policy tg_site_content_update[\s\S]*language='global'[\s\S]*l\.is_default/i)
  assert.match(sql,/create policy tg_site_content_delete[\s\S]*language='global'[\s\S]*l\.is_default/i)
  assert.match(sql,/app\.translation_editor_publish_state/i)
  assert.match(sql,/raise exception 'Las traducciones de site_content solo pueden escribirse mediante el workflow editorial'/i)
  assert.match(sql,/revoke all on function public\.translation_site_content_editorial_write_guard\(\) from public,anon,authenticated/i)
  assert.doesNotMatch(sql,/insert into public\.translation_jobs|update public\.site_content|delete from public\.site_content/i)
})

test('publicar o retirar site_content usa revalidación centralizada',()=>{
  const actions=readFileSync('app/admin/translations/actions.ts','utf8')
  const helper=readFileSync('lib/admin-content-revalidation.ts','utf8')
  assert.match(actions,/resourceType === 'site_content'\) revalidateSiteContent\(row\.resource_id\)/)
  assert.match(actions,/parsed\.resourceType === 'site_content'\) revalidateSiteContent\(parsed\.resourceId\)/)
  assert.match(helper,/revalidateTag\('public-site-content', 'max'\)/)
})
