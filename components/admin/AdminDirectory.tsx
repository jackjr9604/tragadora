import Link from 'next/link'
import type { ReactNode } from 'react'

export type AdminMedia = { file_url: string; alt_text: string | null }

export function AdminDirectoryHeader({ title, description, count, action }: { title: string; description: string; count: number; action?: ReactNode }) {
  return <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-bold">{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p><p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">{count.toLocaleString('es-CO')} resultados</p></div>{action}</header>
}

export function AdminFirmIdentity({ name, media, legacyUrl }: { name: string; media?: AdminMedia | AdminMedia[] | null; legacyUrl?: string | null }) {
  const resolved = Array.isArray(media) ? media[0] : media
  const url = resolved?.file_url ?? legacyUrl
  return <div className="flex min-w-0 items-center gap-3">{url ? <AdminLogo url={url} alt={resolved?.alt_text || name} /> : <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">{initials(name)}</span>}<span className="truncate font-medium">{name}</span></div>
}

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' }) {
  const style = tone === 'success' ? 'bg-emerald-50 text-emerald-700' : tone === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>{children}</span>
}

export function AdminPagination({ page, total, pageSize, href }: { page: number; total: number; pageSize: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return <nav aria-label="Paginación" className="mt-5 flex items-center justify-between rounded-xl border bg-white p-3 text-sm"><span className="text-slate-500">Página {page} de {pages}</span><div className="flex gap-2">{page > 1 && <Link href={href(page - 1)} className="rounded-lg border px-3 py-2">Anterior</Link>}{page < pages && <Link href={href(page + 1)} className="rounded-lg border px-3 py-2">Siguiente</Link>}</div></nav>
}

function AdminLogo({ url, alt }: { url: string; alt: string }) {
  // URLs administradas por Supabase Storage o fallback legacy.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="size-10 shrink-0 rounded-lg border bg-white object-contain p-1" />
}
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() }
