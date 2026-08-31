import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [
    platformsResult,
    challengesResult,
    offersResult,
    clicksResult,
    mediaResult,
  ] = await Promise.all([
    supabase
      .from('platforms')
      .select('id', { count: 'exact', head: true }),

    supabase
      .from('challenges')
      .select('id', { count: 'exact', head: true }),

    supabase
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .eq('status', true),

    supabase
      .from('affiliate_clicks')
      .select('id', { count: 'exact', head: true }),

    supabase
      .from('media')
      .select('id', { count: 'exact', head: true }),
  ])

  const stats = [
    {
      name: 'Prop Firms',
      value: platformsResult.count ?? 0,
      href: '/admin/platforms',
    },
    {
      name: 'Challenges',
      value: challengesResult.count ?? 0,
      href: '/admin/challenges',
    },
    {
      name: 'Ofertas activas',
      value: offersResult.count ?? 0,
      href: '/admin/offers',
    },
    {
      name: 'Clicks afiliados',
      value: clicksResult.count ?? 0,
      href: '/admin/affiliate-links',
    },
    {
      name: 'Archivos multimedia',
      value: mediaResult.count ?? 0,
      href: '/admin/media',
    },
  ]

  const { data: latestPlatforms } = await supabase
    .from('platforms')
    .select(`
      id,
      name,
      slug,
      status,
      score,
      created_at
    `)
    .order('created_at', {
      ascending: false,
    })
    .limit(5)

  const { data: latestOffers } = await supabase
    .from('offers')
    .select(`
      id,
      title,
      discount_value,
      discount_type,
      status,
      created_at,
      platforms (
        name
      )
    `)
    .order('created_at', {
      ascending: false,
    })
    .limit(5)

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Dashboard
          </h1>

          <p className="mt-1 text-slate-500">
            Centro de administración de Tradagora.
          </p>
        </div>

        {/* STATS */}

        <div className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((stat) => (
            <Link
              key={stat.name}
              href={stat.href}
              className="rounded-xl bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-md"
            >
              <p className="text-sm text-slate-500">
                {stat.name}
              </p>

              <p className="mt-2 text-3xl font-bold">
                {stat.value}
              </p>
            </Link>
          ))}
        </div>

        {/* QUICK ACTIONS */}

        <div className="mb-8 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-5 text-lg font-semibold">
            Acciones rápidas
          </h2>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/platforms/new"
              className="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white"
            >
              + Prop Firm
            </Link>

            <Link
              href="/admin/offers/new"
              className="rounded-lg border px-4 py-3 text-sm font-medium"
            >
              + Oferta
            </Link>

            <Link
              href="/admin/media"
              className="rounded-lg border px-4 py-3 text-sm font-medium"
            >
              Subir imagen
            </Link>

            <Link
              href="/admin/affiliate-links"
              className="rounded-lg border px-4 py-3 text-sm font-medium"
            >
              Gestionar afiliados
            </Link>
          </div>
        </div>

        {/* TWO COLUMNS */}

        <div className="grid gap-8 lg:grid-cols-2">

          {/* PROP FIRMS */}

          <div className="rounded-xl bg-white shadow">
            <div className="flex items-center justify-between border-b p-6">
              <div>
                <h2 className="text-lg font-semibold">
                  Últimas Prop Firms
                </h2>

                <p className="text-sm text-slate-500">
                  Plataformas añadidas recientemente.
                </p>
              </div>

              <Link
                href="/admin/platforms"
                className="text-sm font-medium underline"
              >
                Ver todas
              </Link>
            </div>

            <div>
              {latestPlatforms?.map((platform) => (
                <div
                  key={platform.id}
                  className="flex items-center justify-between border-b p-5 last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {platform.name}
                    </p>

                    <p className="text-sm text-slate-500">
                      /{platform.slug}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-medium">
                      {platform.score ?? '—'}
                    </p>

                    <p className="text-xs text-slate-500">
                      {platform.status}
                    </p>
                  </div>
                </div>
              ))}

              {(!latestPlatforms ||
                latestPlatforms.length === 0) && (
                <p className="p-6 text-slate-500">
                  No hay Prop Firms.
                </p>
              )}
            </div>
          </div>

          {/* OFFERS */}

          <div className="rounded-xl bg-white shadow">
            <div className="flex items-center justify-between border-b p-6">
              <div>
                <h2 className="text-lg font-semibold">
                  Últimas ofertas
                </h2>

                <p className="text-sm text-slate-500">
                  Promociones creadas recientemente.
                </p>
              </div>

              <Link
                href="/admin/offers"
                className="text-sm font-medium underline"
              >
                Ver todas
              </Link>
            </div>

            <div>
              {latestOffers?.map((offer) => (
                <div
                  key={offer.id}
                  className="flex items-center justify-between border-b p-5 last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {offer.title}
                    </p>

                    <p className="text-sm text-slate-500">
                      {offer.platforms?.[0]?.name ?? '—'}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold">
                      {offer.discount_value}
                      {offer.discount_type ===
                      'percentage'
                        ? '%'
                        : ' USD'}
                    </p>

                    <p className="text-xs text-slate-500">
                      {offer.status
                        ? 'Activa'
                        : 'Inactiva'}
                    </p>
                  </div>
                </div>
              ))}

              {(!latestOffers ||
                latestOffers.length === 0) && (
                <p className="p-6 text-slate-500">
                  No hay ofertas.
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
    </main>
  )
}
