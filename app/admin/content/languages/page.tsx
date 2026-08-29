import { isTranslationProviderConfigured } from '@/lib/content-translation'
import { LanguagesManager } from '@/components/admin/content/LanguagesManager'

export default function LanguagesPage() {
  return <main className="min-h-screen bg-slate-100 p-8"><div className="mx-auto max-w-6xl"><div className="mb-8"><p className="text-sm font-medium text-slate-500">Contenido / Idiomas</p><h1 className="mt-1 text-3xl font-bold">Idiomas</h1><p className="mt-2 text-slate-500">Administra los idiomas disponibles en el CMS y el selector público.</p></div><LanguagesManager translationProviderConfigured={isTranslationProviderConfigured()} /></div></main>
}
