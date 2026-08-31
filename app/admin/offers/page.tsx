import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ToggleOfferStatus from './ToggleOfferStatus'

export default async function OffersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: offers, error } = await supabase
    .from('offers')
    .select(`
      id,
      platform_id,
      title,
      discount_value,
      discount_type,
      promo_code,
      country_code,
      language,
      starts_at,
      expires_at,
      status
    `)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const platformIds = [...new Set((offers ?? []).map((offer) => offer.platform_id).filter(Boolean))]
  const platformResult = platformIds.length
    ? await supabase.from('platforms').select('id, name').in('id', platformIds)
    : { data: [], error: null }

  if (platformResult.error) {
    throw new Error(platformResult.error.message)
  }

  const platformNames = new Map((platformResult.data ?? []).map((platform) => [platform.id, platform.name]))

  return (
    <main className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Ofertas
          </h1>

          <p className="mt-1 text-slate-500">
            Gestiona las promociones de las Prop Firms.
          </p>
        </div>

        <Link
          href="/admin/offers/new"
          className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white"
        >
          + Nueva oferta
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow">
        <table className="w-full">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left">
                Prop Firm
              </th>

              <th className="px-6 py-4 text-left">
                Oferta
              </th>

              <th className="px-6 py-4 text-left">
                Descuento
              </th>

              <th className="px-6 py-4 text-left">
                Código
              </th>

              <th className="px-6 py-4 text-left">
                País
              </th>

              <th className="px-6 py-4 text-left">
                Vigencia
              </th>

              <th className="px-6 py-4 text-left">
                Estado
              </th>
              <th className="px-6 py-4 text-left">
                Acción
              </th>
            </tr>
          </thead>

          <tbody>
            {offers?.map((offer) => (
              <tr
                key={offer.id}
                className="border-b last:border-0"
              >
                <td className="px-6 py-4 font-medium">
                  {platformNames.get(offer.platform_id) ?? '—'}
                </td>

                <td className="px-6 py-4">
                  {offer.title}
                </td>

                <td className="px-6 py-4">
                  {offer.discount_value}
                  {offer.discount_type === 'percentage'
                    ? '%'
                    : ' USD'}
                </td>

                <td className="px-6 py-4 font-mono">
                  {offer.promo_code || '—'}
                </td>

                <td className="px-6 py-4">
                  {offer.country_code || 'Todos'}
                </td>

                <td className="px-6 py-4 text-sm">
                  {offer.starts_at
                    ? new Date(
                        offer.starts_at
                      ).toLocaleDateString()
                    : '—'}
                  {' → '}
                  {offer.expires_at
                    ? new Date(
                        offer.expires_at
                      ).toLocaleDateString()
                    : 'Sin vencimiento'}
                </td>

                <td className="px-6 py-4">
  <ToggleOfferStatus
    id={offer.id}
    status={offer.status}
  />
</td>
                <td className="px-6 py-4">
  <Link
    href={`/admin/offers/${offer.id}`}
    className="underline"
  >
    Editar
  </Link>
</td>
              </tr>
            ))}

            {(!offers || offers.length === 0) && (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  No hay ofertas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
