import { getHomeData } from '@/lib/home-data'
import { getPageContent, pageValue } from '@/lib/site-content'
import { resolvePublicLanguage } from '@/lib/language'
import { getPropFirmDirectory } from '@/lib/prop-firm-directory'
import { PropFirmDirectory } from '@/components/public/PropFirmDirectory'
import { PublicPageShell } from '@/components/public/PublicPageShell'

export const revalidate = 60

export default async function PropFirmsPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const [data, content, firms] = await Promise.all([
    getHomeData(language),
    getPageContent('prop-firms', language),
    getPropFirmDirectory(),
  ])

  return <PublicPageShell payouts={data.latestPayouts} language={language}>
    <section className="tg-hero">
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <p className="tg-eyebrow">Directorio de Prop Firms</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight text-white sm:text-5xl">{pageValue(content, 'hero', 'title', 'Prop Firms para comparar con criterio.')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">{pageValue(content, 'hero', 'subtitle', 'Busca, filtra y compara firmas antes de elegir.')}</p>
      </div>
    </section>
    <section id="directorio" className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
      <PropFirmDirectory firms={firms} language={language} />
    </section>
  </PublicPageShell>
}
