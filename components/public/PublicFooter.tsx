import Link from 'next/link'
import { ArrowUpRight, BadgeCheck, RefreshCw } from 'lucide-react'
import { BrandMark } from './BrandMark'
import type { PublicLanguage } from '@/lib/public-language'

const copy = {
  es: { description: 'Información comparativa para traders. Verifica siempre las condiciones oficiales.', explore: 'Explorar', offers: 'Ofertas', transparency: 'Transparencia', methodology: 'Metodología', sources: 'Fuentes verificables', region: 'Hecho para traders de Latinoamérica.' },
  en: { description: 'Comparative information for traders. Always verify the official terms.', explore: 'Explore', offers: 'Offers', transparency: 'Transparency', methodology: 'Methodology', sources: 'Verifiable sources', region: 'Built for traders in Latin America.' },
  pt: { description: 'Informações comparativas para traders. Verifique sempre as condições oficiais.', explore: 'Explorar', offers: 'Ofertas', transparency: 'Transparência', methodology: 'Metodologia', sources: 'Fontes verificáveis', region: 'Feito para traders da América Latina.' },
} as const

export function PublicFooter({ language = 'es' }: { language?: PublicLanguage }) {
  const text = copy[language as keyof typeof copy] ?? copy.es
  const query = `?lang=${language}`
  return <footer className="relative overflow-hidden border-t border-amber-300/10 bg-[#060d17] px-4 py-12 sm:px-6 lg:px-8"><div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(240,196,84,.7),transparent)]" /><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.45fr_2fr]"><div><BrandMark /><p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">{text.description}</p><div className="mt-6 flex flex-wrap gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[.05] px-3 py-1.5 text-xs text-emerald-200"><BadgeCheck className="size-3.5" /> Datos con fuente</span><span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[.03] px-3 py-1.5 text-xs text-slate-400"><RefreshCw className="size-3.5" /> Actualización continua</span></div></div><div className="grid grid-cols-2 gap-8 sm:grid-cols-3"><FooterGroup title={text.explore} links={[[`/prop-firms${query}`,'Prop Firms'],[`/payouts${query}`,'Payouts'],[`/ofertas${query}`,text.offers],[`/comparador${query}`,'Comparador'],[`/brokers${query}`,'Brokers'],[`/herramientas${query}`,'Herramientas']]} /><FooterGroup title="Descubrir" links={[[`/comunidades${query}`,'Comunidades'],[`/exchanges${query}`,'Exchanges'],[`/blog${query}`,'Blog'],[`/giveaway${query}`,'Giveaway']]} /><FooterGroup title={text.transparency} links={[[`/comparador${query}`,text.methodology],[`/payouts${query}`,text.sources]]} /></div></div><div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-white/8 pt-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} Tradagora</span><span>{text.region}</span></div></footer>
}

function FooterGroup({ title, links }: { title: string; links: Array<[string, string]> }) { return <div><h3 className="text-xs font-bold uppercase tracking-[.16em] text-slate-300">{title}</h3><nav className="mt-4 grid gap-3">{links.map(([href, label]) => <Link key={href} href={href} className="group inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-amber-200">{label}<ArrowUpRight className="size-3 opacity-0 transition group-hover:opacity-100" /></Link>)}</nav></div> }
