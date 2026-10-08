import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ToolIcon } from '@/components/tools/ToolIcon'
import type { PublicLanguage } from '@/lib/public-language'
import type { ToolRecord } from '@/lib/tools'

const COPY = {
  es: { use: 'Abrir calculadora', empty: 'Todavía no hay calculadoras publicadas.', note: 'Las calculadoras son utilidades propias de Tradagora. Sus resultados son orientativos y no sustituyen las reglas oficiales de tu broker o Prop Firm.' },
  en: { use: 'Open calculator', empty: 'No calculators have been published yet.', note: 'These calculators are tools developed by Tradagora. Results are estimates and do not replace the official rules of your broker or Prop Firm.' },
  pt: { use: 'Abrir calculadora', empty: 'Ainda não há calculadoras publicadas.', note: 'As calculadoras são utilidades próprias da Tradagora. Os resultados são estimativas e não substituem as regras oficiais da sua corretora ou Prop Firm.' },
} as const

export function CalculatorsDirectory({ calculators, language = 'es' }: { calculators: ToolRecord[]; language?: PublicLanguage }) {
  const locale = language in COPY ? language as keyof typeof COPY : 'es'
  const text = COPY[locale]
  return <div>
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{calculators.map((calculator) => <Link key={calculator.id} href={`/calculadoras/${calculator.slug}?lang=${locale}`} className="group rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(22,36,58,.98),rgba(10,20,35,.98))] p-6 transition hover:-translate-y-1 hover:border-amber-300/40 hover:shadow-[0_22px_55px_rgba(0,0,0,.3)]"><span className="flex size-12 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/[.07] text-amber-300"><ToolIcon iconKey={calculator.icon_key} className="size-6" /></span><p className="mt-5 text-xs font-semibold uppercase tracking-[.14em] text-amber-300">Tradagora</p><h2 className="mt-2 text-xl font-bold text-white">{calculator.name}</h2><p className="mt-3 min-h-18 text-sm leading-6 text-slate-400">{calculator.short_description}</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-amber-200">{text.use}<ArrowRight className="size-4 transition group-hover:translate-x-1" /></span></Link>)}</div>
    {!calculators.length && <div className="tg-empty rounded-2xl p-12 text-center text-slate-400">{text.empty}</div>}
    <p className="mt-8 rounded-2xl border border-white/8 bg-white/[.025] px-5 py-4 text-xs leading-5 text-slate-500">{text.note}</p>
  </div>
}
