'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, ChevronLeft, ChevronRight, FileText, Forward, Inbox, Mail, MailOpen, Paperclip, PenLine, RefreshCw, Reply, ReplyAll, Search, Send, ShieldAlert, Star, Trash2, X } from 'lucide-react'

type Folder = { path: string; name: string; role: string; messages: number; unseen: number }
type Summary = { uid: number; subject: string; from: string; to: string; date: string | null; unread: boolean; flagged: boolean; attachments: number; size: number }
type Message = Summary & { messageId: string | null; inReplyTo: string | null; references: string[]; cc: string; replyTo: string; text: string; html: string; attachments: { index: number; filename: string; contentType: string; size: number }[] }
type ListResponse = { folder: Folder; messages: Summary[]; page: number; pages: number; total: number }
type ComposeState = { to: string; cc: string; bcc: string; subject: string; text: string; inReplyTo: string; references: string[] }

const EMPTY_COMPOSE: ComposeState = { to: '', cc: '', bcc: '', subject: '', text: '', inReplyTo: '', references: [] }

export function MailClient({ canSend, canManage }: { canSend: boolean; canManage: boolean }) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [folder, setFolder] = useState('INBOX')
  const [list, setList] = useState<ListResponse | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [compose, setCompose] = useState<ComposeState | null>(null)

  const loadFolders = useCallback(async () => {
    const response = await fetch('/api/admin/mail/folders', { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || 'No se pudieron cargar las carpetas.')
    setFolders(body.folders)
    if (!body.folders.some((item: Folder) => item.path === folder)) setFolder(body.folders[0]?.path || 'INBOX')
  }, [folder])

  const loadMessages = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/admin/mail/messages?folder=${encodeURIComponent(folder)}&page=${page}&q=${encodeURIComponent(search)}`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'No se pudo cargar el correo.')
      setList(body); setMessage(null)
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'No se pudo cargar el correo.') }
    setLoading(false)
  }, [folder, page, search])

  // These effects intentionally start synchronization with the external IMAP server.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadFolders().catch((problem) => setError(problem instanceof Error ? problem.message : 'No se pudieron cargar las carpetas.')) }, [loadFolders])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadMessages() }, [loadMessages])

  async function openMessage(item: Summary) {
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/admin/mail/messages/${item.uid}?folder=${encodeURIComponent(folder)}`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'No se pudo abrir el mensaje.')
      setMessage(body.message)
      if (item.unread && canManage) await mutate(item.uid, 'read', undefined, false)
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'No se pudo abrir el mensaje.') }
    setLoading(false)
  }

  async function mutate(uid: number, action: 'read' | 'unread' | 'flag' | 'unflag' | 'move', destination?: string, refresh = true) {
    const response = await fetch(`/api/admin/mail/messages/${uid}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ folder, action, destination }) })
    const body = await response.json()
    if (!response.ok) return setError(body.error || 'No se pudo actualizar el mensaje.')
    if (refresh) { await Promise.all([loadMessages(), loadFolders()]); setMessage(null) }
  }

  async function remove(uid: number) {
    if (!window.confirm('¿Mover este mensaje a la papelera?')) return
    const response = await fetch(`/api/admin/mail/messages/${uid}?folder=${encodeURIComponent(folder)}`, { method: 'DELETE' })
    const body = await response.json()
    if (!response.ok) return setError(body.error || 'No se pudo eliminar el mensaje.')
    await Promise.all([loadMessages(), loadFolders()]); setMessage(null)
  }

  const currentFolder = folders.find((item) => item.path === folder)
  return <main className="p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-[1600px]"><header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-amber-700">Comunicación</p><h1 className="text-3xl font-bold">Correo</h1><p className="mt-1 text-sm text-slate-500">contacto@tradagora.com · sincronización directa IMAP/SMTP</p></div><div className="flex gap-2">{canSend && <button type="button" onClick={() => setCompose(EMPTY_COMPOSE)} className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white"><PenLine className="size-4" /> Redactar</button>}<button type="button" onClick={() => { void loadFolders(); void loadMessages() }} className="rounded-lg border bg-white p-2.5" aria-label="Actualizar"><RefreshCw className="size-4" /></button></div></header>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="grid min-h-[680px] overflow-hidden rounded-2xl border bg-white shadow-sm lg:grid-cols-[240px_380px_minmax(0,1fr)]">
      <aside className="border-b bg-slate-50 p-3 lg:border-b-0 lg:border-r"><nav className="flex gap-2 overflow-x-auto lg:block lg:space-y-1">{folders.map((item) => <button key={item.path} type="button" onClick={() => { setFolder(item.path); setPage(1); setMessage(null) }} className={`flex min-w-fit items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm lg:w-full ${folder === item.path ? 'bg-slate-900 font-semibold text-white' : 'text-slate-700 hover:bg-white'}`}><FolderIcon role={item.role} /><span className="flex-1 truncate">{folderLabel(item)}</span>{item.unseen > 0 && <span className={`rounded-full px-2 py-0.5 text-xs ${folder === item.path ? 'bg-amber-300 text-slate-950' : 'bg-amber-100 text-amber-800'}`}>{item.unseen}</span>}</button>)}</nav></aside>
      <section className={`${message ? 'hidden lg:block' : 'block'} border-r`}><form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(query) }} className="flex gap-2 border-b p-3"><label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en esta carpeta" className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm" /></label>{query && <button type="button" onClick={() => { setQuery(''); setSearch(''); setPage(1) }} className="rounded-lg border px-3"><X className="size-4" /></button>}</form><div className="flex items-center justify-between border-b px-4 py-2 text-xs text-slate-500"><span>{currentFolder?.name || 'Correo'} · {list?.total ?? 0}</span><span>Página {list?.page ?? 1} de {list?.pages ?? 1}</span></div><div className="max-h-[590px] overflow-y-auto">{loading && !list ? <p className="p-8 text-center text-sm text-slate-500">Conectando…</p> : list?.messages.length ? list.messages.map((item) => <button key={item.uid} type="button" onClick={() => void openMessage(item)} className={`block w-full border-b px-4 py-3 text-left hover:bg-amber-50/50 ${item.unread ? 'bg-blue-50/50' : ''}`}><div className="flex items-center gap-2"><span className={`min-w-0 flex-1 truncate text-sm ${item.unread ? 'font-bold' : 'font-medium'}`}>{item.from || item.to || 'Sin remitente'}</span>{item.flagged && <Star className="size-3.5 fill-amber-400 text-amber-500" />}{item.attachments > 0 && <Paperclip className="size-3.5 text-slate-400" />}<time className="shrink-0 text-[11px] text-slate-400">{shortDate(item.date)}</time></div><p className={`mt-1 truncate text-sm ${item.unread ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{item.subject}</p><p className="mt-1 text-[11px] text-slate-400">{formatBytes(item.size)}</p></button>) : <p className="p-10 text-center text-sm text-slate-500">No hay mensajes en esta carpeta.</p>}</div><div className="flex items-center justify-between border-t p-3"><button type="button" disabled={!list || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border p-2 disabled:opacity-30"><ChevronLeft className="size-4" /></button><button type="button" disabled={!list || page >= list.pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronRight className="size-4" /></button></div></section>
      <section className={`${message ? 'block' : 'hidden lg:block'} min-w-0`}>{message ? <MessageView message={message} folder={folder} folders={folders} canSend={canSend} canManage={canManage} onBack={() => setMessage(null)} onCompose={setCompose} onMutate={mutate} onDelete={remove} /> : <div className="flex h-full min-h-[500px] flex-col items-center justify-center p-8 text-center text-slate-400"><MailOpen className="size-12" /><p className="mt-3 font-medium text-slate-600">Selecciona un mensaje</p><p className="mt-1 text-sm">El contenido remoto permanece bloqueado por defecto.</p></div>}</section>
    </div>
  </div>{compose && <ComposeModal initial={compose} onClose={() => setCompose(null)} onSent={async () => { setCompose(null); await Promise.all([loadFolders(), loadMessages()]) }} />}</main>
}

function MessageView({ message, folder, folders, canSend, canManage, onBack, onCompose, onMutate, onDelete }: { message: Message; folder: string; folders: Folder[]; canSend: boolean; canManage: boolean; onBack: () => void; onCompose: (value: ComposeState) => void; onMutate: (uid: number, action: 'read' | 'unread' | 'flag' | 'unflag' | 'move', destination?: string) => Promise<void>; onDelete: (uid: number) => Promise<void> }) {
  const replyAddress = message.replyTo || message.from
  const actionClass = 'inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50'
  return <div className="flex h-full flex-col"><header className="border-b p-4 sm:p-5"><button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 lg:hidden"><ChevronLeft className="size-4" /> Volver</button><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-xl font-bold">{message.subject}</h2><p className="mt-2 break-words text-sm"><strong>De:</strong> {message.from}</p><p className="mt-1 break-words text-xs text-slate-500"><strong>Para:</strong> {message.to}{message.cc ? ` · CC: ${message.cc}` : ''}</p><p className="mt-1 text-xs text-slate-400">{longDate(message.date)}</p></div>{canManage && <div className="flex gap-2"><button type="button" onClick={() => void onMutate(message.uid, message.unread ? 'read' : 'unread')} className="rounded-lg border p-2" title={message.unread ? 'Marcar leído' : 'Marcar no leído'}>{message.unread ? <MailOpen className="size-4" /> : <Mail className="size-4" />}</button><button type="button" onClick={() => void onMutate(message.uid, message.flagged ? 'unflag' : 'flag')} className="rounded-lg border p-2" title="Destacar"><Star className={`size-4 ${message.flagged ? 'fill-amber-400 text-amber-500' : ''}`} /></button><button type="button" onClick={() => void onDelete(message.uid)} className="rounded-lg border border-red-200 p-2 text-red-700" title="Eliminar"><Trash2 className="size-4" /></button></div>}</div>{canSend && <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => onCompose(replyCompose(message, replyAddress, false))} className={actionClass}><Reply className="size-4" /> Responder</button><button type="button" onClick={() => onCompose(replyCompose(message, replyAddress, true))} className={actionClass}><ReplyAll className="size-4" /> Responder a todos</button><button type="button" onClick={() => onCompose(forwardCompose(message))} className={actionClass}><Forward className="size-4" /> Reenviar</button></div>}</header><div className="flex-1 overflow-y-auto p-4 sm:p-6"><div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800"><ShieldAlert className="size-4 shrink-0" /> Las imágenes y recursos remotos están bloqueados.</div>{message.html ? <iframe title="Contenido del correo" sandbox="" srcDoc={message.html} className="min-h-[360px] w-full rounded-lg border bg-white" /> : <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-800">{message.text}</pre>}{message.attachments.length > 0 && <div className="mt-6 border-t pt-4"><h3 className="text-sm font-semibold">Adjuntos ({message.attachments.length})</h3><div className="mt-3 flex flex-wrap gap-2">{message.attachments.map((attachment) => <a key={attachment.index} href={`/api/admin/mail/messages/${message.uid}/attachments/${attachment.index}?folder=${encodeURIComponent(folder)}`} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Paperclip className="size-4" /><span>{attachment.filename}</span><span className="text-xs text-slate-400">{formatBytes(attachment.size)}</span></a>)}</div></div>}{canManage && <div className="mt-6 border-t pt-4"><label className="text-sm font-medium">Mover a <select defaultValue="" onChange={(event) => { if (event.target.value) void onMutate(message.uid, 'move', event.target.value) }} className="ml-2 rounded-lg border px-3 py-2"><option value="">Seleccionar carpeta</option>{folders.filter((item) => item.path !== folder).map((item) => <option key={item.path} value={item.path}>{folderLabel(item)}</option>)}</select></label></div>}</div></div>
}

function ComposeModal({ initial, onClose, onSent }: { initial: ComposeState; onClose: () => void; onSent: () => Promise<void> }) {
  const [value, setValue] = useState(initial), [files, setFiles] = useState<File[]>([]), [saving, setSaving] = useState(false), [error, setError] = useState('')
  const totalSize = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files])
  const set = (key: keyof ComposeState, next: string) => setValue((current) => ({ ...current, [key]: next }))
  async function submit(draft: boolean) {
    setSaving(true); setError('')
    const form = new FormData(); form.set('to', value.to); form.set('cc', value.cc); form.set('bcc', value.bcc); form.set('subject', value.subject); form.set('text', value.text); form.set('draft', String(draft)); form.set('inReplyTo', value.inReplyTo); form.set('references', value.references.join(' ')); files.forEach((file) => form.append('attachments', file))
    const response = await fetch('/api/admin/mail/send', { method: 'POST', body: form }); const body = await response.json()
    if (!response.ok) { setError(body.error || 'No se pudo guardar el correo.'); setSaving(false); return }
    await onSent(); setSaving(false)
  }
  return <div role="dialog" aria-modal="true" aria-label="Redactar correo" className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"><div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"><header className="flex items-center justify-between border-b px-5 py-4"><h2 className="text-lg font-semibold">Redactar correo</h2><button type="button" onClick={onClose} className="rounded-lg border p-2"><X className="size-4" /></button></header><div className="space-y-3 overflow-y-auto p-5"><Input label="Para" value={value.to} onChange={(next) => set('to', next)} /><div className="grid gap-3 sm:grid-cols-2"><Input label="CC" value={value.cc} onChange={(next) => set('cc', next)} /><Input label="CCO" value={value.bcc} onChange={(next) => set('bcc', next)} /></div><Input label="Asunto" value={value.subject} onChange={(next) => set('subject', next)} /><label className="block text-sm font-medium">Mensaje<textarea value={value.text} onChange={(event) => set('text', event.target.value)} className="mt-2 min-h-64 w-full rounded-lg border p-3 font-sans" /></label><label className="block text-sm font-medium">Adjuntos<input type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} className="mt-2 block w-full rounded-lg border p-2.5 text-sm" /></label>{files.length > 0 && <p className="text-xs text-slate-500">{files.length} archivos · {formatBytes(totalSize)} de 20 MB máximo</p>}{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}</div><footer className="flex flex-wrap justify-end gap-2 border-t p-4"><button type="button" disabled={saving} onClick={() => void submit(true)} className="rounded-lg border px-4 py-2.5 text-sm font-medium"><FileText className="mr-2 inline size-4" />Guardar borrador</button><button type="button" disabled={saving} onClick={() => void submit(false)} className="inline-flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white"><Send className="size-4" />{saving ? 'Procesando…' : 'Enviar'}</button></footer></div></div>
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-medium">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2.5" /></label> }
function FolderIcon({ role }: { role: string }) { if (role === '\\Sent') return <Send className="size-4" />; if (role === '\\Drafts') return <FileText className="size-4" />; if (role === '\\Archive') return <Archive className="size-4" />; if (role === '\\Trash') return <Trash2 className="size-4" />; if (role === '\\Junk') return <ShieldAlert className="size-4" />; return <Inbox className="size-4" /> }
function folderLabel(folder: Folder) { return ({ '\\Inbox': 'Bandeja de entrada', '\\Sent': 'Enviados', '\\Drafts': 'Borradores', '\\Archive': 'Archivo', '\\Junk': 'Spam', '\\Trash': 'Papelera' } as Record<string, string>)[folder.role] ?? folder.name }
function shortDate(value: string | null) { if (!value) return ''; const date = new Date(value); return date.toDateString() === new Date().toDateString() ? date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) }
function longDate(value: string | null) { return value ? new Date(value).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }) : '' }
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB` }
function replyCompose(message: Message, address: string, all: boolean): ComposeState { return { to: address, cc: all ? message.cc : '', bcc: '', subject: /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`, text: `\n\n--- Mensaje original ---\nDe: ${message.from}\nFecha: ${longDate(message.date)}\nAsunto: ${message.subject}\n\n${message.text}`, inReplyTo: message.messageId ?? '', references: [...message.references, ...(message.messageId ? [message.messageId] : [])] } }
function forwardCompose(message: Message): ComposeState { return { to: '', cc: '', bcc: '', subject: /^fwd:/i.test(message.subject) ? message.subject : `Fwd: ${message.subject}`, text: `\n\n--- Mensaje reenviado ---\nDe: ${message.from}\nPara: ${message.to}\nFecha: ${longDate(message.date)}\nAsunto: ${message.subject}\n\n${message.text}`, inReplyTo: '', references: [] } }
