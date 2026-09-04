import type { HomePayout } from '@/lib/home-data'
import type { PageContent } from '@/lib/site-content'
import { PageHero } from './PageHero'
import { PublicPageShell } from './PublicPageShell'
import type { PublicLanguage } from '@/lib/public-language'

export function PlaceholderPublicPage({ payouts, content, language, title, subtitle, path }: { payouts: HomePayout[]; content: PageContent; language: PublicLanguage; title: string; subtitle: string; path: string }) {
  const message = language === 'en'
    ? ['Section ready', 'Navigation and managed content are available. Specific data modules will be added here without overloading the home page.']
    : language === 'pt'
      ? ['Seção preparada', 'A navegação e o conteúdo administrável estão disponíveis. Os módulos de dados específicos serão adicionados aqui sem sobrecarregar a página inicial.']
      : ['Sección preparada', 'La navegación y el contenido administrable ya están disponibles. Los módulos de datos específicos se incorporarán aquí sin recargar la portada.']
  return <PublicPageShell payouts={payouts} language={language}><PageHero content={content} fallbackTitle={title} fallbackSubtitle={subtitle} primaryHref={path} compact /><section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><div className="tg-empty tradagora-pattern tradagora-pattern-gold rounded-2xl p-8 text-center sm:p-12"><p className="tg-eyebrow">Próximamente</p><h2 className="mt-3 text-2xl font-bold">{message[0]}</h2><p className="mx-auto mt-3 max-w-xl text-slate-400">{message[1]}</p></div></section></PublicPageShell>
}
