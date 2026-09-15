import { Suspense } from 'react'
import { HomeHeroFallback, HomePublic } from '@/components/public/HomePublic'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { getHomeData } from '@/lib/home-data'
import { getPageContent } from '@/lib/site-content'
import { resolvePublicLanguage } from '@/lib/language'
import type { RecommendationCriteria } from '@/lib/prop-firm-recommender'

export const revalidate = 60

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const language = await resolvePublicLanguage(params.lang)
  const stringParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value
  const numberParam = (value: string | string[] | undefined) => {
    const parsed = Number(stringParam(value))
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }
  const initialCriteria: Partial<RecommendationCriteria> = {
    country: stringParam(params.country)?.toUpperCase(), market: stringParam(params.market),
    experience: stringParam(params.experience), budget: numberParam(params.budget), accountSize: numberParam(params.account),
  }
  const content = await getPageContent('home', language)

  return (
    <PublicPageShell language={language}>
      <Suspense fallback={<HomeHeroFallback content={content} language={language} />}>
        <HomeData content={content} language={language} initialCriteria={initialCriteria} />
      </Suspense>
    </PublicPageShell>
  )
}

async function HomeData({ content, language, initialCriteria }: { content: Awaited<ReturnType<typeof getPageContent>>; language: Awaited<ReturnType<typeof resolvePublicLanguage>>; initialCriteria: Partial<RecommendationCriteria> }) {
  const data = await getHomeData(language)
  return <HomePublic content={content} language={language} latestPayouts={data.latestPayouts} featuredPlatforms={data.featuredPlatforms} offers={data.offers} recommendationFirms={data.recommendationFirms} countries={data.countries} initialCriteria={initialCriteria} rankings={data.rankings} stats={data.stats} />
}
