import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const SOURCE_NAME =
  'FundingPips RiseUSD - Arbitrum'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(value))
}

export default async function PayoutsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const sourceResult = await supabase
    .from('payout_sources')
    .select(`
      id,
      platform_id,
      name,
      status,
      config,
      last_sync_at,
      last_success_at,
      last_error
    `)
    .eq('name', SOURCE_NAME)
    .maybeSingle()

  if (sourceResult.error) {
    throw new Error(sourceResult.error.message)
  }

  const payoutSource = sourceResult.data

  if (!payoutSource) {
    throw new Error('Fuente de payouts no encontrada')
  }

  const [latestResult, firstStatsResult] =
    await Promise.all([

      supabase
        .from('payouts')
        .select(`
          id,
          amount,
          currency,
          payout_date,
          payment_method,
          verification_status,
          source_url,
          external_id
        `)
        .eq(
          'platform_id',
          payoutSource.platform_id
        )
        .order('payout_date', { ascending: false })
        .limit(25),

      supabase
        .from('payouts')
        .select('amount, payout_date', {
          count: 'exact',
        })
        .eq(
          'platform_id',
          payoutSource.platform_id
        )
        .order('payout_date', { ascending: true })
        .range(0, 999),
    ])

  if (latestResult.error) {
    throw new Error(latestResult.error.message)
  }

  if (firstStatsResult.error) {
    throw new Error(firstStatsResult.error.message)
  }

  const allPayouts = [...(firstStatsResult.data ?? [])]
  const totalPayouts = firstStatsResult.count ?? 0

  for (let offset = 1_000; offset < totalPayouts; offset += 1_000) {
    const { data, error } = await supabase
      .from('payouts')
      .select('amount, payout_date')
      .eq(
        'platform_id',
        payoutSource.platform_id
      )
      .order('payout_date', { ascending: true })
      .range(offset, offset + 999)

    if (error) {
      throw new Error(error.message)
    }

    allPayouts.push(...(data ?? []))
  }

  const amounts = allPayouts.map((payout) =>
    Number(payout.amount ?? 0)
  )
  const totalPaid = amounts.reduce(
    (total, amount) => total + amount,
    0
  )
  const averagePayout = totalPayouts > 0
    ? totalPaid / totalPayouts
    : 0
  const largestPayout = amounts.length > 0
    ? Math.max(...amounts)
    : 0
  const latestPayout = latestResult.data?.[0] ?? null
  const config = (
    payoutSource.config ?? {}
  ) as Record<string, unknown>
  const historyComplete =
    Boolean(config.history_complete)
  const historyPage = Number(config.history_page ?? 1)
  const liveStatus = !payoutSource.status
    ? 'Inactivo'
    : payoutSource.last_error
      ? 'Con error'
      : 'Activo'
  const liveStatusClasses = liveStatus === 'Activo'
    ? 'bg-green-100 text-green-700'
    : liveStatus === 'Con error'
      ? 'bg-red-100 text-red-700'
      : 'bg-slate-100 text-slate-600'

  const stats = [
    {
      label: 'Total de payouts',
      value: totalPayouts.toLocaleString('es-CO'),
    },
    {
      label: 'Total pagado',
      value: formatCurrency(totalPaid),
    },
    {
      label: 'Promedio',
      value: formatCurrency(averagePayout),
    },
    {
      label: 'Mayor payout',
      value: formatCurrency(largestPayout),
    },
    {
      label: 'Último payout',
      value: latestPayout
        ? formatDate(latestPayout.payout_date)
        : '—',
    },
  ]

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Monitoreo de payouts
          </h1>
          <p className="mt-1 text-slate-500">
            Seguimiento automático de pagos verificados en blockchain.
          </p>
        </div>

        <section className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-white p-6 shadow"
            >
              <p className="text-sm text-slate-500">
                {stat.label}
              </p>
              <p className="mt-2 text-2xl font-bold">
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        <section className="mb-8 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-slate-500">
              Estado LIVE
            </p>
            <span
              className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-medium ${liveStatusClasses}`}
            >
              {liveStatus}
            </span>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-slate-500">
              Estado HISTORY
            </p>
            <span
              className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                historyComplete
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {historyComplete ? 'Completo' : 'En progreso'}
            </span>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-slate-500">
              Página histórica actual
            </p>
            <p className="mt-2 text-2xl font-bold">
              {historyPage.toLocaleString('es-CO')}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-slate-500">
              Última sincronización
            </p>
            <p className="mt-2 font-semibold">
              {formatDate(payoutSource?.last_sync_at ?? null)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Último éxito: {formatDate(
                payoutSource?.last_success_at ?? null
              )}
            </p>
          </div>
        </section>

        <section className="mb-8 rounded-xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">
            Último error
          </h2>
          <p
            className={`mt-3 whitespace-pre-wrap text-sm ${
              payoutSource?.last_error
                ? 'text-red-700'
                : 'text-slate-500'
            }`}
          >
            {payoutSource?.last_error ||
              'No hay errores registrados.'}
          </p>
        </section>

        <section className="overflow-hidden rounded-xl bg-white shadow">
          <div className="border-b p-6">
            <h2 className="text-lg font-semibold">
              Últimos payouts
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Los 25 pagos más recientes detectados automáticamente.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    Fecha
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">
                    Monto
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    Método
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    Verificación
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    Transacción
                  </th>
                </tr>
              </thead>
              <tbody>
                {latestResult.data?.map((payout) => (
                  <tr
                    key={payout.id}
                    className="border-b last:border-0"
                  >
                    <td className="px-6 py-4 text-sm">
                      {formatDate(payout.payout_date)}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold">
                      {formatCurrency(Number(payout.amount))}
                    </td>
                    <td className="px-6 py-4">
                      {payout.payment_method || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                        {payout.verification_status || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {payout.source_url ? (
                        <a
                          href={payout.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-sm underline"
                        >
                          {payout.external_id?.slice(0, 10)}...
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}

                {(!latestResult.data ||
                  latestResult.data.length === 0) && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      No hay payouts registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}
