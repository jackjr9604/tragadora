import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()

  const { data: challenge } = await supabase
    .from('challenges')
    .select(`
      *,
      platforms (
        name
      )
    `)
    .eq('id', id)
    .single()

  if (!challenge) {
    notFound()
  }

  const { data: plans } = await supabase
    .from('account_plans')
    .select('*')
    .eq('challenge_id', id)
    .order('account_size')

  return (
    <main className="p-8">
      <div className="mb-8">
        <p className="text-sm text-slate-500">
          {challenge.platforms?.name}
        </p>

        <h1 className="text-3xl font-bold">
          {challenge.name}
        </h1>

        <p className="mt-1 text-slate-500">
          Gestiona las cuentas de este Challenge.
        </p>
      </div>

      <div className="mb-6 flex justify-end">
        <Link
          href={`/admin/challenges/${id}/plans/new`}
          className="rounded-lg bg-black px-5 py-3 text-white"
        >
          + Nueva cuenta
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow">
        <table className="w-full">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left">
                Cuenta
              </th>

              <th className="px-6 py-4 text-left">
                Precio
              </th>

              <th className="px-6 py-4 text-left">
                Profit Target
              </th>

              <th className="px-6 py-4 text-left">
                Daily DD
              </th>

              <th className="px-6 py-4 text-left">
                Max DD
              </th>

              <th className="px-6 py-4 text-left">
                Profit Split
              </th>
            </tr>
          </thead>

          <tbody>
            {plans?.map((plan) => (
              <tr
                key={plan.id}
                className="border-b last:border-0"
              >
                <td className="px-6 py-4 font-medium">
                  ${plan.account_size.toLocaleString()}
                </td>

                <td className="px-6 py-4">
                  {plan.price
                    ? `$${plan.price}`
                    : '—'}
                </td>

                <td className="px-6 py-4">
                  {plan.profit_target
                    ? `${plan.profit_target}%`
                    : '—'}
                </td>

                <td className="px-6 py-4">
                  {plan.daily_drawdown
                    ? `${plan.daily_drawdown}%`
                    : '—'}
                </td>

                <td className="px-6 py-4">
                  {plan.max_drawdown
                    ? `${plan.max_drawdown}%`
                    : '—'}
                </td>

                <td className="px-6 py-4">
                  {plan.profit_split
                    ? `${plan.profit_split}%`
                    : '—'}
                </td>
              </tr>
            ))}

            {(!plans || plans.length === 0) && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  No hay cuentas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
