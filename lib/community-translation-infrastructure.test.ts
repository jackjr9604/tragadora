import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql=readFileSync('supabase/migrations/202610110003_community_translations.sql','utf8')
test('3D.3 registra solo cuatro campos y conserva identidad',()=>{assert.match(sql,/primary key\(community_id,language\)/);for(const field of ['short_description','category_label','region_label','badge'])assert.match(sql,new RegExp(`'community_translation','${field}'`));assert.doesNotMatch(sql,/'community_translation','name'/)})
test('3D.3 usa communities update/view y protege helpers',()=>{assert.match(sql,/p_resource_type='community_translation' then 'communities\.update'/);assert.match(sql,/has_admin_permission\('communities\.view'\)/);assert.match(sql,/revoke all on function public\.translation_read_value_before_communities/);assert.match(sql,/revoke all on function public\.translation_write_value_before_communities/)})
test('3D.3 separa triggers y no crea traducciones ni jobs',()=>{for(const operation of ['insert','update','delete'])assert.match(sql,new RegExp(`translation_community_source_${operation}`));assert.match(sql,/3D\.3 no debe crear translation_jobs/);assert.match(sql,/3D\.3 no debe crear traducciones/)})
