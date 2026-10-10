'use client'

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SearchInput } from '@/components/shared/SearchInput'
import type { PublicExchange } from '@/lib/exchanges'
import { getPublicUi, publicLocale, publicPath } from '@/lib/public-i18n'
import type { PublicLanguage } from '@/lib/public-language'

export function ExchangeDirectory({ items, language }: { items: PublicExchange[]; language: PublicLanguage }) {
  const [query, setQuery] = useState('')
  const t = getPublicUi(language)
  const locale = publicLocale(language)
  const shown = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale)
    return items.filter((item) => item.name.toLocaleLowerCase(locale).includes(normalized))
  }, [items, locale, query])
  const typeLabel = (type: PublicExchange['exchangeType']) =>
    t(type === 'decentralized' ? 'exchange.decentralized' : 'exchange.centralized')

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-[#111c2e] p-3">
        <SearchInput value={query} onChange={setQuery} placeholder={`${t('exchange.search')}...`} theme="dark" />
      </div>
      <div className="mt-5 hidden lg:block">
        <div className="tg-data-header tg-data-grid grid grid-cols-[1.2fr_.7fr_.7fr_1fr_.5fr_120px] gap-4 px-5 py-3 text-[11px] uppercase tracking-wider text-slate-500">
          <span>{t('search.type.exchange')}</span><span>{t('directory.country')}</span><span>{t('exchange.type')}</span><span>{t('exchange.products')}</span><span>{t('exchange.fiatSupport')}</span><span>{t('a11y.action')}</span>
        </div>
        <div className="mt-2 space-y-2">
          {shown.map((item) => (
            <div key={item.id} className="tg-data-grid grid grid-cols-[1.2fr_.7fr_.7fr_1fr_.5fr_120px] items-center gap-4 rounded-xl border border-white/10 bg-[#111c2e] px-5 py-4">
              <Identity item={item} />
              <span>{item.country || '—'}</span><span>{typeLabel(item.exchangeType)}</span><span>{item.productSummary || '—'}</span><span>{item.fiatSupport === null ? '—' : t(item.fiatSupport ? 'common.yes' : 'common.no')}</span>
              <Link href={publicPath(`/exchanges/${item.slug}`, language)} className="tg-button-gold px-3 py-2">{t('common.details')} <ArrowUpRight className="size-4" /></Link>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:hidden">
        {shown.map((item) => (
          <Link href={publicPath(`/exchanges/${item.slug}`, language)} key={item.id} className="rounded-2xl border border-white/10 bg-[#111c2e] p-5">
            <Identity item={item} />
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Fact label={t('directory.country')} value={item.country} />
              <Fact label={t('exchange.type')} value={typeLabel(item.exchangeType)} />
              <Fact label={t('exchange.products')} value={item.productSummary} />
              <Fact label={t('exchange.fiatSupport')} value={item.fiatSupport === null ? null : t(item.fiatSupport ? 'common.yes' : 'common.no')} />
            </dl>
          </Link>
        ))}
      </div>
      {!shown.length && <div className="tg-empty mt-5 rounded-2xl p-10 text-center text-slate-400">{t('exchange.noPublished')}</div>}
    </>
  )
}

function Identity({ item }: { item: PublicExchange }) {
  return <div className="flex items-center gap-3">{item.logoUrl ? <img src={item.logoUrl} alt={item.logoAlt || item.name} className="size-11 rounded-xl bg-white object-contain p-1" /> : <span className="flex size-11 items-center justify-center rounded-xl bg-white/5 font-bold text-amber-300">{item.name.slice(0, 2)}</span>}<strong>{item.name}</strong></div>
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-slate-300">{value || '—'}</dd></div>
}
