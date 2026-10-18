import assert from 'node:assert/strict'
import { chromium, type Page } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { assertLocalE2eEnvironment } from './assert-local-environment'

const baseUrl='http://localhost:3001'
const resourceId='85110000-0000-4000-8000-000000000001'

void main().catch((error)=>{console.error(error);process.exitCode=1})

async function main(){
  const safe=assertLocalE2eEnvironment()
  assert.equal(safe.supabaseOrigin,'http://127.0.0.1:54321')
  const browser=await chromium.launch({headless:true})
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900}})
    const page=await context.newPage(),runtimeErrors:string[]=[]
    page.on('pageerror',(error)=>runtimeErrors.push(error.message))
    page.on('console',(message)=>{if(message.type()==='error')runtimeErrors.push(message.text())})
    await login(page,'review-admin@local.invalid','LocalOnly-Review-Admin!')
    await openReview(page)
    await assertNoEditorialMutations(page)
    await assertPagination(page)
    await filterBlogEnglish(page)
    await assertExclusions(page)
    await assertProtectedFilter(page)
    await filterBlogEnglish(page)
    await assertConcurrentPreview(page)
    await assertNoHorizontalOverflow(page,'desktop')
    await page.setViewportSize({width:390,height:844})
    await openReview(page)
    await assertNoHorizontalOverflow(page,'mobile')
    await context.clearCookies()
    await login(page,'review-viewer@local.invalid','LocalOnly-Review-Viewer!')
    await openReview(page)
    await assertText(page,'0 campos enviados a revisión')
    assert.equal(await page.getByRole('checkbox',{name:/Fuente sintética/}).count(),0,'Un usuario sin blog.update no debe recibir campos seleccionables')
    assert.deepEqual(runtimeErrors,[],'No deben existir errores runtime o console.error')
    console.log('Translation review authenticated smoke passed: desktop, mobile, permissions, filters, pagination and concurrency.')
  }finally{await browser.close()}
}

async function login(page:Page,email:string,password:string){
  const loginErrors:string[]=[]
  const recordPageError=(error:Error)=>loginErrors.push(error.message)
  const recordConsoleError=(message:{type():string;text():string})=>{if(message.type()==='error')loginErrors.push(message.text())}
  page.on('pageerror',recordPageError)
  page.on('console',recordConsoleError)
  const brandingResponse=page.waitForResponse((response)=>response.url().endsWith('/api/branding'),{timeout:15_000})
  await page.goto(`${baseUrl}/login`,{waitUntil:'domcontentloaded'})
  await brandingResponse
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  const authResponse=page.waitForResponse((response)=>response.url().includes('/auth/v1/token'),{timeout:10_000}).catch(()=>null)
  await page.getByRole('button',{name:'Iniciar sesión'}).click()
  try{await page.waitForURL(/\/admin(?:\/|$)/,{timeout:15_000})}
  catch(error){const alert=await page.getByRole('alert').textContent().catch(()=>null),response=await authResponse;throw new Error(`Login no llegó al admin: ${page.url()}${alert?`; ${alert}`:''}; auth=${response?.status()??'sin respuesta'}; errores=${loginErrors.join(' | ')||'ninguno'}`,{cause:error})}
  finally{page.off('pageerror',recordPageError);page.off('console',recordConsoleError)}
}
async function openReview(page:Page){const response=await page.goto(`${baseUrl}/admin/content-center/review`,{waitUntil:'networkidle'});assert.equal(response?.status(),200);assert.ok(!page.url().includes('/login'))}
async function assertPagination(page:Page){await assertText(page,'30 campos enviados a revisión');await assertText(page,'Página 1 de 2');await page.getByRole('link',{name:/Siguiente/}).click();await page.waitForURL(/page=2/);await assertText(page,'Página 2 de 2');await page.getByRole('link',{name:/Anterior/}).click()}
async function filterBlogEnglish(page:Page){await page.getByLabel('Módulo').selectOption('blog_post_translation');await page.getByLabel('Idioma').selectOption('en');await page.getByLabel('Protección').selectOption('');await page.getByRole('button',{name:'Filtrar'}).click();await page.waitForLoadState('networkidle');await assertText(page,'15 campos enviados a revisión')}
async function assertExclusions(page:Page){await assertText(page,'La fuente cambió y la traducción está desactualizada');await assertText(page,'El borrador corresponde a una versión anterior de la fuente');await assertText(page,'La traducción ya está publicada');const disabled=page.getByRole('checkbox',{disabled:true});assert.equal(await disabled.count(),3)}
async function assertProtectedFilter(page:Page){await page.getByLabel('Protección').selectOption('protected');await page.getByRole('button',{name:'Filtrar'}).click();await page.waitForLoadState('networkidle');await assertText(page,'1 campos enviados a revisión');await page.getByTitle('Protección manual').waitFor({state:'visible'})}
async function assertConcurrentPreview(page:Page){
  const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})
  const title=page.getByRole('checkbox',{name:/Fuente sintética uno title/i}),tags=page.getByRole('checkbox',{name:/Fuente sintética uno tags/i})
  await title.check();await tags.check()
  const state=await admin.from('translation_field_state').select('id,lock_version').eq('resource_type','blog_post_translation').eq('resource_id',resourceId).eq('field_name','tags').eq('target_language','en').single()
  assert.ifError(state.error)
  const changed=await admin.from('translation_field_state').update({lock_version:Number(state.data.lock_version)+1}).eq('id',state.data.id)
  assert.ifError(changed.error)
  await page.getByRole('button',{name:'Previsualizar selección'}).click()
  await assertText(page,'1 de 2 campos conservan una versión vigente')
  await assertText(page,'Cambió después de seleccionarla; recarga antes de continuar')
  await assertText(page,'Fuente sintética uno')
  await assertText(page,'Draft title en')
}
async function assertNoEditorialMutations(page:Page){for(const name of [/^Aprobar/i,/^Publicar/i,/^Rechazar/i])assert.equal(await page.getByRole('button',{name}).count(),0,`No debe existir la acción ${name}`)}
async function assertNoHorizontalOverflow(page:Page,label:string){const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);assert.equal(overflow,false,`La vista ${label} no debe producir scroll horizontal`)}
async function assertText(page:Page,text:string){await page.getByText(text,{exact:false}).first().waitFor({state:'visible'})}
