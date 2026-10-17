import { chromium } from 'playwright'

const baseUrl = 'http://localhost:3001'
void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

async function main() {
 const browser = await chromium.launch({ headless: true })
 try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))

  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2_000)
  await page.getByLabel('Correo electrónico').fill('e2e-browser@local.invalid')
  await page.getByLabel('Contraseña').fill('LocalOnly-3E8-Browser!')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.waitForTimeout(3_000)
  if (!/\/admin(?:\/|$)/.test(new URL(page.url()).pathname)) {
    const alert = await page.getByRole('alert').textContent().catch(() => null)
    throw new Error(`Login local no navegó al admin (${page.url()}${alert ? `; ${alert}` : ''})`)
  }

  for (const path of [
    '/admin/content-center/translations',
    '/admin/content-center/translations/batches',
    '/admin/content-center/jobs',
  ]) {
    const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' })
    if (!response?.ok()) throw new Error(`${path} respondió ${response?.status() ?? 'sin respuesta'}`)
    if (page.url().includes('/login')) throw new Error(`${path} redirigió al login`)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseUrl}/admin/content-center/translations/batches`, { waitUntil: 'domcontentloaded' })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  if (overflow) throw new Error('La vista móvil de lotes produce scroll horizontal')
  if (runtimeErrors.length) throw new Error(`Errores runtime: ${runtimeErrors.join(' | ')}`)
  console.log('Authenticated translation bulk UI smoke passed (desktop + mobile).')
 } finally {
   await browser.close()
 }
}
