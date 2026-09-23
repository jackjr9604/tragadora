'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { PublicBroker } from '@/lib/brokers'
import { SearchInput } from '@/components/shared/SearchInput'
import { CountryFlag } from '@/components/shared/CountryFlag'

type Filter = 'all' | 'cfd' | 'futures' | 'crypto' | 'offer'

export function BrokerDirectory({ brokers, language }: { brokers: PublicBroker[]; language: string }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const visible = useMemo(() => brokers.filter((broker) => broker.name.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')))
    .filter((broker) => filter === 'all' || filter === 'offer' ? filter === 'all' || broker.hasOffer : broker.markets.includes(filter)), [brokers, filter, search])
  const featured = brokers.filter((broker) => broker.isFeatured).slice(0, 5)

  return <div>
    {featured.length > 0 && <section aria-labelledby="featured-brokers"><p className="tg-eyebrow">Selección editorial</p><h2 id="featured-brokers" className="mt-2 text-xl font-bold">Brokers destacados</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{featured.map((broker) => <Link key={broker.id} href={`/brokers/${broker.slug}?lang=${language}`} className="group flex items-center gap-3 rounded-2xl border border-amber-300/15 bg-[#111c2e] p-4 transition hover:border-amber-300/35"><BrokerLogo broker={broker} /><div className="min-w-0"><strong className="block truncate">{broker.name}</strong><span className="mt-1 block truncate text-xs text-slate-500">{broker.markets.map(marketLabel).join(' · ') || 'Mercados sin verificar'}</span></div><ArrowUpRight className="ml-auto size-4 text-amber-300" /></Link>)}</div></section>}
    <div className={`${featured.length ? 'mt-8' : ''} flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#111c2e] p-3 lg:flex-row lg:items-center`}><SearchInput value={search} onChange={setSearch} placeholder="Buscar broker" theme="dark" className="flex-1" /><div className="flex flex-wrap gap-2">{([['all', 'Todos'], ['cfd', 'CFD / Forex'], ['futures', 'Futures'], ['crypto', 'Crypto'], ['offer', 'Con oferta']] as const).map(([value, label]) => <button type="button" key={value} onClick={() => setFilter(value)} className={`rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition ${filter === value ? 'border-amber-200/55 bg-[linear-gradient(110deg,#a97313,#e8bb49_55%,#f8d779)] text-slate-950' : 'border-white/10 bg-white/5 text-slate-300 hover:border-amber-300/30 hover:bg-white/10'}`}>{label}</button>)}</div></div>
    <div className="mt-5 hidden lg:block"><div className="grid grid-cols-[minmax(230px,1.2fr)_150px_minmax(190px,1fr)_150px_minmax(180px,1fr)_120px] gap-4 px-5 pb-3 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-500"><span>Broker</span><span>País</span><span>Mercados</span><span>Depósito mínimo</span><span>Regulación</span><span className="text-right">Acción</span></div><div className="space-y-2">{visible.map((broker) => <BrokerRow key={broker.id} broker={broker} language={language} />)}</div></div>
    <div className="mt-5 space-y-3 lg:hidden">{visible.map((broker) => <BrokerCard key={broker.id} broker={broker} language={language} />)}</div>
    {!visible.length && <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-[#111c2e] p-10 text-center text-slate-400">{brokers.length ? 'No encontramos brokers con estos filtros.' : 'Todavía no hay brokers publicados.'}</div>}
  </div>
}

function BrokerRow({ broker, language }: { broker: PublicBroker; language: string }) { return <article className="relative grid min-h-20 grid-cols-[minmax(230px,1.2fr)_150px_minmax(190px,1fr)_150px_minmax(180px,1fr)_120px] items-center gap-4 rounded-xl border border-white/8 bg-[#111c2e]/75 px-5 py-3 transition hover:border-amber-300/25 hover:bg-[#152238]"><Link href={`/brokers/${broker.slug}?lang=${language}`} aria-label={`Ver ${broker.name}`} className="absolute inset-0 z-[5] rounded-xl" /><Identity broker={broker} /><CountryFlag countryCode={broker.countryCode} countryName={broker.country} /><Badges values={broker.markets.map(marketLabel)} /><span className="font-mono text-sm text-slate-300">{deposit(broker)}</span><span className="truncate text-sm text-slate-300">{broker.regulationSummary || 'Sin verificar'}</span><Link href={`/go/${broker.slug}?lang=${language}`} className="tg-button-gold relative z-10 px-3 py-2.5 text-sm">Visitar <ArrowUpRight className="size-4" /></Link></article> }
function BrokerCard({ broker, language }: { broker: PublicBroker; language: string }) { return <article className="relative rounded-2xl border border-white/10 bg-[#111c2e] p-4"><Link href={`/brokers/${broker.slug}?lang=${language}`} aria-label={`Ver ${broker.name}`} className="absolute inset-0 z-[5] rounded-2xl" /><Identity broker={broker} /><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Fact label="País" value={broker.country} /><Fact label="Depósito mínimo" value={deposit(broker)} /><div className="col-span-2"><p className="text-[10px] uppercase tracking-wider text-slate-500">Mercados</p><Badges values={broker.markets.map(marketLabel)} /></div><div className="col-span-2"><Fact label="Regulación" value={broker.regulationSummary} /></div></div><Link href={`/go/${broker.slug}?lang=${language}`} className="tg-button-gold relative z-10 mt-4 w-full">Visitar <ArrowUpRight className="size-4" /></Link></article> }
function Identity({ broker }: { broker: PublicBroker }) { return <div className="flex min-w-0 items-center gap-3"><BrokerLogo broker={broker} /><strong className="truncate">{broker.name}</strong>{broker.hasOffer && <span className="rounded-full border border-amber-300/20 bg-amber-300/[.06] px-2 py-1 text-[9px] uppercase text-amber-200">Oferta</span>}</div> }
export function BrokerLogo({ broker, large = false }: { broker: PublicBroker; large?: boolean }) { const size = large ? 'size-16 rounded-2xl' : 'size-11 rounded-xl'; return broker.logoUrl ? <BrokerImage broker={broker} size={size} large={large} /> : <span className={`${size} flex shrink-0 items-center justify-center border border-white/10 bg-white/5 font-bold text-amber-200`}>{broker.name.slice(0, 2).toUpperCase()}</span> }
function BrokerImage({ broker, size, large }: { broker: PublicBroker; size: string; large: boolean }) {
  // Las imágenes son administradas por Supabase y pueden usar hosts dinámicos.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={broker.logoUrl ?? ''} alt={broker.logoAlt || broker.name} width={large ? 64 : 44} height={large ? 64 : 44} loading="lazy" decoding="async" className={`${size} shrink-0 border border-white/10 bg-white object-contain p-1`} />
}
function Badges({ values }: { values: string[] }) { return values.length ? <div className="flex flex-wrap gap-1.5">{values.map((value) => <span key={value} className="rounded-md border border-white/8 bg-white/5 px-2 py-1 text-xs text-slate-300">{value}</span>)}</div> : <span className="text-sm text-slate-600">—</span> }
function Fact({ label, value }: { label: string; value: string | null }) { return <div><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-slate-300">{value || '—'}</p></div> }
function deposit(broker: PublicBroker) { if (broker.minimumDeposit === null) return '—'; return new Intl.NumberFormat('en-US', { style: 'currency', currency: broker.minimumDepositCurrency || 'USD', maximumFractionDigits: 2 }).format(broker.minimumDeposit) }
function marketLabel(value: string) { return ({ cfd: 'CFD / Forex', futures: 'Futures', crypto: 'Crypto', options: 'Opciones' } as Record<string, string>)[value] ?? value }
