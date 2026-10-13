export type TranslatableValue = string | string[]

type ProtectedKind = 'code_block' | 'inline_code' | 'markdown_link' | 'markdown_reference' | 'url' | 'html' | 'variable' | 'term' | 'identifier'
type Token = { marker: string; markerId: string; value: string; kind: ProtectedKind; itemIndex: number }
export type ProtectedAiValue = { value: TranslatableValue; tokens: Token[]; markerNamespace: string }

const SAFE_PATTERNS: Array<{ kind: ProtectedKind; pattern: RegExp }> = [
  { kind: 'code_block', pattern: /```[\s\S]*?```/g },
  { kind: 'inline_code', pattern: /`[^`\n]+`/g },
  { kind: 'markdown_link', pattern: /!?\[[^\]\r\n]*\]\((?:\\.|[^)\r\n])+\)/g },
  { kind: 'markdown_reference', pattern: /^\s*\[[^\]\r\n]+\]:\s+\S+(?:\s+["'(].*["')])?\s*$/gm },
  { kind: 'url', pattern: /https?:\/\/[^\s)\]"']+/gi },
  { kind: 'url', pattern: /\bwww\.[^\s)\]"']+/gi },
  { kind: 'html', pattern: /<[^>]+>/g },
  { kind: 'variable', pattern: /\{\{[^{}]+\}\}|\$\{[^{}]+\}|%\{[^{}]+\}/g },
  { kind: 'term', pattern: /\b(?:Tradagora|Prop Firm|Profit Split|Drawdown|Payout|Challenge|Futures|Scalping|CFD)\b/gi },
  { kind: 'identifier', pattern: /\b[A-Z][A-Z0-9_]{1,15}\b/g },
]

type Match = { start: number; end: number; value: string; kind: ProtectedKind; priority: number }

export function protectAiValue(input: TranslatableValue): ProtectedAiValue {
  const sourceItems = Array.isArray(input) ? input : [input]
  const markerNamespace = uniqueMarkerNamespace(sourceItems)
  const tokens: Token[] = []
  const protectedItems = sourceItems.map((text, itemIndex) => protectText(text, itemIndex, markerNamespace, tokens))
  return { value: Array.isArray(input) ? protectedItems : protectedItems[0], tokens, markerNamespace }
}

function protectText(text: string, itemIndex: number, markerNamespace: string, tokens: Token[]) {
  const matches: Match[] = []
  SAFE_PATTERNS.forEach(({ kind, pattern }, priority) => {
    pattern.lastIndex = 0
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined || !match[0]) continue
      matches.push({ start: match.index, end: match.index + match[0].length, value: match[0], kind, priority })
    }
  })
  matches.sort((a, b) => a.start - b.start || a.priority - b.priority || b.end - b.start - (a.end - a.start))
  const selected: Match[] = []
  let coveredUntil = -1
  for (const match of matches) {
    if (match.start < coveredUntil) continue
    selected.push(match)
    coveredUntil = match.end
  }
  let cursor = 0
  let result = ''
  for (const match of selected) {
    result += text.slice(cursor, match.start)
    const markerId = `${markerNamespace}_${String(tokens.length).padStart(4, '0')}`
    const marker = `<span translate="no" data-trgd-token="${markerId}">${markerId}</span>`
    tokens.push({ marker, markerId, value: match.value, kind: match.kind, itemIndex })
    result += marker
    cursor = match.end
  }
  return result + text.slice(cursor)
}

export function restoreAndValidateAiValue(output: unknown, protectedValue: ProtectedAiValue): TranslatableValue {
  const expectedArray = Array.isArray(protectedValue.value)
  if (expectedArray) {
    if (!Array.isArray(output) || output.length !== protectedValue.value.length || output.some((item) => typeof item !== 'string' || !item.trim())) {
      throw new Error('El proveedor devolvió una lista incompatible con el campo original.')
    }
  } else if (typeof output !== 'string' || !output.trim()) {
    throw new Error('El proveedor devolvió un texto vacío o incompatible.')
  }
  const values = (Array.isArray(output) ? output : [output]) as string[]
  for (const token of protectedValue.tokens) {
    const occurrences = values.map((value) => findTokenMarkers(value, token).length)
    const total = occurrences.reduce((sum, count) => sum + count, 0)
    if (total !== 1 || occurrences[token.itemIndex] !== 1) {
      throw new Error(`La traducción alteró código, enlaces o variables protegidas: marcador ${token.markerId} (${token.kind}).`)
    }
  }
  const restored = values.map((value, itemIndex) => {
    let result = value.trim()
    for (const token of protectedValue.tokens) {
      if (token.itemIndex === itemIndex) {
        const [marker] = findTokenMarkers(result, token)
        result = result.replace(marker, token.value)
      }
    }
    if (result.includes(protectedValue.markerNamespace) || /data-trgd-token/i.test(result)) {
      throw new Error('La traducción devolvió marcadores protegidos desconocidos o alterados.')
    }
    return result
  })
  return expectedArray ? restored : restored[0]
}

function uniqueMarkerNamespace(values: string[]) {
  let namespace = 'TRGDPROTECTED'
  const source = values.join('\n')
  while (source.includes(namespace)) namespace += 'X'
  return namespace
}

function findTokenMarkers(value: string, token: Token) {
  const markerId = escapeRegExp(token.markerId)
  const candidates = value.match(new RegExp(`<span\\b[^>]*>\\s*${markerId}\\s*</span>`, 'gi')) ?? []
  return candidates.filter((candidate) => {
    const hasNoTranslate = /\btranslate\s*=\s*(["'])no\1/i.test(candidate)
    const dataToken = candidate.match(/\bdata-trgd-token\s*=\s*(["'])([^"']+)\1/i)?.[2]
    return hasNoTranslate && dataToken === token.markerId
  })
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function countValueCharacters(value: TranslatableValue) {
  return Array.isArray(value) ? value.reduce((total, item) => total + item.length, 0) : value.length
}
