import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ChallengesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: challenges, error } = await supabase
    .from('challenges')
    .select(`
      id,
      name,
      slug,
      challenge_type,
      phases,
      status,
      platform_id,
      platforms (
        name
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (
    <main className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Challenges
          </h1>

          <p className="mt-1 text-slate-500">
            Gestiona los modelos de evaluación.
          </p>
        </div>

        <Link
          href="/admin/challenges/new"
          className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white"
        >
          + Nuevo Challenge
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
                Challenge
              </th>

              <th className="px-6 py-4 text-left">
                Tipo
              </th>

              <th className="px-6 py-4 text-left">
                Fases
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
            {challenges?.map((challenge) => (
              <tr
                key={challenge.id}
                className="border-b last:border-0"
              >
                <td className="px-6 py-4">
                  {challenge.platforms?.[0]?.name ?? '—'}
                </td>

                <td className="px-6 py-4 font-medium">
                  {challenge.name}
                </td>

                <td className="px-6 py-4">
                  {challenge.challenge_type ?? '—'}
                </td>

                <td className="px-6 py-4">
                  {challenge.phases ?? '—'}
                </td>

                <td className="px-6 py-4">
                  {challenge.status}
                </td>

                <td className="px-6 py-4">
                  <Link
                    href={`/admin/challenges/${challenge.id}`}
                    className="underline"
                  >
                    Gestionar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
