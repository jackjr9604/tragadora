'use client'

import { useState } from 'react'
import { getPublicUi, publicLocale } from '@/lib/public-i18n'
import type { PublicLanguage } from '@/lib/public-language'

type Props = {
  countryCode?: string | null
  countryName?: string | null
  showName?: boolean
  size?: 'sm' | 'md'
  context?: string
  language?: PublicLanguage | null
}

export function CountryFlag({ countryCode, countryName, showName = false, size = 'md', context, language = 'es' }: Props) {
  const [open, setOpen] = useState(false)
  const t = getPublicUi(language)
  const accessibleContext = context ?? t('country.origin')
  const code = countryCode?.trim().toUpperCase()
  const nameFromRegion = code && /^[A-Z]{2}$/.test(code) ? new Intl.DisplayNames([publicLocale(language)], { type: 'region' }).of(code) : undefined
  const name = countryName?.trim() || (nameFromRegion && nameFromRegion !== code ? nameFromRegion : null) || null
  if (!code || !/^[A-Z]{2}$/.test(code) || !name) return <span aria-label={t('country.unavailable')} className="text-slate-500">—</span>
  const flag = String.fromCodePoint(...[...code].map((letter) => 127397 + letter.charCodeAt(0)))

  return <span className="group/flag relative inline-flex items-center gap-2">
    <button type="button" onClick={() => setOpen((value) => !value)} onBlur={() => setOpen(false)} aria-label={`${accessibleContext}: ${name}`} aria-expanded={open} title={name} className="inline-flex h-7 min-w-8 items-center justify-center rounded-md border border-current/15 bg-white/5 px-1 outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70">
      <span aria-hidden="true" className={size === 'sm' ? 'text-lg leading-none' : 'text-xl leading-none'}>{flag}</span>
      <span className="sr-only">{accessibleContext}: {name}</span>
    </button>
    {showName && <span className="text-sm">{name}</span>}
    <span role="tooltip" className={`pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-600/30 bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover/flag:block group-focus-within/flag:block ${open ? 'block' : 'hidden'}`}>{name}</span>
  </span>
}
