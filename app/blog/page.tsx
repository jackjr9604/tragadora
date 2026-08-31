import { PlaceholderPublicPage } from '@/components/public/PlaceholderPublicPage'
import { getHomeData } from '@/lib/home-data'
import { getPageContent } from '@/lib/site-content'
import { resolvePublicLanguage } from '@/lib/language'
export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) { const language = await resolvePublicLanguage((await searchParams).lang); const [data, content] = await Promise.all([getHomeData(language), getPageContent('blog', language)]); return <PlaceholderPublicPage payouts={data.latestPayouts} content={content} language={language} title="Ideas, análisis y guías." subtitle="Contenido para entender mejor el ecosistema de trading." path="/blog" /> }
