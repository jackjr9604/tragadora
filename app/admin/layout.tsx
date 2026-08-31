import Link from 'next/link'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed left-0 top-0 h-screen w-64 border-r bg-white p-5">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">
            Tragadora
          </h1>

          <p className="text-sm text-slate-500">
            Administración
          </p>
        </div>

        <nav className="space-y-1">
          <Link
            href="/admin"
            className="block rounded-lg px-3 py-2 hover:bg-slate-100"
          >
            Dashboard
          </Link>

          <Link
            href="/admin/platforms"
            className="block rounded-lg px-3 py-2 hover:bg-slate-100"
          >
            Prop Firms
          </Link>

          <Link
            href="/admin/challenges"
            className="block rounded-lg px-3 py-2 hover:bg-slate-100"
          >
            Challenges
          </Link>

          <Link
            href="/admin/platforms/research"
            className="block rounded-lg px-3 py-2 hover:bg-slate-100"
          >
            Investigación
          </Link>

          <Link
            href="/admin/payouts"
            className="block rounded-lg px-3 py-2 hover:bg-slate-100"
          >
            Pagos
          </Link>

          <Link
            href="/admin/offers"
            className="block rounded-lg px-3 py-2 hover:bg-slate-100"
          >
            Ofertas
          </Link>

          <Link
            href="/admin/affiliate-links"
            className="block rounded-lg px-3 py-2 hover:bg-slate-100"
          >
            Afiliados
          </Link>

          <Link
            href="/admin/content"
            className="block rounded-lg px-3 py-2 hover:bg-slate-100"
          >
            Contenido
          </Link>

          <Link
            href="/admin/media"
            className="block rounded-lg px-3 py-2 hover:bg-slate-100"
          >
            Multimedia
          </Link>
        </nav>
      </aside>

      <div className="ml-64">
        {children}
      </div>
    </div>
  )
}
