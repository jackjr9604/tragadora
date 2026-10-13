export type TranslatableValue = string | string[]

type ProtectedKind =
  | 'code_block' | 'indented_code' | 'inline_code' | 'html' | 'variable' | 'url'
  | 'frontmatter' | 'markdown_block' | 'markdown_break' | 'markdown_syntax'
  | 'term' | 'identifier'
type LayoutPart = { literal: string } | { segmentIndex: number }
type InlineToken = { markerId: string; marker: string; value: string; kind: ProtectedKind }
type Segment = { markerId: string; marker: string; tokens: InlineToken[] }
export type ProtectedAiValue = {
  value: string[]
  layouts: LayoutPart[][]
  segments: Segment[]
  originalWasArray: boolean
  markerNamespace: string
  markdownSignatures: string[][]
}

const STRUCTURE_PATTERNS: Array<{ kind: ProtectedKind; pattern: RegExp }> = [
  { kind: 'frontmatter', pattern: /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/g },
  { kind: 'code_block', pattern: /```[\s\S]*?```|~~~[\s\S]*?~~~/g },
  { kind: 'indented_code', pattern: /^(?: {4}|\t).*(?:\r?\n|$)/gm },
  { kind: 'inline_code', pattern: /``[^\n]*?``|`[^`\n]+`/g },
  { kind: 'html', pattern: /<!--[\s\S]*?-->|<[^>]+>/g },
  { kind: 'markdown_block', pattern: /^\s*(?:#{1,6}[ \t]+|>{1,6}[ \t]*|[-+*][ \t]+|\d+[.)][ \t]+|\[\^[^\]]+\]:[ \t]*)/gm },
  { kind: 'markdown_block', pattern: /^\s*(?:[-*_][ \t]*){3,}$/gm },
  { kind: 'markdown_block', pattern: /^\s*\|?(?:[ \t]*:?-{3,}:?[ \t]*\|)+[ \t]*:?-{3,}:?[ \t]*\|?[ \t]*$/gm },
  { kind: 'markdown_block', pattern: /^\s*(?:={3,}|-{3,})\s*$/gm },
  { kind: 'markdown_break', pattern: /(?: {2,}\r?\n|\\\r?\n|\r?\n+)/g },
  { kind: 'markdown_syntax', pattern: /!\[|\[\^[^\]]+\]|\[[ xX]\]|\*\*|__|~~|\|>|<\||[\[\]()*_~|#>]|\\[\\`*{}\[\]()#+\-.!_|>~]/g },
]

const INLINE_PATTERNS: Array<{ kind: ProtectedKind; pattern: RegExp }> = [
  { kind: 'variable', pattern: /\{\{[^{}]+\}\}|\$\{[^{}]+\}|%\{[^{}]+\}/g },
  { kind: 'url', pattern: /https?:\/\/[^\s)\]"'<>]+/gi },
  { kind: 'url', pattern: /\bwww\.[^\s)\]"'<>]+/gi },
  { kind: 'term', pattern: /\b(?:Tradagora|Prop Firm|Profit Split|Drawdown|Payout|Challenge|Futures|Scalping|CFD)\b/gi },
  { kind: 'identifier', pattern: /\b[A-Z][A-Z0-9_]{1,15}\b/g },
]

type Match = { start: number; end: number; value: string; kind: ProtectedKind; priority: number }

export function protectAiValue(input: TranslatableValue): ProtectedAiValue {
  const sourceItems = Array.isArray(input) ? input : [input]
  const markerNamespace = uniqueMarkerNamespace(sourceItems)
  const layouts: LayoutPart[][] = []
  const segments: Segment[] = []
  const markdownSignatures: string[][] = []

  for (const source of sourceItems) {
    const matches = protectedMatches(source, STRUCTURE_PATTERNS)
    markdownSignatures.push(markdownSignature(matches))
    const layout: LayoutPart[] = []
    let cursor = 0
    for (const match of matches) {
      addTranslatableText(source.slice(cursor, match.start), markerNamespace, layout, segments)
      layout.push({ literal: match.value })
      cursor = match.end
    }
    addTranslatableText(source.slice(cursor), markerNamespace, layout, segments)
    layouts.push(layout)
  }

  return {
    value: segments.map((segment) => segment.marker),
    layouts,
    segments,
    originalWasArray: Array.isArray(input),
    markerNamespace,
    markdownSignatures,
  }
}

function addTranslatableText(value: string, markerNamespace: string, layout: LayoutPart[], segments: Segment[]) {
  if (!value) return
  const leading = value.match(/^\s*/)?.[0] ?? ''
  const trailing = value.match(/\s*$/)?.[0] ?? ''
  const text = value.slice(leading.length, value.length - trailing.length)
  if (leading) layout.push({ literal: leading })
  if (text) {
    const markerId = `${markerNamespace}_${String(segments.length).padStart(4, '0')}`
    const tokens: InlineToken[] = []
    const protectedText = protectInlineText(text, markerId, tokens)
    const marker = `<div data-trgd-segment="${markerId}">${protectedText}</div>`
    layout.push({ segmentIndex: segments.length })
    segments.push({ markerId, marker, tokens })
  }
  if (trailing && trailing.length !== value.length) layout.push({ literal: trailing })
  else if (!text && trailing) layout.push({ literal: trailing })
}

export function restoreAndValidateAiValue(output: unknown, protectedValue: ProtectedAiValue): TranslatableValue {
  if (!Array.isArray(output) || output.length !== protectedValue.segments.length || output.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error('El proveedor devolvió una lista incompatible con los fragmentos traducibles.')
  }
  const translatedSegments = output.map((value, index) => extractTranslatedSegment(value, protectedValue.segments[index], protectedValue.markerNamespace))
  const restored = protectedValue.layouts.map((layout, itemIndex) => {
    const result = layout.map((part) => 'literal' in part ? part.literal : translatedSegments[part.segmentIndex]).join('')
    const actualSignature = markdownSignature(protectedMatches(result, STRUCTURE_PATTERNS))
    if (!sameStrings(actualSignature, protectedValue.markdownSignatures[itemIndex])) {
      throw new Error('La traducción alteró la estructura Markdown protegida.')
    }
    return result
  })
  return protectedValue.originalWasArray ? restored : restored[0]
}

function extractTranslatedSegment(value: string, segment: Segment, markerNamespace: string) {
  const matches = [...value.matchAll(new RegExp(`<div\\b([^>]*)>([\\s\\S]*?)</div>`, 'gi'))]
    .filter((match) => match[1].match(/\bdata-trgd-segment\s*=\s*(["'])([^"']+)\1/i)?.[2] === segment.markerId)
  if (matches.length !== 1 || value.replace(matches[0][0], '').trim()) {
    throw new Error(`La traducción alteró, perdió o duplicó el fragmento protegido ${segment.markerId}.`)
  }
  let translated = matches[0][2]
  for (const token of segment.tokens) {
    const tokenMatches = findInlineTokenMarkers(translated, token)
    if (tokenMatches.length !== 1) {
      throw new Error(`La traducción alteró código, enlaces o variables protegidas: marcador ${token.markerId} (${token.kind}).`)
    }
    translated = translated.replace(tokenMatches[0], escapeHtml(token.value))
  }
  translated = decodeHtml(translated).trim()
  if (!translated || translated.includes(markerNamespace) || /data-trgd-(?:segment|token)/i.test(translated) || /<[^>]+>/.test(translated)) {
    throw new Error(`La traducción devolvió contenido inseguro para el fragmento ${segment.markerId}.`)
  }
  return translated
}

function protectInlineText(text: string, segmentMarkerId: string, tokens: InlineToken[]) {
  const matches = protectedMatches(text, INLINE_PATTERNS)
  let cursor = 0
  let result = ''
  for (const match of matches) {
    result += escapeHtml(text.slice(cursor, match.start))
    const markerId = `${segmentMarkerId}_P${String(tokens.length).padStart(3, '0')}`
    const marker = `<span translate="no" data-trgd-token="${markerId}">${markerId}</span>`
    tokens.push({ markerId, marker, value: match.value, kind: match.kind })
    result += marker
    cursor = match.end
  }
  return result + escapeHtml(text.slice(cursor))
}

function findInlineTokenMarkers(value: string, token: InlineToken) {
  const markerId = escapeRegExp(token.markerId)
  const candidates = value.match(new RegExp(`<span\\b[^>]*>\\s*${markerId}\\s*</span>`, 'gi')) ?? []
  return candidates.filter((candidate) => {
    const hasNoTranslate = /\btranslate\s*=\s*(["'])no\1/i.test(candidate)
    const dataToken = candidate.match(/\bdata-trgd-token\s*=\s*(["'])([^"']+)\1/i)?.[2]
    return hasNoTranslate && dataToken === token.markerId
  })
}

function protectedMatches(text: string, patterns: Array<{ kind: ProtectedKind; pattern: RegExp }>) {
  const matches: Match[] = []
  patterns.forEach(({ kind, pattern }, priority) => {
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
  return selected
}

function markdownSignature(matches: Match[]) {
  return matches
    .filter((match) => match.kind.startsWith('markdown_') || ['code_block', 'indented_code', 'inline_code', 'html', 'variable', 'url', 'frontmatter'].includes(match.kind))
    .map((match) => `${match.kind}:${match.value}`)
}

function sameStrings(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function uniqueMarkerNamespace(values: string[]) {
  let namespace = 'TRGDSEGMENT'
  const source = values.join('\n')
  while (source.includes(namespace)) namespace += 'X'
  return namespace
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function countValueCharacters(value: TranslatableValue) {
  return Array.isArray(value) ? value.reduce((total, item) => total + item.length, 0) : value.length
}
