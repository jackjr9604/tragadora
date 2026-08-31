import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PlatformsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: platforms, error } = await supabase
  .from('platforms')
  .select(`
    id,
    name,
    slug,
    type,
    status,
    score,
    logo_media_id,
    created_at,
    media:logo_media_id (
      id,
      file_url,
      alt_text
    )
  `)

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Plataformas
            </h1>

            <p className="mt-1 text-slate-500">
              Gestiona las plataformas de Tradagora.
            </p>
          </div>

          <div className="flex gap-3"><Link href="/admin/platforms/research" className="rounded-lg border bg-white px-5 py-3 text-sm font-medium">Banco de investigación</Link><Link
            href="/admin/platforms/new"
            className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            + Nueva Prop Firm
          </Link></div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow">
          <table className="w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold">
  Logo
</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">
                  Nombre
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold">
                  Tipo
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold">
                  Estado
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold">
                  Puntuación
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold">
                  Fecha
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold">
  Acciones
</th>
              </tr>
            </thead>

            <tbody>
              {platforms?.map((platform) => (
                <tr
                  key={platform.id}
                  className="border-b last:border-0"
                >
                  <td className="px-6 py-4">
  {platform.media?.[0] ? (
  <img
    src={platform.media[0].file_url}
    alt={
      platform.media[0].alt_text ||
      platform.name
    }
    className="h-10 w-10 rounded-lg object-contain"
  />
) : (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
      —
    </div>
  )}
</td>
                  <td className="px-6 py-4 font-medium">
                    {platform.name}
                  </td>

                  <td className="px-6 py-4">
                    {platform.type}
                  </td>

                  <td className="px-6 py-4">
                    {platform.status}
                  </td>

                  <td className="px-6 py-4">
                    {platform.score ?? '—'}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(
                      platform.created_at
                    ).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
  <Link
    href={`/admin/platforms/${platform.id}/edit`}
    className="text-sm font-medium underline"
  >
    Editar
  </Link>
</td>
                </tr>
              ))}

              {(!platforms || platforms.length === 0) && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Todavía no hay plataformas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
