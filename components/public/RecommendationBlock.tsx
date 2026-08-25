'use client'

import { FormEvent, useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'

export function RecommendationBlock({
  badge = 'Recomendador',
  title = 'Encuentra una firma para tu forma de operar.',
  subtitle = 'Cuéntanos lo esencial de tu perfil. Esta primera versión organiza tus preferencias mientras ampliamos el motor de comparación.',
}: {
  badge?: string
  title?: string
  subtitle?: string
}) {
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
              <Sparkles className="size-4" /> {badge}
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
            <p className="mt-4 max-w-xl text-slate-400">{subtitle}</p>
          </div>

          <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-white/10 bg-[#0b1423]/75 p-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-300">Mercado
              <select required className="rounded-xl border border-white/10 bg-[#131f31] px-4 py-3 text-white outline-none focus:border-cyan-300/50">
                <option value="">Seleccionar</option><option>Futuros</option><option>Forex / CFD</option><option>Cripto</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm text-slate-300">Experiencia
              <select required className="rounded-xl border border-white/10 bg-[#131f31] px-4 py-3 text-white outline-none focus:border-cyan-300/50">
                <option value="">Seleccionar</option><option>Estoy empezando</option><option>Intermedia</option><option>Avanzada</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm text-slate-300">Presupuesto
              <select required className="rounded-xl border border-white/10 bg-[#131f31] px-4 py-3 text-white outline-none focus:border-cyan-300/50">
                <option value="">Seleccionar</option><option>Hasta $100</option><option>$100 – $300</option><option>Más de $300</option>
              </select>
            </label>
            <button className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#f7c64b] px-5 py-3 font-bold text-[#101827] hover:bg-[#ffd56c]">
              Ver mi perfil <ArrowRight className="size-4" />
            </button>
            {sent && <p className="sm:col-span-2 text-sm text-cyan-300">Perfil listo. Pronto podrás recibir comparaciones personalizadas con datos del catálogo.</p>}
          </form>
        </div>
      </div>
    </section>
  )
}
