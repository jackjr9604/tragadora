import { PlaceholderPublicPage } from '@/components/public/PlaceholderPublicPage'
import { getPageContent } from '@/lib/site-content'
import { resolvePublicLanguage } from '@/lib/language'
export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) { const language = await resolvePublicLanguage((await searchParams).lang); const content = await getPageContent('giveaway', language); return <PlaceholderPublicPage content={content} language={language} title="Giveaways para la comunidad." subtitle="Consulta campañas activas y sus condiciones." path="/giveaway" /> }
