export type TranslatableValue = string | string[]

type Token = { marker: string; value: string }
export type ProtectedAiValue = { value: TranslatableValue; tokens: Token[] }

const SAFE_PATTERNS = [
  /```[\s\S]*?```/g,
  /`[^`\n]+`/g,
  /https?:\/\/[^\s)\]"']+/gi,
  /\bwww\.[^\s)\]"']+/gi,
  /<[^>]+>/g,
  /\{\{[^{}]+\}\}|\$\{[^{}]+\}|%\{[^{}]+\}/g,
  /\b(?:Tradagora|Prop Firm|Profit Split|Drawdown|Payout|Challenge|Futures|Scalping|CFD)\b/gi,
  /\b[A-Z][A-Z0-9_]{1,15}\b/g,
]

export function protectAiValue(input: TranslatableValue): ProtectedAiValue {
  const tokens: Token[] = []
  const protect = (text: string) => {
    let value = text
    for (const pattern of SAFE_PATTERNS) {
      value = value.replace(pattern, (original) => {
        if (original.includes('TRGD_AI_')) return original
        const marker = `TRGD_AI_${String(tokens.length).padStart(4, '0')}`
        tokens.push({ marker, value: original })
        return marker
      })
    }
    return value
  }
  return { value: Array.isArray(input) ? input.map(protect) : protect(input), tokens }
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
    const occurrences = values.reduce((count, value) => count + value.split(token.marker).length - 1, 0)
    if (occurrences !== 1) throw new Error('La traducción alteró código, enlaces o variables protegidas.')
  }
  const restored = values.map((value) => {
    let result = value.trim()
    for (const token of protectedValue.tokens) result = result.replace(token.marker, token.value)
    return result
  })
  return expectedArray ? restored : restored[0]
}

export function countValueCharacters(value: TranslatableValue) {
  return Array.isArray(value) ? value.reduce((total, item) => total + item.length, 0) : value.length
}
