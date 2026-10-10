import type { PageContent } from '@/lib/site-content'
import { PageHero } from './PageHero'
import { PublicPageShell } from './PublicPageShell'
import type { PublicLanguage } from '@/lib/public-language'
import { getPublicUi } from '@/lib/public-i18n'

export function PlaceholderPublicPage({ content, language, title, subtitle, path }: { content: PageContent; language: PublicLanguage; title: string; subtitle: string; path: string }) {
  const t = getPublicUi(language)
  return <PublicPageShell language={language}><PageHero content={content} language={language} fallbackTitle={title} fallbackSubtitle={subtitle} primaryHref={path} compact /><section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><div className="tg-empty tradagora-pattern tradagora-pattern-gold rounded-2xl p-8 text-center sm:p-12"><p className="tg-eyebrow">{t('placeholder.comingSoon')}</p><h2 className="mt-3 text-2xl font-bold">{t('placeholder.ready')}</h2><p className="mx-auto mt-3 max-w-xl text-slate-400">{t('placeholder.description')}</p></div></section></PublicPageShell>
}
