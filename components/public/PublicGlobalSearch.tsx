'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { PublicSearchItem } from '@/lib/public-search'
import { getPublicUi, publicLocale, publicPath } from '@/lib/public-i18n'

const paths = { prop_firm: 'prop-firms', broker: 'brokers', exchange: 'exchanges', tool: 'herramientas', calculator: 'calculadoras' } as const

export function PublicGlobalSearch({ items, language }: { items: PublicSearchItem[]; language: string }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const t = getPublicUi(language)
  const groupLabels = { prop_firm: t('nav.propFirms'), broker: t('nav.brokers'), exchange: t('nav.exchanges'), tool: t('nav.tools'), calculator: t('nav.calculators') }
  const typeLabels = { prop_firm: t('search.type.propFirm'), broker: t('search.type.broker'), exchange: t('search.type.exchange'), tool: t('search.type.tool'), calculator: t('search.type.calculator') }
  const results = useMemo(() => {
    const needle = normalize(query, language)
    if (needle.length < 2) return []
    return items.filter((item) => normalize(`${item.name} ${item.slug}`, language).includes(needle)).slice(0, 8)
  }, [items, language, query])

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  function navigate(item: PublicSearchItem) {
    setQuery('')
    setOpen(false)
    router.push(publicPath(`/${paths[item.type]}/${item.slug}`, language))
  }

  const grouped = (['prop_firm', 'broker', 'exchange', 'tool', 'calculator'] as const).map((type) => ({ type, items: results.filter((item) => item.type === type) })).filter((group) => group.items.length)
  let resultIndex = -1

  return <div ref={rootRef} className="relative hidden xl:block">
    <label className="relative block">
      <span className="sr-only">{t('search.placeholder')}</span>
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
      <input
        type="search"
        value={query}
        placeholder={t('search.placeholder')}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && query.trim().length >= 2}
        aria-controls="public-global-search-results"
        className="tg-filter h-10 w-64 rounded-xl pl-9 pr-3 text-sm placeholder:text-slate-600"
        onFocus={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); setOpen(true) }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { setOpen(false); event.currentTarget.blur(); return }
          if (!results.length) return
          if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActiveIndex((value) => (value + 1) % results.length) }
          if (event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActiveIndex((value) => (value - 1 + results.length) % results.length) }
          if (event.key === 'Enter' && open) { event.preventDefault(); navigate(results[activeIndex] ?? results[0]) }
        }}
      />
    </label>
    {open && query.trim().length >= 2 && <div id="public-global-search-results" role="listbox" className="absolute right-0 top-[calc(100%+.6rem)] z-[70] max-h-[min(30rem,calc(100vh-7rem))] w-[22rem] overflow-y-auto rounded-2xl border border-amber-300/20 bg-[#07111e]/98 p-2 shadow-[0_24px_70px_rgba(0,0,0,.55)] backdrop-blur-xl">
      {grouped.map((group) => <section key={group.type} aria-label={groupLabels[group.type]}>
        <p className="px-3 pb-1 pt-2 font-mono text-[10px] font-bold uppercase tracking-[.18em] text-amber-300/75">{groupLabels[group.type]}</p>
        {group.items.map((item) => {
          resultIndex += 1
          const index = resultIndex
          return <button key={item.id} type="button" role="option" aria-selected={activeIndex === index} onMouseEnter={() => setActiveIndex(index)} onClick={() => navigate(item)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-amber-300/[.08] aria-selected:bg-amber-300/[.1]">
            <SearchLogo item={item} />
            <span className="min-w-0"><strong className="block truncate text-sm text-slate-100">{item.name}</strong><span className="mt-0.5 block text-xs text-slate-500">{typeLabels[item.type]}</span></span>
          </button>
        })}
      </section>)}
      {!results.length && <p className="px-4 py-6 text-center text-sm text-slate-400">{t('search.empty')}</p>}
    </div>}
  </div>
}

function SearchLogo({ item }: { item: PublicSearchItem }) {
  if (!item.logoUrl) return <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-amber-200">{item.name.slice(0, 2).toUpperCase()}</span>
  // Los logos son administrados desde Supabase y pueden usar hosts dinámicos.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={item.logoUrl} alt={item.logoAlt || item.name} width={36} height={36} className="size-9 shrink-0 rounded-lg border border-white/10 bg-white object-contain p-1" />
}

function normalize(value: string, language = 'es') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(publicLocale(language)).trim()
}
