'use client'

import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BrandMark } from './BrandMark'
import { languageUrl, persistPublicLanguage, type PublicLanguage, type PublicLanguageOption } from '@/lib/public-language'
import type { PublicSearchItem } from '@/lib/public-search'
import type { BrandingAsset } from '@/lib/branding-config'
import { PublicGlobalSearch } from './PublicGlobalSearch'
import { getPublicUi, publicPath } from '@/lib/public-i18n'

const paths = ['/payouts', '/prop-firms', '/comparador', '/ofertas', '/brokers', '/herramientas', '/calculadoras', '/comunidades', '/exchanges', '/blog', '/giveaway'] as const
const navKeys = ['nav.payouts', 'nav.propFirms', 'nav.comparator', 'nav.offers', 'nav.brokers', 'nav.tools', 'nav.calculators', 'nav.communities', 'nav.exchanges', 'nav.blog', 'nav.giveaway'] as const

export function PublicNavbar({ language = 'es', languages, searchItems, desktopLogo, mobileLogo }: { language?: PublicLanguage; languages: PublicLanguageOption[]; searchItems: PublicSearchItem[]; desktopLogo: BrandingAsset; mobileLogo: BrandingAsset }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const languageParam = useSearchParams().get('lang')
  const activeLanguage = languages.some((item) => item.code === languageParam)
    ? languageParam as string
    : language
  const t = getPublicUi(activeLanguage)
  const links = paths.map((href, index) => [t(navKeys[index]), href] as const)

  useEffect(() => {
    document.documentElement.lang = activeLanguage
    if (languageParam && languages.some((item) => item.code === languageParam)) persistPublicLanguage(activeLanguage)
  }, [activeLanguage, languageParam, languages])

  return (
    <header className="sticky top-0 z-50 border-b border-amber-300/15 bg-[#060d18]/94 shadow-[0_10px_35px_rgba(0,0,0,.22)] backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-[1440px] items-center gap-5 px-4 sm:px-6 lg:px-8">
        <Link href={publicPath('/', activeLanguage)} aria-label={t('a11y.home')} className="shrink-0">
          <BrandMark responsive desktop={desktopLogo} mobile={mobileLogo} />
        </Link>

        <nav className="hidden flex-1 items-center gap-3 xl:gap-4 lg:flex" aria-label={t('a11y.mainNavigation')}>
          {links.map(([label, href]) => (
            <Link key={label} href={publicPath(href, activeLanguage)} aria-current={pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined} className="relative whitespace-nowrap py-6 text-[13px] text-slate-400 transition after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-center after:scale-x-0 after:bg-[#f0c454] after:shadow-[0_0_10px_#f0c454] after:transition hover:text-white aria-[current=page]:text-[#f0c454] aria-[current=page]:after:scale-x-100 xl:text-sm">
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <PublicGlobalSearch items={searchItems} language={activeLanguage} />
          <select aria-label={t('a11y.language')} value={activeLanguage} onChange={(event) => { const next = event.target.value as PublicLanguage; persistPublicLanguage(next); router.replace(languageUrl(window.location.href, next)) }} className="tg-filter h-10 rounded-xl px-3 text-sm font-semibold">
            {languages.map((item) => <option key={item.code} value={item.code}>{item.code.toUpperCase()}</option>)}
          </select>
          <Link href={publicPath('/payouts', activeLanguage)} className="tg-button-secondary px-4 py-2.5 text-sm">
            {t('nav.methodology')}
          </Link>
          <Link href={publicPath('/prop-firms', activeLanguage)} className="tg-button-gold px-4 py-2.5 text-sm">
            {t('nav.exploreFirms')}
          </Link>
        </div>

        <button type="button" onClick={() => setOpen(!open)} className="ml-auto rounded-lg border border-amber-300/20 bg-white/[.025] p-2 text-white md:hidden" aria-expanded={open} aria-label={open ? t('a11y.closeNavigation') : t('a11y.openNavigation')}>
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-amber-300/10 bg-[#07111e]/98 px-4 py-4 md:hidden" aria-label={t('a11y.mobileNavigation')}>
          <div className="mx-auto grid max-w-7xl gap-1">
            <select aria-label={t('a11y.language')} value={activeLanguage} onChange={(event) => { const next = event.target.value as PublicLanguage; persistPublicLanguage(next); router.replace(languageUrl(window.location.href, next)); setOpen(false) }} className="tg-filter mb-2 h-10 rounded-xl px-3 text-sm font-semibold">
              {languages.map((item) => <option key={item.code} value={item.code}>{item.nativeName}</option>)}
            </select>
            {links.map(([label, href]) => (
              <Link key={label} href={publicPath(href, activeLanguage)} onClick={() => setOpen(false)} aria-current={pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined} className="rounded-lg border border-transparent px-3 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white aria-[current=page]:border-amber-300/20 aria-[current=page]:bg-amber-300/[.06] aria-[current=page]:text-[#f0c454]">
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
