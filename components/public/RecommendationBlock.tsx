'use client'

import { FormEvent, useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { publicRecommendationCopy, publicUiLanguage } from '@/lib/public-i18n'
import type { PublicLanguage } from '@/lib/public-language'

export function RecommendationBlock({
  language = 'es', badge, title, subtitle,
}: {
  language?: PublicLanguage; badge?: string; title?: string; subtitle?: string
}) {
  const copy = publicRecommendationCopy[publicUiLanguage(language)]
  const [sent, setSent] = useState(false)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSent(true)
  }

  return (
    <section id="comunidad" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(22,201,180,.11),rgba(17,28,46,.8)_48%,rgba(247,198,75,.08))] p-6 sm:p-10 lg:p-14">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.22em] text-cyan-300">
              <Sparkles className="size-4" /> {badge ?? copy.badge}
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title ?? copy.title}</h2>
            <p className="mt-4 max-w-xl text-slate-400">{subtitle ?? copy.subtitle}</p>
          </div>

          <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-white/10 bg-[#0b1423]/75 p-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-300">{copy.market}
              <select required className="rounded-xl border border-white/10 bg-[#131f31] px-4 py-3 text-white outline-none focus:border-cyan-300/50">
                <option value="">{copy.select}</option><option>{copy.futures}</option><option>Forex / CFD</option><option>{copy.crypto}</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm text-slate-300">{copy.experience}
              <select required className="rounded-xl border border-white/10 bg-[#131f31] px-4 py-3 text-white outline-none focus:border-cyan-300/50">
                <option value="">{copy.select}</option><option>{copy.beginner}</option><option>{copy.intermediate}</option><option>{copy.advanced}</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm text-slate-300">{copy.budget}
              <select required className="rounded-xl border border-white/10 bg-[#131f31] px-4 py-3 text-white outline-none focus:border-cyan-300/50">
                <option value="">{copy.select}</option><option>{copy.upTo100}</option><option>$100 – $300</option><option>{copy.over300}</option>
              </select>
            </label>
            <button className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#f7c64b] px-5 py-3 font-bold text-[#101827] hover:bg-[#ffd56c]">
              {copy.submit} <ArrowRight className="size-4" />
            </button>
            {sent && <p className="sm:col-span-2 text-sm text-cyan-300">{copy.ready}</p>}
          </form>
        </div>
      </div>
    </section>
  )
}
