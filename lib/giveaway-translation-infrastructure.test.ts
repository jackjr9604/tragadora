import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql=readFileSync('supabase/migrations/202610120001_giveaway_translations.sql','utf8')
const fields=['title','short_description','prize_title','prize_description','badge','reveal_title','reveal_content']

test('3D.4 registra solo los siete campos editoriales reales y conserva identidad',()=>{
 assert.match(sql,/primary key\(giveaway_id,language\)/)
 for(const field of fields)assert.match(sql,new RegExp(`'giveaway_translation','${field}'`))
 for(const excluded of ['prize_quantity','starts_at','ends_at','participation_url','rules_url','sponsor_platform_id','slug','status','seo_title','seo_description'])assert.doesNotMatch(sql,new RegExp(`'giveaway_translation','${excluded}'`))
})

test('3D.4 usa giveaways update/view y protege helpers',()=>{
 assert.match(sql,/p_resource_type='giveaway_translation' then 'giveaways\.update'/)
 assert.match(sql,/has_admin_permission\('giveaways\.view'\)/)
 assert.match(sql,/revoke all on function public\.translation_read_value_before_giveaways/)
 assert.match(sql,/revoke all on function public\.translation_write_value_before_giveaways/)
})

test('3D.4 separa triggers y no crea traducciones ni jobs',()=>{
 for(const operation of ['insert','update','delete'])assert.match(sql,new RegExp(`translation_giveaway_source_${operation}`))
 assert.match(sql,/3D\.4 no debe crear translation_jobs/)
 assert.match(sql,/3D\.4 no debe crear traducciones/)
})
