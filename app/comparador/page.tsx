import { PlaceholderPublicPage } from '@/components/public/PlaceholderPublicPage'
import { getPageContent } from '@/lib/site-content'
import { resolvePublicLanguage } from '@/lib/language'
export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) { const language = await resolvePublicLanguage((await searchParams).lang); const content = await getPageContent('comparador', language); return <PlaceholderPublicPage content={content} language={language} title="Compara firmas lado a lado." subtitle="Elige las variables que importan para tu operativa." path="/prop-firms" /> }
