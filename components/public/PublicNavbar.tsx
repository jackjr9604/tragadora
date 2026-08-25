'use client'

import Link from 'next/link'
import { Menu, Search, X } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { BrandMark } from './BrandMark'
import { languageUrl, type PublicLanguage } from '@/lib/public-language'

const links = [
  ['Payouts', '/payouts'],
  ['Prop Firms', '/prop-firms'],
  ['Comparador', '/comparador'],
  ['Ofertas', '/ofertas'],
  ['Brokers', '/brokers'],
  ['Herramientas', '/herramientas'],
  ['Comunidades', '/comunidades'],
  ['Exchanges', '/exchanges'],
  ['Blog', '/blog'],
  ['Giveaway', '/giveaway'],
] as const

export function PublicNavbar({ language = 'es' }: { language?: PublicLanguage }) {
  const [open, setOpen] = useState(false)
  const languageParam = useSearchParams().get('lang')
  const activeLanguage = languageParam === 'en' || languageParam === 'pt' || languageParam === 'es'
    ? languageParam
    : language

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[#0a1220]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-7 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Tragadora, inicio">
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
              placeholder="Buscar firma o bróker"
              className="h-10 w-48 rounded-xl border border-white/10 bg-white/[.035] pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40"
            />
          </label>
          <select aria-label="Idioma" value={activeLanguage} onChange={(event) => { const next = event.target.value as PublicLanguage; window.location.href = languageUrl(window.location.href, next) }} className="h-10 rounded-xl border border-cyan-300/20 bg-[#111c2e] px-3 text-sm font-semibold text-cyan-200 outline-none">
            <option value="es">ES</option>
            <option value="en">EN</option>
            <option value="pt">PT</option>
          </select>
          <Link href="/payouts" className="rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5">
            Metodología
          </Link>
          <Link href="/prop-firms" className="rounded-xl bg-[#f7c64b] px-4 py-2.5 text-sm font-bold text-[#101827] transition hover:bg-[#ffd56c]">
            Explorar firmas
          </Link>
        </div>

        <button type="button" onClick={() => setOpen(!open)} className="ml-auto rounded-lg border border-white/10 p-2 text-white md:hidden" aria-expanded={open} aria-label="Abrir navegación">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-white/8 px-4 py-4 md:hidden" aria-label="Navegación móvil">
          <div className="mx-auto grid max-w-7xl gap-1">
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
