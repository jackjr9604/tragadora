import Link from 'next/link'

const links = [
  ['Dashboard', '/admin'], ['Prop Firms', '/admin/platforms'], ['Challenges', '/admin/challenges'],
  ['Investigación', '/admin/platforms/research'], ['Pagos', '/admin/payouts'], ['Ofertas', '/admin/offers'],
  ['Afiliados', '/admin/affiliate-links'], ['Contenido', '/admin/content'], ['Multimedia', '/admin/media'],
] as const

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-100 text-slate-950">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-white p-5 lg:block"><AdminBrand /><AdminLinks /></aside>
    <header className="sticky top-0 z-40 border-b bg-white lg:hidden"><div className="flex items-center justify-between px-4 py-3"><AdminBrand compact /><Link href="/" className="rounded-lg border px-3 py-2 text-xs font-medium">Ver sitio</Link></div><nav className="flex gap-1 overflow-x-auto border-t px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Administración móvil">{links.map(([label, href]) => <Link key={href} href={href} className="shrink-0 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-black">{label}</Link>)}</nav></header>
    <div className="lg:ml-64">{children}</div>
  </div>
}

function AdminBrand({ compact = false }: { compact?: boolean }) { return <div className={compact ? '' : 'mb-8'}><p className={`${compact ? 'text-lg' : 'text-2xl'} font-bold`}>Tradagora</p><p className="text-xs text-slate-500">Administración</p></div> }
function AdminLinks() { return <nav className="space-y-1" aria-label="Administración">{links.map(([label, href]) => <Link key={href} href={href} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-black">{label}</Link>)}</nav> }
