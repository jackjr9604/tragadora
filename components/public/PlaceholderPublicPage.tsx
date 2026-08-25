import type { HomePayout } from '@/lib/home-data'
import type { PageContent } from '@/lib/site-content'
import { PageHero } from './PageHero'
import { PublicPageShell } from './PublicPageShell'
import type { PublicLanguage } from '@/lib/public-language'

export function PlaceholderPublicPage({ payouts, content, language, title, subtitle, path }: { payouts: HomePayout[]; content: PageContent; language: PublicLanguage; title: string; subtitle: string; path: string }) {
  return <PublicPageShell payouts={payouts} language={language}><PageHero content={content} fallbackTitle={title} fallbackSubtitle={subtitle} primaryHref={path} /><section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="rounded-2xl border border-dashed border-white/15 bg-[#111c2e]/60 p-10 text-center"><h2 className="text-2xl font-bold">Sección preparada</h2><p className="mx-auto mt-3 max-w-xl text-slate-400">La navegación y el contenido administrable ya están disponibles. Los módulos de datos específicos se incorporarán aquí sin recargar la portada.</p></div></section></PublicPageShell>
}
