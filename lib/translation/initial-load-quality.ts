export type InitialLoadQuality = {
  status: 'passed' | 'requires_review' | 'failed'
  codes: string[]
}

const sensitiveResources = new Set([
  'account_plan_translation', 'challenge_phase_translation',
  'challenge_variant_phase_translation', 'challenge_reward_translation',
])
const sensitiveField = /(payout|profit|drawdown|restriction|rule|condition|target|fee|price|leverage|loss|refund)/i
const numberToken = /(?:[$€£]\s*)?-?\d+(?:[.,]\d+)*(?:\s*%|\s*(?:USD|EUR|GBP))?/gi
const placeholderToken = /\{\{[^{}]+\}\}|\$\{[^{}]+\}|%[sdif]|:\w+/g
const urlToken = /https?:\/\/[^\s)\]}]+/gi
const codeFence = /```/g

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value
  return []
}

function tokens(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)].map((match) => match[0].trim()).sort()
}

function sameTokens(source: string, draft: string, pattern: RegExp) {
  return JSON.stringify(tokens(source, pattern)) === JSON.stringify(tokens(draft, pattern))
}

export function evaluateInitialLoadTranslation(input: {
  resourceType: string
  fieldName: string
  source: unknown
  draft: unknown
}): InitialLoadQuality {
  if (Array.isArray(input.source) !== Array.isArray(input.draft)) return { status: 'failed', codes: ['invalid_shape'] }
  const source = strings(input.source)
  const draft = strings(input.draft)
  const codes: string[] = []
  if (!source.length || source.length !== draft.length || draft.some((value) => !value.trim())) {
    return { status: 'failed', codes: ['invalid_shape'] }
  }
  for (let index = 0; index < source.length; index += 1) {
    const original = source[index]
    const translated = draft[index]
    if (!sameTokens(original, translated, numberToken)) codes.push('numeric_tokens_changed')
    if (!sameTokens(original, translated, placeholderToken)) codes.push('placeholders_changed')
    if (!sameTokens(original, translated, urlToken)) codes.push('urls_changed')
    if ((original.match(codeFence)?.length ?? 0) !== (translated.match(codeFence)?.length ?? 0)) codes.push('markdown_fence_changed')
    if (/\btrailing\b/i.test(original) && /\btrailer\b/i.test(translated)) codes.push('financial_trailing_mistranslated')
    if (original.length >= 20 && original.trim().toLocaleLowerCase() === translated.trim().toLocaleLowerCase()) codes.push('translation_unchanged')
  }
  const uniqueCodes = [...new Set(codes)]
  if (uniqueCodes.some((code) => code !== 'translation_unchanged')) return { status: 'failed', codes: uniqueCodes }
  if (sensitiveResources.has(input.resourceType) || sensitiveField.test(input.fieldName) || uniqueCodes.length) {
    return { status: 'requires_review', codes: uniqueCodes.length ? uniqueCodes : ['commercial_sensitive'] }
  }
  return { status: 'passed', codes: [] }
}
