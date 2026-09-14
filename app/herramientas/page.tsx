import { PlaceholderPublicPage } from '@/components/public/PlaceholderPublicPage'
import { getPageContent } from '@/lib/site-content'
import { resolvePublicLanguage } from '@/lib/language'
export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) { const language = await resolvePublicLanguage((await searchParams).lang); const content = await getPageContent('herramientas', language); return <PlaceholderPublicPage content={content} language={language} title="Herramientas para tomar mejores decisiones." subtitle="Recursos prácticos para organizar tu operativa." path="/herramientas" /> }
