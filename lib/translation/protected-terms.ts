import type { TranslationItem } from '@/lib/content-translation'

const PROTECTED_TERMS = [
  'Profit Split',
  'Prop Firm',
  'Drawdown',
  'Payout',
  'Challenge',
  'Futures',
  'Scalping',
  'CFD',
  'Tradagora',
]

type ProtectedTerm = { placeholder: string; original: string }

export type ProtectedTranslationItem = TranslationItem & { terms: ProtectedTerm[] }

export function protectTranslationItems(items: TranslationItem[]): ProtectedTranslationItem[] {
  return items.map((item) => {
    const terms: ProtectedTerm[] = []
    let value = item.value
    const patterns = [
      ...PROTECTED_TERMS.map((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi')),
      /https?:\/\/[^\s)]+/gi,
      /\bwww\.[^\s)]+/gi,
      /\b[a-z0-9]+(?:-[a-z0-9]+)+\b/g,
      /\b[A-Z][A-Z0-9]{1,9}\b/g,
    ]
    for (const pattern of patterns) {
      value = value.replace(pattern, (original) => {
        const placeholder = `TRGDPROTECTED${String(terms.length).padStart(3, '0')}`
        terms.push({ placeholder, original })
        return placeholder
      })
    }
    return { ...item, value, terms }
  })
}

export function restoreProtectedTerms(value: string, terms: ProtectedTerm[]) {
  return terms.reduce((translated, term) => translated.replaceAll(term.placeholder, term.original), value)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
