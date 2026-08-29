import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTranslationProvider, getTranslationProviderStatus, type TranslationItem } from '@/lib/content-translation'

const MAX_ITEMS = 50
const MAX_ITEM_LENGTH = 5_000
const MAX_TOTAL_LENGTH = 25_000
const MAX_CONTEXT_LENGTH = 500

type TranslationBody = { sourceLanguage?: unknown; targetLanguage?: unknown; items?: unknown }

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const sourceLanguage = url.searchParams.get('source')?.toLowerCase()
  const targetLanguage = url.searchParams.get('target')?.toLowerCase()
  let targetName: string | undefined
  if (targetLanguage) {
    const { data } = await supabase.from('languages').select('native_name').eq('code', targetLanguage).eq('is_active', true).maybeSingle()
    targetName = data?.native_name
  }
  const status = await getTranslationProviderStatus(sourceLanguage, targetLanguage, targetName)
  return NextResponse.json({ success: true, ...status })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const validation = validateBody(await request.json() as TranslationBody)
    if ('error' in validation) return NextResponse.json({ success: false, error: validation.error }, { status: 400 })
    const { sourceLanguage, targetLanguage, items } = validation

    const { data: languages, error: languageError } = await supabase
      .from('languages')
      .select('code, native_name')
      .eq('is_active', true)
      .in('code', [sourceLanguage, targetLanguage])
    if (languageError) throw new Error(languageError.message)
    const activeCodes = new Set((languages ?? []).map((language) => language.code))
    if (!activeCodes.has(sourceLanguage) || !activeCodes.has(targetLanguage)) {
      return NextResponse.json({ success: false, error: 'Los idiomas de origen y destino deben estar activos.' }, { status: 400 })
    }

    const targetName = languages?.find((language) => language.code === targetLanguage)?.native_name
    const status = await getTranslationProviderStatus(sourceLanguage, targetLanguage, targetName)
    if (!status.available) return NextResponse.json({ success: false, error: status.message, provider: status.provider }, { status: 409 })
    const provider = getTranslationProvider()
    if (!provider) return NextResponse.json({ success: false, error: 'Proveedor de traducción no configurado.' }, { status: 503 })
    const translations = await provider.translateBatch({ items, sourceLanguage, targetLanguage })
    return NextResponse.json({ success: true, provider: provider.name, translations })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo traducir el contenido.'
    return NextResponse.json({ success: false, error: message }, { status: 503 })
  }
}

function validateBody(body: TranslationBody):
  | { sourceLanguage: string; targetLanguage: string; items: TranslationItem[] }
  | { error: string } {
  if (typeof body.sourceLanguage !== 'string' || typeof body.targetLanguage !== 'string') {
    return { error: 'Los idiomas de origen y destino son obligatorios.' }
  }
  const sourceLanguage = body.sourceLanguage.trim().toLowerCase()
  const targetLanguage = body.targetLanguage.trim().toLowerCase()
  if (!sourceLanguage || !targetLanguage || sourceLanguage === targetLanguage) {
    return { error: 'El idioma de destino debe ser distinto del idioma de origen.' }
  }
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_ITEMS) {
    return { error: `Debes enviar entre 1 y ${MAX_ITEMS} textos por solicitud.` }
  }

  const items: TranslationItem[] = []
  let totalLength = 0
  const keys = new Set<string>()
  for (const item of body.items) {
    if (!isRecord(item) || typeof item.key !== 'string' || typeof item.value !== 'string') {
      return { error: 'Cada texto debe incluir key y value válidos.' }
    }
    const key = item.key.trim()
    const value = item.value.trim()
    const context = typeof item.context === 'string' ? item.context.trim() : undefined
    if (!key || keys.has(key) || !value || value.length > MAX_ITEM_LENGTH || (context?.length ?? 0) > MAX_CONTEXT_LENGTH) {
      return { error: 'Los textos contienen claves duplicadas, valores vacíos o contenido demasiado largo.' }
    }
    keys.add(key)
    totalLength += value.length + (context?.length ?? 0)
    items.push({ key, value, context })
  }
  if (totalLength > MAX_TOTAL_LENGTH) return { error: 'El lote de traducción es demasiado grande.' }
  return { sourceLanguage, targetLanguage, items }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
