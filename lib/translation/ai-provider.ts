import { countValueCharacters, protectAiValue, restoreAndValidateAiValue, type TranslatableValue } from './ai-content'

export type LocalTranslationRequest = { value: TranslatableValue; sourceLanguage: string; targetLanguage: string }
export type LocalTranslationResult = {
  value: TranslatableValue
  provider: 'libretranslate-local' | 'mock'
  model: string
  usage: { inputCharacters: number; outputCharacters: number; inputTokens: number; outputTokens: number; estimatedCostUsd: 0 }
}

export interface LocalTranslationProvider {
  readonly name: 'libretranslate-local' | 'mock'
  readonly model: string
  translate(request: LocalTranslationRequest, signal: AbortSignal): Promise<unknown>
}

export class LibreTranslateLocalProvider implements LocalTranslationProvider {
  readonly name = 'libretranslate-local' as const
  readonly model = 'libretranslate-local'
  constructor(private readonly url: string, private readonly apiKey?: string) {
    if (!isLocalLibreTranslateUrl(url)) throw new Error('LIBRETRANSLATE_URL debe apuntar a localhost o a una IP privada del PC.')
  }
  async translate(request: LocalTranslationRequest, signal: AbortSignal) {
    const values = Array.isArray(request.value) ? request.value : [request.value]
    const response = await fetch(`${this.url.replace(/\/+$/, '')}/translate`, {
      method: 'POST', signal, cache: 'no-store', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q: values.length === 1 ? values[0] : values, source: request.sourceLanguage,
        target: request.targetLanguage, format: 'html', api_key: this.apiKey || undefined }),
    })
    const payload = await response.json().catch(() => ({})) as { translatedText?: string|string[]; error?: string }
    if (!response.ok) throw new Error(payload.error ?? 'LibreTranslate local no pudo completar la traducción.')
    const translated = Array.isArray(payload.translatedText) ? payload.translatedText : [payload.translatedText]
    return Array.isArray(request.value) ? translated : translated[0]
  }
}

export class MockLocalTranslationProvider implements LocalTranslationProvider {
  readonly name = 'mock' as const
  readonly model = 'deterministic-test-v1'
  async translate(request: LocalTranslationRequest) {
    const prefix = `[${request.targetLanguage.toUpperCase()}] `
    return Array.isArray(request.value) ? request.value.map((item) => `${prefix}${item}`) : `${prefix}${request.value}`
  }
}

export async function translateLocally(request: LocalTranslationRequest, provider: LocalTranslationProvider, timeoutMs = 60_000): Promise<LocalTranslationResult> {
  const protectedValue = protectAiValue(request.value)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const output = await provider.translate({ ...request, value: protectedValue.value }, controller.signal)
    const value = restoreAndValidateAiValue(output, protectedValue)
    const inputCharacters = countValueCharacters(request.value), outputCharacters = countValueCharacters(value)
    return { value, provider: provider.name, model: provider.model,
      usage: { inputCharacters, outputCharacters, inputTokens: estimateTokens(inputCharacters), outputTokens: estimateTokens(outputCharacters), estimatedCostUsd: 0 } }
  } finally { clearTimeout(timeout) }
}

export function isLocalLibreTranslateUrl(raw: string) {
  try {
    const url = new URL(raw)
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password) return false
    const host = url.hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
      || /^10\./.test(host) || /^192\.168\./.test(host)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  } catch { return false }
}
function estimateTokens(characters: number) { return Math.ceil(characters / 4) }
