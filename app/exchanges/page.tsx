import { PlaceholderPublicPage } from '@/components/public/PlaceholderPublicPage'
import { getHomeData } from '@/lib/home-data'
import { getPageContent } from '@/lib/site-content'
import { resolvePublicLanguage } from '@/lib/public-language'
export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) { const language = resolvePublicLanguage((await searchParams).lang); const [data, content] = await Promise.all([getHomeData(), getPageContent('exchanges', language)]); return <PlaceholderPublicPage payouts={data.latestPayouts} content={content} language={language} title="Exchanges y mercados cripto." subtitle="Compara alternativas desde una vista clara." path="/exchanges" /> }
