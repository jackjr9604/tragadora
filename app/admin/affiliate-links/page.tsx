import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AffiliateLinksPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: links, error } = await supabase
    .from('affiliate_links')
    .select(`
      id,
      country_code,
      language,
      url,
      campaign,
      priority,
      status,
      created_at,
      platforms (
        name
      ),
      challenges (
        name
      )
    `)
    .order('priority', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (
    <main className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Enlaces de afiliados
          </h1>

          <p className="mt-1 text-slate-500">
            Gestiona los enlaces de referido de Tradagora.
          </p>
        </div>

        <Link
          href="/admin/affiliate-links/new"
          className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white"
        >
          + Nuevo enlace
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow">
        <table className="w-full">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm">
                Prop Firm
              </th>

              <th className="px-6 py-4 text-left text-sm">
                Challenge
              </th>

              <th className="px-6 py-4 text-left text-sm">
                País
              </th>

              <th className="px-6 py-4 text-left text-sm">
                Idioma
              </th>

              <th className="px-6 py-4 text-left text-sm">
                Campaña
              </th>

              <th className="px-6 py-4 text-left text-sm">
                Prioridad
              </th>

              <th className="px-6 py-4 text-left text-sm">
                Estado
              </th>
            </tr>
          </thead>

          <tbody>
            {links?.map((link) => (
              <tr
                key={link.id}
                className="border-b last:border-0"
              >
                <td className="px-6 py-4 font-medium">
                  {link.platforms?.[0]?.name ?? '—'}
                </td>

                <td className="px-6 py-4">
                  {link.challenges?.[0]?.name ?? 'Todos'}
                </td>

                <td className="px-6 py-4">
                  {link.country_code || 'Todos'}
                </td>

                <td className="px-6 py-4">
                  {link.language || 'Todos'}
                </td>

                <td className="px-6 py-4">
                  {link.campaign || '—'}
                </td>

                <td className="px-6 py-4">
                  {link.priority}
                </td>

                <td className="px-6 py-4">
                  {link.status ? 'Activo' : 'Inactivo'}
                </td>
              </tr>
            ))}

            {(!links || links.length === 0) && (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  No hay enlaces de afiliados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
