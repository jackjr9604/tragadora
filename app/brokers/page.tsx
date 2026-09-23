import { BrokerDirectory } from '@/components/public/BrokerDirectory'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { getPublicBrokers } from '@/lib/brokers'
import { resolvePublicLanguage } from '@/lib/language'

export const revalidate = 60

export default async function BrokersPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const brokers = await getPublicBrokers(language)
  return <PublicPageShell language={language}>
    <section className="tg-hero"><div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14"><p className="tg-eyebrow">Brokers</p><h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight text-white sm:text-5xl">Brokers para operar con criterio.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">Compara información esencial antes de elegir.</p></div></section>
    <section className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><BrokerDirectory brokers={brokers} language={language} /></section>
  </PublicPageShell>
}
