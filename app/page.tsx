import { HomePublic } from '@/components/public/HomePublic'
import { getHomeData } from '@/lib/home-data'
import { getPageContent } from '@/lib/site-content'
import { resolvePublicLanguage } from '@/lib/public-language'
import type { RecommendationCriteria } from '@/lib/prop-firm-recommender'

export const revalidate = 60

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const language = resolvePublicLanguage(params.lang)
  const stringParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value
  const numberParam = (value: string | string[] | undefined) => {
    const parsed = Number(stringParam(value))
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }
  const initialCriteria: Partial<RecommendationCriteria> = {
    country: stringParam(params.country)?.toUpperCase(), market: stringParam(params.market),
    experience: stringParam(params.experience), budget: numberParam(params.budget), accountSize: numberParam(params.account),
  }
  const [content, data] = await Promise.all([
    getPageContent('home', language),
    getHomeData(),
  ])

  return (
    <HomePublic
      content={content}
      language={language}
      latestPayouts={data.latestPayouts}
      featuredPlatforms={data.featuredPlatforms}
      offers={data.offers}
      recommendationFirms={data.recommendationFirms}
      countries={data.countries}
      initialCriteria={initialCriteria}
      stats={data.stats}
    />
  )
}
