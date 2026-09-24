'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { PublicSearchItem } from '@/lib/public-search'

const copy = {
  es: { placeholder: 'Buscar firma, bróker o exchange', empty: 'No encontramos resultados', labels: { prop_firm: 'Prop Firms', broker: 'Brokers', exchange: 'Exchanges' } },
  en: { placeholder: 'Search firm, broker or exchange', empty: 'No results found', labels: { prop_firm: 'Prop Firms', broker: 'Brokers', exchange: 'Exchanges' } },
  pt: { placeholder: 'Buscar firma, corretora ou exchange', empty: 'Nenhum resultado encontrado', labels: { prop_firm: 'Prop Firms', broker: 'Brokers', exchange: 'Exchanges' } },
} as const

const paths = { prop_firm: 'prop-firms', broker: 'brokers', exchange: 'exchanges' } as const
const typeLabels = { prop_firm: 'Prop Firm', broker: 'Broker', exchange: 'Exchange' } as const

export function PublicGlobalSearch({ items, language }: { items: PublicSearchItem[]; language: string }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const text = copy[language as keyof typeof copy] ?? copy.es
  const results = useMemo(() => {
    const needle = normalize(query)
    if (needle.length < 2) return []
    return items.filter((item) => normalize(`${item.name} ${item.slug}`).includes(needle)).slice(0, 8)
  }, [items, query])

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
    router.push(`/${paths[item.type]}/${item.slug}`)
  }

  const grouped = (['prop_firm', 'broker', 'exchange'] as const).map((type) => ({ type, items: results.filter((item) => item.type === type) })).filter((group) => group.items.length)
  let resultIndex = -1

  return <div ref={rootRef} className="relative hidden xl:block">
    <label className="relative block">
      <span className="sr-only">{text.placeholder}</span>
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
      <input
        type="search"
        value={query}
        placeholder={text.placeholder}
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
      {grouped.map((group) => <section key={group.type} aria-label={text.labels[group.type]}>
        <p className="px-3 pb-1 pt-2 font-mono text-[10px] font-bold uppercase tracking-[.18em] text-amber-300/75">{text.labels[group.type]}</p>
        {group.items.map((item) => {
          resultIndex += 1
          const index = resultIndex
          return <button key={item.id} type="button" role="option" aria-selected={activeIndex === index} onMouseEnter={() => setActiveIndex(index)} onClick={() => navigate(item)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-amber-300/[.08] aria-selected:bg-amber-300/[.1]">
            <SearchLogo item={item} />
            <span className="min-w-0"><strong className="block truncate text-sm text-slate-100">{item.name}</strong><span className="mt-0.5 block text-xs text-slate-500">{typeLabels[item.type]}</span></span>
          </button>
        })}
      </section>)}
      {!results.length && <p className="px-4 py-6 text-center text-sm text-slate-400">{text.empty}</p>}
    </div>}
  </div>
}

function SearchLogo({ item }: { item: PublicSearchItem }) {
  if (!item.logoUrl) return <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-amber-200">{item.name.slice(0, 2).toUpperCase()}</span>
  // Los logos son administrados desde Supabase y pueden usar hosts dinámicos.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={item.logoUrl} alt={item.logoAlt || item.name} width={36} height={36} className="size-9 shrink-0 rounded-lg border border-white/10 bg-white object-contain p-1" />
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()
}
