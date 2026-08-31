import { PlaceholderPublicPage } from '@/components/public/PlaceholderPublicPage'
import { getHomeData } from '@/lib/home-data'
import { getPageContent } from '@/lib/site-content'
import { resolvePublicLanguage } from '@/lib/language'
export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) { const language = await resolvePublicLanguage((await searchParams).lang); const [data, content] = await Promise.all([getHomeData(language), getPageContent('comunidades', language)]); return <PlaceholderPublicPage payouts={data.latestPayouts} content={content} language={language} title="Comunidades para aprender y compartir." subtitle="Encuentra espacios relevantes para traders." path="/comunidades" /> }
