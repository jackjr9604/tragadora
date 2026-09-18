import Link from 'next/link'

export default function AdminDeniedPage() {
  return <main className="mx-auto max-w-2xl p-8"><div className="rounded-xl border bg-white p-8"><h1 className="text-2xl font-bold">Acceso denegado</h1><p className="mt-2 text-slate-600">No tienes permiso para abrir esta sección del administrador.</p><Link href="/" className="mt-6 inline-flex rounded-lg bg-black px-4 py-2 text-sm text-white">Volver al sitio</Link></div></main>
}
