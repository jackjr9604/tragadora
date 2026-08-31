import Link from 'next/link'
import { BadgeCheck } from 'lucide-react'
import { BrandMark } from './BrandMark'
import type { PublicLanguage } from '@/lib/public-language'

const copy = {
  es: { description: 'Información comparativa para traders. Verifica siempre las condiciones oficiales.', explore: 'Explorar', offers: 'Ofertas', transparency: 'Transparencia', methodology: 'Metodología', sources: 'Fuentes verificables', region: 'Hecho para traders de Latinoamérica.' },
  en: { description: 'Comparative information for traders. Always verify the official terms.', explore: 'Explore', offers: 'Offers', transparency: 'Transparency', methodology: 'Methodology', sources: 'Verifiable sources', region: 'Built for traders in Latin America.' },
  pt: { description: 'Informações comparativas para traders. Verifique sempre as condições oficiais.', explore: 'Explorar', offers: 'Ofertas', transparency: 'Transparência', methodology: 'Metodologia', sources: 'Fontes verificáveis', region: 'Feito para traders da América Latina.' },
} as const

export function PublicFooter({ language = 'es' }: { language?: PublicLanguage }) {
  const text = copy[language as keyof typeof copy] ?? copy.es
  return <footer className="border-t border-white/8 bg-[#070d17] px-4 py-12 sm:px-6 lg:px-8"><div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.4fr_1fr_1fr]"><div><BrandMark /><p className="mt-4 max-w-md text-sm leading-6 text-slate-500">{text.description}</p></div><div><h3 className="text-sm font-semibold text-white">{text.explore}</h3><div className="mt-4 grid gap-3 text-sm text-slate-500"><Link href="/prop-firms">Prop Firms</Link><Link href="/payouts">Payouts</Link><Link href="/ofertas">{text.offers}</Link></div></div><div><h3 className="text-sm font-semibold text-white">{text.transparency}</h3><div className="mt-4 grid gap-3 text-sm text-slate-500"><Link href="/payouts">{text.methodology}</Link><span className="flex items-center gap-2"><BadgeCheck className="size-4 text-cyan-300" /> {text.sources}</span></div></div></div><div className="mx-auto mt-10 flex max-w-7xl flex-col gap-2 border-t border-white/8 pt-6 text-xs text-slate-600 sm:flex-row sm:justify-between"><span>© {new Date().getFullYear()} Tradagora</span><span>{text.region}</span></div></footer>
}
