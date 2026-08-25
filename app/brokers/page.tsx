import { PlaceholderPublicPage } from '@/components/public/PlaceholderPublicPage'
import { getHomeData } from '@/lib/home-data'
import { getPageContent } from '@/lib/site-content'
import { resolvePublicLanguage } from '@/lib/public-language'
export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) { const language = resolvePublicLanguage((await searchParams).lang); const [data, content] = await Promise.all([getHomeData(), getPageContent('brokers', language)]); return <PlaceholderPublicPage payouts={data.latestPayouts} content={content} language={language} title="Brokers para operar tu capital." subtitle="Una sección preparada para comparar opciones disponibles." path="/brokers" /> }
