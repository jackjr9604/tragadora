import Link from 'next/link'
import { ArrowLeft, ArrowRight, ExternalLink, Languages, LockKeyhole, Search } from 'lucide-react'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { getTranslationDetail, getTranslationInventory, normalizeInventoryFilters, TRANSLATION_RESOURCES, type TranslationStateRow, type TranslationStatus } from '@/lib/admin-translation-inventory'
import { TranslationEditor } from '@/components/admin/translations/TranslationEditor'
import { publicAiEngineStatus } from '@/lib/admin-translation-ai'

type SearchParams = Record<string, string | string[] | undefined>
const STATUS: Record<TranslationStatus, { label: string; className: string }> = {
  missing: { label: 'Pendiente', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  queued: { label: 'En cola', className: 'bg-blue-50 text-blue-800 ring-blue-200' },
  machine_translated: { label: 'Traducción automática', className: 'bg-cyan-50 text-cyan-800 ring-cyan-200' },
  imported_unreviewed: { label: 'Importada sin revisar', className: 'bg-violet-50 text-violet-800 ring-violet-200' },
  reviewed: { label: 'Revisada', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  stale: { label: 'Desactualizada', className: 'bg-orange-50 text-orange-800 ring-orange-200' },
  error: { label: 'Error', className: 'bg-red-50 text-red-800 ring-red-200' },
}

export default async function TranslationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams
  const filters = normalizeInventoryFilters(raw)
  const access = await getCurrentAdminPermissions()
  const [inventory, detail] = await Promise.all([
    getTranslationInventory(filters, access.permissions),
    getTranslationDetail(filters.selected, access.permissions),
  ])
  const query = Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => typeof value === 'string' ? [[key, value]] : []))

  return <main className="min-h-screen p-4 sm:p-8">
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-amber-700">Contenido multilingüe</p><h1 className="mt-2 text-3xl font-bold">Traducciones</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Inventario y flujo editorial por campo para ES/EN/PT. La edición se habilita únicamente con el permiso de actualización del módulo.</p></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>{inventory.total.toLocaleString('es-CO')}</strong> resultados con los filtros actuales</div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Resumen de traducciones">
        <Summary label="Total" value={inventory.summary.total} /><Summary label="Pendientes" value={inventory.summary.pending} tone="amber" /><Summary label="Traducidas" value={inventory.summary.translated} tone="green" /><Summary label="Desactualizadas" value={inventory.summary.stale} tone="orange" /><Summary label="Errores" value={inventory.summary.errors} tone="red" /><Summary label="Protegidas" value={inventory.summary.protected} tone="blue" />
      </section>

      <form className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(240px,1fr)_repeat(4,minmax(130px,auto))_auto]" method="get">
        <label className="relative"><span className="sr-only">Buscar</span><Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" /><input name="q" defaultValue={filters.query} placeholder="Buscar UUID, módulo o campo" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm" /></label>
        <Select name="module" label="Módulo" value={filters.resourceType} options={inventory.resources.map((item) => ({ value: item.resource_type, label: TRANSLATION_RESOURCES[item.resource_type as keyof typeof TRANSLATION_RESOURCES]?.label ?? item.resource_type }))} />
        <Select name="language" label="Idioma" value={filters.language} options={inventory.languages.map((item) => ({ value: item.code, label: `${item.native_name} (${item.code.toUpperCase()})` }))} />
        <Select name="status" label="Estado" value={filters.status} options={Object.entries(STATUS).map(([value, item]) => ({ value, label: item.label }))} />
        <Select name="protection" label="Protección" value={filters.protection} options={[{ value: 'protected', label: 'Protegida' }, { value: 'unprotected', label: 'Sin proteger' }]} />
        <button className="admin-primary-button justify-center px-5 py-2.5 text-sm" type="submit">Aplicar</button>
      </form>

      <div className="mt-6 grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(560px,0.9fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Recurso</th><th className="px-4 py-3">Campo</th><th className="px-4 py-3">Idioma</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Actualizado</th><th className="px-4 py-3"><span className="sr-only">Detalle</span></th></tr></thead><tbody className="divide-y divide-slate-100">{inventory.rows.map((row) => <InventoryRow key={row.id} row={row} href={withQuery(query, { selected: row.id })} selected={detail?.state.id === row.id} />)}</tbody></table></div>
          {!inventory.rows.length && <div className="p-12 text-center"><Languages className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-semibold">No hay traducciones con estos filtros</p><p className="mt-1 text-sm text-slate-500">Prueba otro módulo, idioma o estado.</p></div>}
          <Pagination page={filters.page} pages={inventory.pages} query={query} />
        </section>
        <DetailPanel detail={detail} closeHref={withQuery(query, { selected: undefined })} aiStatus={publicAiEngineStatus()} />
      </div>
    </div>
  </main>
}

function InventoryRow({ row, href, selected }: { row: TranslationStateRow; href: string; selected: boolean }) {
  const status = STATUS[row.status]
  const resource = TRANSLATION_RESOURCES[row.resource_type]
  return <tr className={selected ? 'bg-amber-50/70' : 'hover:bg-slate-50'}><td className="px-4 py-4"><p className="font-semibold text-slate-900">{resource.label}</p><p className="mt-1 max-w-48 truncate font-mono text-[11px] text-slate-400" title={row.resource_id}>{row.resource_id}</p></td><td className="px-4 py-4"><span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">{row.field_name}</span>{row.is_protected && <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><LockKeyhole className="size-3" /> Manual</span>}</td><td className="px-4 py-4 font-semibold uppercase">{row.source_language} → {row.target_language}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${status.className}`}>{status.label}</span>{row.workflow_status && row.workflow_status !== 'none' && <span className="mt-1 block text-xs font-semibold text-violet-700">{workflowLabel(row.workflow_status)}</span>}{row.publication_status === 'published' && <span className="mt-1 block text-xs font-semibold text-emerald-700">Publicada</span>}</td><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{formatDate(row.updated_at)}</td><td className="px-4 py-4 text-right"><Link href={href} className="admin-secondary-button inline-flex px-3 py-2 text-xs">Ver</Link></td></tr>
}

function DetailPanel({ detail, closeHref, aiStatus }: { detail: Awaited<ReturnType<typeof getTranslationDetail>>; closeHref: string; aiStatus: ReturnType<typeof publicAiEngineStatus> }) {
  if (!detail) return <aside className="sticky top-24 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><Languages className="mx-auto size-8 text-slate-300" /><h2 className="mt-3 font-bold">Detalle del campo</h2><p className="mt-2 text-sm text-slate-500">Selecciona un registro para comparar el texto fuente y su traducción.</p></aside>
  const { state, source, translated, origin } = detail
  return <aside className="2xl:sticky 2xl:top-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">{TRANSLATION_RESOURCES[state.resource_type].label}</p><h2 className="mt-1 text-xl font-bold">{origin.label}</h2></div><Link href={closeHref} className="text-sm text-slate-500 hover:text-black">Cerrar</Link></div><div className="mt-4 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STATUS[state.status].className}`}>{STATUS[state.status].label}</span>{state.workflow_status && state.workflow_status !== 'none' && <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 ring-1 ring-violet-200">{workflowLabel(state.workflow_status)}</span>}{state.publication_status === 'published' && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">Publicada</span>}{state.is_protected && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-200"><LockKeyhole className="size-3" /> Protegida</span>}</div></div><div className="space-y-5 p-5"><TranslationEditor key={`${state.id}:${state.lock_version ?? 0}`} stateId={state.id} sourceLanguage={state.source_language} targetLanguage={state.target_language} source={source} translated={translated} draftValue={state.draft_value} workflowStatus={state.workflow_status ?? 'none'} publicationStatus={state.publication_status ?? 'unpublished'} lockVersion={state.lock_version ?? 1} valueKind={detail.valueKind} maxCharacters={detail.maxCharacters} canEdit={detail.canEdit} workflowAvailable={detail.workflowAvailable} sourceChanged={Boolean(state.draft_source_hash && state.draft_source_hash !== state.source_hash)} isProtected={state.is_protected} aiEnabled={aiStatus.enabled} aiProvider={aiStatus.provider} aiMessage={aiStatus.message} /><dl className="grid grid-cols-2 gap-3 text-xs"><Meta label="Campo" value={state.field_name} /><Meta label="Procedencia" value={[state.translation_method, state.provider].filter(Boolean).join(' · ') || 'Sin procedencia'} /><Meta label="Actualizado" value={formatDate(state.updated_at)} /><Meta label="Revisado" value={state.reviewed_at ? formatDate(state.reviewed_at) : 'No'} /></dl>{state.last_error && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-800"><strong>{state.last_error_code || 'Error'}:</strong> {state.last_error}</div>}<Link href={origin.href} className="admin-secondary-button flex w-full justify-center gap-2 px-4 py-2.5 text-sm">Abrir contenido de origen <ExternalLink className="size-4" /></Link></div></aside>
}

function Summary({ label, value, tone = 'slate' }: { label: string; value: number; tone?: string }) { const tones: Record<string, string> = { slate: 'border-slate-200', amber: 'border-amber-200', green: 'border-emerald-200', orange: 'border-orange-200', red: 'border-red-200', blue: 'border-blue-200' }; return <div className={`rounded-xl border bg-white p-4 shadow-sm ${tones[tone]}`}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value.toLocaleString('es-CO')}</p></div> }
function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: { value: string; label: string }[] }) { return <label><span className="sr-only">{label}</span><select name={name} defaultValue={value ?? ''} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"><option value="">{label}: todos</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> }
function Meta({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-3"><dt className="font-semibold text-slate-500">{label}</dt><dd className="mt-1 break-words text-slate-900">{value}</dd></div> }
function Pagination({ page, pages, query }: { page: number; pages: number; query: Record<string, string> }) { if (pages <= 1) return null; return <nav className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm" aria-label="Paginación"><Link aria-disabled={page <= 1} href={page > 1 ? withQuery(query, { page: String(page - 1), selected: undefined }) : '#'} className={`admin-secondary-button gap-1 px-3 py-2 ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}><ArrowLeft className="size-4" /> Anterior</Link><span className="text-slate-500">Página {page} de {pages}</span><Link aria-disabled={page >= pages} href={page < pages ? withQuery(query, { page: String(page + 1), selected: undefined }) : '#'} className={`admin-secondary-button gap-1 px-3 py-2 ${page >= pages ? 'pointer-events-none opacity-40' : ''}`}>Siguiente <ArrowRight className="size-4" /></Link></nav> }
function withQuery(current: Record<string, string>, changes: Record<string, string | undefined>) { const params = new URLSearchParams(current); for (const [key, value] of Object.entries(changes)) { if (value) params.set(key, value); else params.delete(key) } const result = params.toString(); return `/admin/translations${result ? `?${result}` : ''}` }
function formatDate(value: string) { return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function workflowLabel(status: string) { return status === 'draft' ? 'Borrador' : status === 'in_review' ? 'En revisión' : status === 'approved' ? 'Aprobada' : status }
