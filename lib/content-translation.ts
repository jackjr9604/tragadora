import 'server-only'
import { protectTranslationItems, restoreProtectedTerms } from '@/lib/translation/protected-terms'
import { isLocalLibreTranslateUrl } from '@/lib/translation/ai-provider'

export type TranslationRequest = { text: string; sourceLanguage: string; targetLanguage: string; context?: string }
export type TranslationItem = { key: string; value: string; context?: string }
export type TranslationResult = { key: string; translatedValue: string }
export type TranslationProviderStatus = {
  provider: string
  available: boolean
  mode: 'available' | 'unavailable' | 'local_only' | 'not_configured'
  message: string
  supportedLanguages?: string[]
}

export interface TranslationProvider {
  readonly name: string
  isConfigured(): boolean
  getStatus(sourceLanguage?: string, targetLanguage?: string, targetName?: string): Promise<TranslationProviderStatus>
  translate(request: TranslationRequest): Promise<string>
  translateBatch(request: { items: TranslationItem[]; sourceLanguage: string; targetLanguage: string }): Promise<TranslationResult[]>
}

type LibreLanguage = { code?: unknown; name?: unknown; targets?: unknown }
type LibreResponse = { translatedText?: string | string[]; error?: string }

export class LibreTranslateProvider implements TranslationProvider {
  readonly name = 'libretranslate'
  private readonly url = normalizeUrl(process.env.LIBRETRANSLATE_URL ?? '')

  isConfigured() { return process.env.NODE_ENV !== 'production' && isLocalLibreTranslateUrl(this.url) }

  async getStatus(sourceLanguage?: string, targetLanguage?: string, targetName?: string): Promise<TranslationProviderStatus> {
    if (!this.isConfigured()) return localOnlyStatus()
    try {
      const response = await fetch(`${this.url}/languages`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(3_000),
        headers: libreHeaders(),
      })
      if (!response.ok) return unavailableLibreStatus()
      const payload = await response.json() as unknown
      if (!Array.isArray(payload)) return unavailableLibreStatus()
      const languages = payload.filter(isLibreLanguage)
      const supportedLanguages = languages.map((language) => language.code)
      if (sourceLanguage && !supportedLanguages.includes(sourceLanguage)) {
        return unsupportedLanguageStatus(sourceLanguage)
      }
      if (targetLanguage && !supportedLanguages.includes(targetLanguage)) {
        return unsupportedLanguageStatus(targetName ?? targetLanguage)
      }
      const source = languages.find((language) => language.code === sourceLanguage)
      if (source && targetLanguage && source.targets.length > 0 && !source.targets.includes(targetLanguage)) {
        return unsupportedLanguageStatus(targetName ?? targetLanguage)
      }
      return { provider: this.name, available: true, mode: 'available', message: 'LibreTranslate disponible', supportedLanguages }
    } catch (error) {
      console.warn('LibreTranslate availability check failed:', safeErrorName(error))
      return unavailableLibreStatus()
    }
  }

  async translate(request: TranslationRequest) {
    const [translation] = await this.translateBatch({
      items: [{ key: 'translation', value: request.text, context: request.context }],
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
    })
    return translation?.translatedValue ?? ''
  }

  async translateBatch({ items, sourceLanguage, targetLanguage }: {
    items: TranslationItem[]; sourceLanguage: string; targetLanguage: string
  }) {
    const status = await this.getStatus(sourceLanguage, targetLanguage)
    if (!status.available) throw new Error(status.message)
    const protectedItems = protectTranslationItems(items)
    let translated: string[]
    try {
      translated = await this.requestTranslation(protectedItems.map((item) => item.value), sourceLanguage, targetLanguage)
    } catch (error) {
      if (items.length === 1) throw error
      translated = []
      for (const item of protectedItems) {
        const [value] = await this.requestTranslation([item.value], sourceLanguage, targetLanguage)
        translated.push(value)
      }
    }
    return items.map((item, index) => ({
      key: item.key,
      translatedValue: restoreProtectedTerms(translated[index] ?? '', protectedItems[index].terms).trim(),
    }))
  }

  private async requestTranslation(q: string[], source: string, target: string) {
    const response = await fetch(`${this.url}/translate`, {
      method: 'POST',
      headers: { ...libreHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ q: q.length === 1 ? q[0] : q, source, target, format: 'text', api_key: process.env.LIBRETRANSLATE_API_KEY || undefined }),
      cache: 'no-store',
      signal: AbortSignal.timeout(60_000),
    })
    const payload = await response.json().catch(() => ({})) as LibreResponse
    if (!response.ok) throw new Error(friendlyLibreError(payload.error))
    const values = Array.isArray(payload.translatedText) ? payload.translatedText : [payload.translatedText]
    if (values.length !== q.length || values.some((value) => typeof value !== 'string' || !value.trim())) {
      throw new Error('LibreTranslate devolvió una traducción incompleta.')
    }
    return values as string[]
  }
}

export function getTranslationProvider(): TranslationProvider | null {
  const selected = selectedProviderName()
  const provider = selected === 'libretranslate' ? new LibreTranslateProvider() : null
  return provider?.isConfigured() ? provider : null
}

export function isTranslationProviderConfigured() { return getTranslationProvider() !== null }
export async function getTranslationProviderStatus(sourceLanguage?: string, targetLanguage?: string, targetName?: string) {
  const selected = selectedProviderName()
  if (!selected) return localOnlyStatus()
  const provider = selected === 'libretranslate' ? new LibreTranslateProvider() : null
  if (!provider) return { provider: selected, available: false, mode: 'not_configured' as const, message: 'Proveedor de traducción no configurado.' }
  return provider.getStatus(sourceLanguage, targetLanguage, targetName)
}
export async function translateContent(text: string, sourceLanguage: string, targetLanguage: string, context?: string) {
  const configured = getTranslationProvider()
  if (!configured) throw new Error(selectedProviderName() === 'libretranslate' ? localOnlyStatus().message : 'Proveedor de traducción no configurado.')
  return configured.translate({ text, sourceLanguage, targetLanguage, context })
}

function selectedProviderName() { return process.env.LIBRETRANSLATE_URL?.trim() ? 'libretranslate' : '' }
function normalizeUrl(url: string) { return url.trim().replace(/\/+$/, '') }
function libreHeaders(): Record<string, string> { return process.env.LIBRETRANSLATE_API_KEY ? { authorization: `Bearer ${process.env.LIBRETRANSLATE_API_KEY}` } : {} }
function isLibreLanguage(value: LibreLanguage): value is { code: string; name: string; targets: string[] } { return Boolean(value && typeof value.code === 'string' && typeof value.name === 'string' && Array.isArray(value.targets) && value.targets.every((target) => typeof target === 'string')) }
function localOnlyStatus(): TranslationProviderStatus { return { provider: 'libretranslate', available: false, mode: 'local_only', message: 'Traducción automática disponible desde el entorno local.' } }
function unavailableLibreStatus(): TranslationProviderStatus { return { provider: 'libretranslate', available: false, mode: 'unavailable', message: process.env.NODE_ENV === 'development' ? 'LibreTranslate no está ejecutándose. Inicia LibreTranslate para utilizar traducción automática.' : 'Traducción automática disponible desde el entorno local.' } }
function unsupportedLanguageStatus(language: string): TranslationProviderStatus { return { provider: 'libretranslate', available: false, mode: 'unavailable', message: `${language} no está disponible en el servidor de traducción.` } }
function friendlyLibreError(message?: string) { if (!message) return 'LibreTranslate no pudo completar la traducción.'; if (/language|target|source|not supported/i.test(message)) return 'El idioma seleccionado no está disponible en el servidor de traducción.'; return 'LibreTranslate no pudo completar la traducción.' }
function safeErrorName(error: unknown) { return error instanceof Error ? error.name : 'UnknownError' }
