import Link from 'next/link'
import { BadgeCheck } from 'lucide-react'
import { BrandMark } from './BrandMark'

export function PublicFooter() {
  return <footer className="border-t border-white/8 bg-[#070d17] px-4 py-12 sm:px-6 lg:px-8"><div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.4fr_1fr_1fr]"><div><BrandMark /><p className="mt-4 max-w-md text-sm leading-6 text-slate-500">Información comparativa para traders. Verifica siempre las condiciones oficiales.</p></div><div><h3 className="text-sm font-semibold text-white">Explorar</h3><div className="mt-4 grid gap-3 text-sm text-slate-500"><Link href="/prop-firms">Prop Firms</Link><Link href="/payouts">Payouts</Link><Link href="/ofertas">Ofertas</Link></div></div><div><h3 className="text-sm font-semibold text-white">Transparencia</h3><div className="mt-4 grid gap-3 text-sm text-slate-500"><Link href="/payouts">Metodología</Link><span className="flex items-center gap-2"><BadgeCheck className="size-4 text-cyan-300" /> Fuentes verificables</span></div></div></div><div className="mx-auto mt-10 flex max-w-7xl flex-col gap-2 border-t border-white/8 pt-6 text-xs text-slate-600 sm:flex-row sm:justify-between"><span>© {new Date().getFullYear()} Tragadora</span><span>Hecho para traders de Latinoamérica.</span></div></footer>
}
