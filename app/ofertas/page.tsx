import { headers } from 'next/headers'
import { Gift, ShieldCheck, Sparkles } from 'lucide-react'
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
        <div className="mx-auto grid w-full max-w-7xl gap-7 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center lg:px-8">
          <div>
            <p className="tg-eyebrow">Tradagora · oportunidades verificables</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl">Ofertas activas para traders</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Compara descuentos, códigos promocionales y beneficios vigentes de Prop Firms en un solo lugar.</p>
          </div>
          <div className="tg-surface hidden rounded-2xl p-5 lg:block">
            <div className="grid gap-4 text-sm">
              <p className="flex items-center gap-3 text-slate-300"><Sparkles className="size-5 text-amber-300" />Beneficios configurados por oferta</p>
              <p className="flex items-center gap-3 text-slate-300"><ShieldCheck className="size-5 text-amber-300" />Vigencia y disponibilidad aplicadas</p>
              <p className="flex items-center gap-3 text-slate-300"><Gift className="size-5 text-amber-300" />Descuentos y cuentas promocionales</p>
            </div>
          </div>
        </div>
      </section>
      <OffersExperience offers={offers} language={language} nowIso={new Date().toISOString()} />
    </PublicPageShell>
  )
}
