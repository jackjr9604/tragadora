import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const PLACEHOLDER = /^(?:<.*>|replace[-_ ]?me|changeme)$/i
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value || PLACEHOLDER.test(value)) throw new Error(`${name} no esta configurada con un valor local valido.`)
  return value
}

function localHttpUrl(name: string, expectedPort?: string) {
  const raw = required(name)
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`${name} no es una URL valida.`)
  }

  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error(`${name} debe usar HTTP y apuntar exclusivamente a localhost/loopback.`)
  }
  if (url.username || url.password) throw new Error(`${name} no puede contener credenciales.`)
  if (expectedPort && url.port !== expectedPort) throw new Error(`${name} debe usar el puerto local ${expectedPort}.`)
  return url.origin
}

export function assertLocalE2eEnvironment() {
  const supabaseOrigin = localHttpUrl('NEXT_PUBLIC_SUPABASE_URL', '54321')
  const libreTranslateOrigin = localHttpUrl('LIBRETRANSLATE_URL')
  const publishableKey = required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY')
  const browsersPath = resolve(required('PLAYWRIGHT_BROWSERS_PATH'))

  if (publishableKey.length < 20 || serviceRoleKey.length < 20) {
    throw new Error('Las claves de Supabase local no tienen un formato utilizable.')
  }
  if (process.env.TRANSLATION_LOCAL_QUEUE_ENABLED !== 'true') {
    throw new Error('TRANSLATION_LOCAL_QUEUE_ENABLED debe ser true para la prueba E2E local.')
  }
  if (!existsSync(browsersPath)) throw new Error('PLAYWRIGHT_BROWSERS_PATH no existe.')

  return { supabaseOrigin, libreTranslateOrigin, browsersPath }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const safe = assertLocalE2eEnvironment()
    console.log(`Entorno E2E local verificado: Supabase=${safe.supabaseOrigin}, LibreTranslate=${safe.libreTranslateOrigin}`)
    console.log(`Chromium de Playwright: ${safe.browsersPath}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Entorno E2E local invalido.')
    process.exitCode = 1
  }
}
