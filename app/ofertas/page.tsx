import { headers } from 'next/headers'
import { Check } from 'lucide-react'
import { OffersExperience } from '@/components/public/offers/OffersExperience'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { resolvePublicLanguage } from '@/lib/language'
import { getPublicOffers } from '@/lib/public-offers'

export const revalidate = 60

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const countryCode = (await headers()).get('x-vercel-ip-country')
  const offers = await getPublicOffers(language, countryCode)

  return (
    <PublicPageShell language={language}>
      <section className="tg-hero">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <p className="tg-eyebrow">Tradagora · oportunidades verificables</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl">Ofertas activas para traders</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Compara descuentos, códigos promocionales y beneficios vigentes de Prop Firms.</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">{['Promos activas', 'Códigos configurados', 'Beneficios adicionales'].map((item) => <span key={item} className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-amber-300" />{item}</span>)}</div>
        </div>
      </section>
      <OffersExperience offers={offers} language={language} nowIso={new Date().toISOString()} />
    </PublicPageShell>
  )
}
