import { PlaceholderPublicPage } from '@/components/public/PlaceholderPublicPage'
import { getPageContent } from '@/lib/site-content'
import { resolvePublicLanguage } from '@/lib/language'
export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) { const language = await resolvePublicLanguage((await searchParams).lang); const content = await getPageContent('brokers', language); return <PlaceholderPublicPage content={content} language={language} title="Brokers para operar tu capital." subtitle="Una sección preparada para comparar opciones disponibles." path="/brokers" /> }
