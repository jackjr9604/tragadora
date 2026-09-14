import { PlaceholderPublicPage } from '@/components/public/PlaceholderPublicPage'
import { getPageContent } from '@/lib/site-content'
import { resolvePublicLanguage } from '@/lib/language'
export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) { const language = await resolvePublicLanguage((await searchParams).lang); const content = await getPageContent('exchanges', language); return <PlaceholderPublicPage content={content} language={language} title="Exchanges y mercados cripto." subtitle="Compara alternativas desde una vista clara." path="/exchanges" /> }
