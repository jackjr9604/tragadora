'use client'

/* eslint-disable react-hooks/purity, @next/next/no-img-element */
import { useEffect, useState } from 'react'
import { ArrowUpRight, Trophy } from 'lucide-react'
import type { Giveaway } from '@/lib/discovery'
import { getPublicUi } from '@/lib/public-i18n'
import type { PublicLanguage } from '@/lib/public-language'

export function GiveawayExperience({ items, language }: { items: Giveaway[]; language: PublicLanguage }) {
  const t = getPublicUi(language), now = Date.now()
  const active = items.find((item) => item.status === 'published' && new Date(item.startsAt).getTime() <= now && new Date(item.endsAt).getTime() > now) ?? items.find((item) => item.isFeatured) ?? items[0]
  if (!active) return <div className="tg-empty rounded-3xl p-12 text-center text-slate-400">{t('giveaway.empty')}</div>
  const past = items.filter((item) => item.id !== active.id && (item.status === 'ended' || new Date(item.endsAt).getTime() <= now))
  return <><Campaign item={active} language={language} />{past.length > 0 && <section className="mt-10"><p className="tg-eyebrow">{t('giveaway.history')}</p><h2 className="mt-2 text-2xl font-bold">{t('giveaway.previous')}</h2><div className="mt-5 grid gap-4 md:grid-cols-3">{past.map((item) => <article key={item.id} className="rounded-2xl border border-white/10 bg-[#111c2e] p-5"><p className="text-xs uppercase text-slate-500">{t('giveaway.ended')}</p><h3 className="mt-2 text-lg font-bold">{item.title}</h3><p className="mt-2 text-sm text-slate-400">{item.prizeTitle}</p>{item.revealTitle && <p className="mt-4 text-sm font-semibold text-amber-300">{item.revealTitle}</p>}</article>)}</div></section>}</>
}

function Campaign({ item, language }: { item: Giveaway; language: PublicLanguage }) {
  const t = getPublicUi(language)
  const [left, setLeft] = useState(() => remaining(item.endsAt))
  useEffect(() => { const timer = setInterval(() => setLeft(remaining(item.endsAt)), 1000); return () => clearInterval(timer) }, [item.endsAt])
  const ended = item.status === 'ended' || left.total <= 0
  return <article className="tradagora-pattern tradagora-pattern-gold overflow-hidden rounded-3xl border border-amber-300/25 bg-[#101b2d]"><div className="grid lg:grid-cols-[1.1fr_.9fr]">{item.coverUrl && <img src={item.coverUrl} alt={item.coverAlt || item.title} className="h-full min-h-72 w-full object-cover lg:order-2" />}<div className="p-6 sm:p-10"><p className="tg-eyebrow">{ended ? t('giveaway.ended') : item.badge || t('giveaway.brand')}</p><h1 className="mt-4 text-4xl font-bold sm:text-5xl">{item.title}</h1><p className="mt-4 max-w-xl leading-7 text-slate-300">{item.shortDescription}</p>{!ended ? <><Countdown value={left} language={language} /><div className="mt-7 flex flex-wrap gap-3">{item.participationUrl && <a href={item.participationUrl} target="_blank" rel="noopener noreferrer" className="tg-button-gold">{t('giveaway.participate')} <ArrowUpRight className="size-4" /></a>}{item.rulesUrl && <a href={item.rulesUrl} target="_blank" rel="noopener noreferrer" className="tg-button-secondary">{t('giveaway.rules')}</a>}</div></> : <div className="mt-7 rounded-2xl border border-amber-300/15 bg-black/15 p-5"><p className="text-sm uppercase tracking-wider text-amber-300">{t('giveaway.ended')}</p><h2 className="mt-2 text-2xl font-bold">{item.revealTitle || t('giveaway.resultsSoon')}</h2>{item.revealContent && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{item.revealContent}</p>}</div>}<div className="mt-8 flex items-start gap-3 border-t border-white/10 pt-6"><Trophy className="mt-1 size-5 text-amber-300" /><div><p className="font-bold">{item.prizeQuantity ? `${item.prizeQuantity} × ` : ''}{item.prizeTitle}</p><p className="mt-1 text-sm text-slate-400">{item.prizeDescription}{item.sponsor ? ` · ${item.sponsor.name}` : ''}</p></div></div></div></div></article>
}

function Countdown({ value, language }: { value: ReturnType<typeof remaining>; language: PublicLanguage }) {
  const t = getPublicUi(language)
  return <div className="mt-7 grid max-w-lg grid-cols-4 gap-2">{[[t('giveaway.days'), value.days], [t('giveaway.hours'), value.hours], [t('giveaway.minutes'), value.minutes], [t('giveaway.seconds'), value.seconds]].map(([label, amount]) => <div key={String(label)} className="rounded-xl border border-white/10 bg-black/20 p-3 text-center"><strong className="block font-mono text-2xl text-white sm:text-3xl">{String(amount).padStart(2, '0')}</strong><span className="mt-1 block text-[10px] uppercase tracking-wider text-slate-500">{label}</span></div>)}</div>
}

function remaining(end: string) { const total = Math.max(0, new Date(end).getTime() - Date.now()), seconds = Math.floor(total / 1000); return { total, days: Math.floor(seconds / 86400), hours: Math.floor(seconds % 86400 / 3600), minutes: Math.floor(seconds % 3600 / 60), seconds: seconds % 60 } }
