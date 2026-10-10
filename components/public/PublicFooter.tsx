import Link from 'next/link'
import { ArrowUpRight, BadgeCheck, RefreshCw } from 'lucide-react'
import { BrandMark } from './BrandMark'
import type { PublicLanguage } from '@/lib/public-language'
import type { BrandingAsset } from '@/lib/branding-config'
import { getPublicUi, publicPath } from '@/lib/public-i18n'

export function PublicFooter({ language = 'es', logo }: { language?: PublicLanguage; logo: BrandingAsset }) {
  const t = getPublicUi(language)
  return <footer className="relative overflow-hidden border-t border-amber-300/10 bg-[#060d17] px-4 py-12 sm:px-6 lg:px-8">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(240,196,84,.7),transparent)]" />
    <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.45fr_2fr]">
      <div><BrandMark desktop={logo} /><p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">{t('footer.description')}</p><div className="mt-6 flex flex-wrap gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[.05] px-3 py-1.5 text-xs text-emerald-200"><BadgeCheck className="size-3.5" /> {t('footer.sourcedData')}</span><span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[.03] px-3 py-1.5 text-xs text-slate-400"><RefreshCw className="size-3.5" /> {t('footer.continuousUpdates')}</span></div></div>
      <div className="grid grid-cols-2 gap-8 sm:grid-cols-3"><FooterGroup title={t('footer.explore')} links={[[publicPath('/prop-firms', language), t('nav.propFirms')], [publicPath('/payouts', language), t('nav.payouts')], [publicPath('/ofertas', language), t('nav.offers')], [publicPath('/comparador', language), t('nav.comparator')], [publicPath('/brokers', language), t('nav.brokers')], [publicPath('/herramientas', language), t('nav.tools')], [publicPath('/calculadoras', language), t('nav.calculators')]]} /><FooterGroup title={t('footer.discover')} links={[[publicPath('/comunidades', language), t('nav.communities')], [publicPath('/exchanges', language), t('nav.exchanges')], [publicPath('/blog', language), t('nav.blog')], [publicPath('/giveaway', language), t('nav.giveaway')]]} /><FooterGroup title={t('footer.transparency')} links={[[publicPath('/comparador', language), t('nav.methodology')], [publicPath('/payouts', language), t('footer.verifiableSources')]]} /></div>
    </div>
    <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-white/8 pt-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} Tradagora</span><span>{t('footer.region')}</span></div>
  </footer>
}

function FooterGroup({ title, links }: { title: string; links: Array<[string, string]> }) {
  return <div><h3 className="text-xs font-bold uppercase tracking-[.16em] text-slate-300">{title}</h3><nav className="mt-4 grid gap-3">{links.map(([href, label]) => <Link key={href} href={href} className="group inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-amber-200">{label}<ArrowUpRight className="size-3 opacity-0 transition group-hover:opacity-100" /></Link>)}</nav></div>
}
