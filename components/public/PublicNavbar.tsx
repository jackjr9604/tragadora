'use client'

import Link from 'next/link'
import { Menu, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { BrandMark } from './BrandMark'
import { languageUrl, persistPublicLanguage, type PublicLanguage, type PublicLanguageOption } from '@/lib/public-language'

const paths = ['/payouts', '/prop-firms', '/comparador', '/ofertas', '/brokers', '/herramientas', '/comunidades', '/exchanges', '/blog', '/giveaway'] as const
const navCopy = {
  es: { links: ['Payouts', 'Prop Firms', 'Comparador', 'Ofertas', 'Brokers', 'Herramientas', 'Comunidades', 'Exchanges', 'Blog', 'Giveaway'], search: 'Buscar firma o bróker', methodology: 'Metodología', explore: 'Explorar firmas' },
  en: { links: ['Payouts', 'Prop Firms', 'Compare', 'Offers', 'Brokers', 'Tools', 'Communities', 'Exchanges', 'Blog', 'Giveaway'], search: 'Search firm or broker', methodology: 'Methodology', explore: 'Explore firms' },
  pt: { links: ['Payouts', 'Prop Firms', 'Comparador', 'Ofertas', 'Brokers', 'Ferramentas', 'Comunidades', 'Exchanges', 'Blog', 'Giveaway'], search: 'Buscar firma ou corretora', methodology: 'Metodologia', explore: 'Explorar firmas' },
} as const

export function PublicNavbar({ language = 'es', languages }: { language?: PublicLanguage; languages: PublicLanguageOption[] }) {
  const [open, setOpen] = useState(false)
  const languageParam = useSearchParams().get('lang')
  const activeLanguage = languages.some((item) => item.code === languageParam)
    ? languageParam as string
    : language
  const text = navCopy[activeLanguage as keyof typeof navCopy] ?? navCopy.es
  const links = paths.map((href, index) => [text.links[index], href] as const)

  useEffect(() => {
    document.documentElement.lang = activeLanguage
    if (languageParam && languages.some((item) => item.code === languageParam)) persistPublicLanguage(activeLanguage)
  }, [activeLanguage, languageParam, languages])

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[#0a1220]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-7 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Tradagora, inicio">
          <BrandMark />
        </Link>

        <nav className="hidden flex-1 items-center gap-6 lg:flex" aria-label="Principal">
          {links.map(([label, href]) => (
            <Link key={label} href={href} className="text-sm text-slate-400 transition hover:text-white">
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <label className="relative hidden xl:block">
            <span className="sr-only">Buscar</span>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              placeholder={text.search}
              className="h-10 w-48 rounded-xl border border-white/10 bg-white/[.035] pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40"
            />
          </label>
          <select aria-label="Idioma" value={activeLanguage} onChange={(event) => { const next = event.target.value as PublicLanguage; persistPublicLanguage(next); window.location.href = languageUrl(window.location.href, next) }} className="h-10 rounded-xl border border-cyan-300/20 bg-[#111c2e] px-3 text-sm font-semibold text-cyan-200 outline-none">
            {languages.map((item) => <option key={item.code} value={item.code}>{item.code.toUpperCase()}</option>)}
          </select>
          <Link href="/payouts" className="rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5">
            {text.methodology}
          </Link>
          <Link href="/prop-firms" className="rounded-xl bg-[#f7c64b] px-4 py-2.5 text-sm font-bold text-[#101827] transition hover:bg-[#ffd56c]">
            {text.explore}
          </Link>
        </div>

        <button type="button" onClick={() => setOpen(!open)} className="ml-auto rounded-lg border border-white/10 p-2 text-white md:hidden" aria-expanded={open} aria-label="Abrir navegación">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-white/8 px-4 py-4 md:hidden" aria-label="Navegación móvil">
          <div className="mx-auto grid max-w-7xl gap-1">
            <select aria-label="Idioma" value={activeLanguage} onChange={(event) => { const next = event.target.value as PublicLanguage; persistPublicLanguage(next); window.location.href = languageUrl(window.location.href, next) }} className="mb-2 h-10 rounded-xl border border-cyan-300/20 bg-[#111c2e] px-3 text-sm font-semibold text-cyan-200 outline-none">
              {languages.map((item) => <option key={item.code} value={item.code}>{item.nativeName}</option>)}
            </select>
            {links.map(([label, href]) => (
              <Link key={label} href={href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
