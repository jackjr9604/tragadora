'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ServerCog } from 'lucide-react'

const LINKS = [
  { label: 'Resumen', href: '/admin/content-center', segment: '' },
  { label: 'Contenido', href: '/admin/content-center/content', segment: 'content' },
  { label: 'Traducciones', href: '/admin/content-center/translations', segment: 'translations' },
  { label: 'Revisión', href: '/admin/content-center/review', segment: 'review' },
  { label: 'Publicación', href: '/admin/content-center/publication', segment: 'publication' },
  { label: 'Trabajos', href: '/admin/content-center/jobs', segment: 'jobs' },
  { label: 'Idiomas', href: '/admin/content-center/languages', segment: 'languages' },
] as const

export function ContentCenterFrame({ children, ai, canManageContent }: { children: React.ReactNode; ai: { enabled: boolean; provider: string; message: string }; canManageContent: boolean }) {
  const pathname = usePathname()
  const active = pathname.slice('/admin/content-center'.length).split('/').filter(Boolean)[0] ?? ''
  return <main className="min-h-screen p-4 sm:p-8"><div className="mx-auto max-w-[1500px]">
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-700">Centro editorial</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Contenido e idiomas</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Edita contenido, administra traducciones y sigue el workflow editorial sin salir del Centro.</p></div>
      <div className={`max-w-md rounded-2xl border px-4 py-3 text-sm ${ai.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`}><div className="flex items-start gap-3"><ServerCog className="mt-0.5 size-5 shrink-0" /><div><p className="font-semibold">{ai.provider}</p><p className="mt-1 text-xs leading-5">{ai.message}</p></div></div></div>
    </header>
    <nav className="mt-7 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Centro de contenido">
      {LINKS.filter((link) => canManageContent || !['content','languages'].includes(link.segment)).map((link) => { const selected = active === link.segment; return <Link key={link.href} href={link.href} aria-current={selected ? 'page' : undefined} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${selected ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>{link.label}</Link> })}
    </nav>
    {children}
  </div></main>
}
