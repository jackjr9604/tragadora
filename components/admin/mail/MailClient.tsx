'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Archive, ChevronLeft, ChevronRight, FileText, Forward, ImageIcon, Inbox, LoaderCircle, Mail, MailOpen, Paperclip, PenLine, RefreshCw, Reply, ReplyAll, Search, Send, ShieldAlert, Star, Trash2, X } from 'lucide-react'
import { mailDocument } from '@/lib/mail-document'

type Folder = { path: string; name: string; role: string; messages: number; unseen: number }
type Summary = { uid: number; subject: string; from: string; to: string; date: string | null; unread: boolean; flagged: boolean; attachments: number; size: number }
type Attachment = { index: number; filename: string; contentType: string; size: number }
type Message = Summary & { messageId: string | null; inReplyTo: string | null; references: string[]; cc: string; replyTo: string; text: string; html: string; htmlWithRemoteImages: string; attachments: Attachment[] }
type ListResponse = { folder: Folder; messages: Summary[]; page: number; pages: number; total: number }
type SourceAttachment = Attachment & { uid: number; folder: string }
type ComposeState = { to: string; cc: string; bcc: string; subject: string; text: string; inReplyTo: string; references: string[]; sourceAttachments: SourceAttachment[]; mode: 'new' | 'reply' | 'reply-all' | 'forward' }

const EMPTY_COMPOSE: ComposeState = { to: '', cc: '', bcc: '', subject: '', text: '', inReplyTo: '', references: [], sourceAttachments: [], mode: 'new' }

export function MailClient({ canSend, canManage }: { canSend: boolean; canManage: boolean }) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [folder, setFolder] = useState('INBOX')
  const [list, setList] = useState<ListResponse | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [selectedUid, setSelectedUid] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [listLoading, setListLoading] = useState(true)
  const [messageLoading, setMessageLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [compose, setCompose] = useState<ComposeState | null>(null)
  const requestId = useRef(0)

  const loadFolders = useCallback(async () => {
    const response = await fetch('/api/admin/mail/folders', { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || 'No se pudieron cargar las carpetas.')
    setFolders(body.folders)
    setFolder((current) => body.folders.some((item: Folder) => item.path === current) ? current : body.folders[0]?.path || 'INBOX')
  }, [])

  const loadMessages = useCallback(async (preserveSelection = true) => {
    setListLoading(true); setError('')
    try {
      const response = await fetch(`/api/admin/mail/messages?folder=${encodeURIComponent(folder)}&page=${page}&q=${encodeURIComponent(search)}`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'No se pudo cargar el correo.')
      setList(body)
      if (!preserveSelection || !body.messages.some((item: Summary) => item.uid === selectedUid)) { setSelectedUid(null); setMessage(null) }
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'No se pudo cargar el correo.') }
    finally { setListLoading(false) }
  }, [folder, page, search, selectedUid])

  // Synchronize the interactive client with the external IMAP server.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadFolders().catch((problem) => setError(problem instanceof Error ? problem.message : 'No se pudieron cargar las carpetas.')) }, [loadFolders])
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void loadMessages(false) }, [folder, page, search])

  async function openMessage(item: Summary) {
    const currentRequest = ++requestId.current
    setSelectedUid(item.uid); setCompose(null); setMessageLoading(true); setError('')
    try {
      const response = await fetch(`/api/admin/mail/messages/${item.uid}?folder=${encodeURIComponent(folder)}`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'No se pudo abrir el mensaje.')
      if (currentRequest !== requestId.current) return
      setMessage(body.message)
      if (item.unread && canManage) { await mutate(item.uid, 'read', undefined, false); updateLocalMessage(item.uid, { unread: false }) }
    } catch (problem) { if (currentRequest === requestId.current) setError(problem instanceof Error ? problem.message : 'No se pudo abrir el mensaje.') }
    finally { if (currentRequest === requestId.current) setMessageLoading(false) }
  }

  function updateLocalMessage(uid: number, patch: Partial<Pick<Summary, 'unread' | 'flagged'>>) {
    setList((current) => current ? { ...current, messages: current.messages.map((item) => item.uid === uid ? { ...item, ...patch } : item) } : current)
    setMessage((current) => current?.uid === uid ? { ...current, ...patch } : current)
  }

  async function mutate(uid: number, action: 'read' | 'unread' | 'flag' | 'unflag' | 'move', destination?: string, refresh = true) {
    setError('')
    const response = await fetch(`/api/admin/mail/messages/${uid}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ folder, action, destination }) })
    const body = await response.json()
    if (!response.ok) return setError(body.error || 'No se pudo actualizar el mensaje.')
    if (action === 'read' || action === 'unread') updateLocalMessage(uid, { unread: action === 'unread' })
    if (action === 'flag' || action === 'unflag') updateLocalMessage(uid, { flagged: action === 'flag' })
    if (refresh && action === 'move') { setSelectedUid(null); setMessage(null); setNotice('Mensaje movido.'); await Promise.all([loadMessages(false), loadFolders()]) }
    else if (refresh) { setNotice('Mensaje actualizado.'); void loadFolders() }
  }

  async function remove(uid: number) {
    if (!window.confirm('¿Mover este mensaje a la papelera?')) return
    setError('')
    const response = await fetch(`/api/admin/mail/messages/${uid}?folder=${encodeURIComponent(folder)}`, { method: 'DELETE' })
    const body = await response.json()
    if (!response.ok) return setError(body.error || 'No se pudo eliminar el mensaje.')
    setSelectedUid(null); setMessage(null); setNotice('Mensaje movido a la papelera.')
    await Promise.all([loadMessages(false), loadFolders()])
  }

  function changeFolder(next: string) { requestId.current += 1; setFolder(next); setPage(1); setSelectedUid(null); setMessage(null); setCompose(null); setNotice('') }
  const currentFolder = folders.find((item) => item.path === folder)

  return <main className="p-3 sm:p-6 lg:p-8"><div className="mx-auto max-w-[1720px]"><header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-amber-700">Comunicación</p><h1 className="text-3xl font-bold">Correo</h1><p className="mt-1 text-sm text-slate-500">contacto@tradagora.com · sincronización directa IMAP/SMTP</p></div><div className="flex gap-2">{canSend && <button type="button" onClick={() => { setCompose(EMPTY_COMPOSE); setSelectedUid(null) }} className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><PenLine className="size-4" /> Redactar</button>}<button type="button" onClick={() => { void loadFolders(); void loadMessages() }} disabled={listLoading} className="rounded-lg border bg-white p-2.5 hover:bg-slate-50 disabled:opacity-50" aria-label="Actualizar"><RefreshCw className={`size-4 ${listLoading ? 'animate-spin' : ''}`} /></button></div></header>
    {error && <Status tone="error" onClose={() => setError('')}>{error}</Status>}{notice && <Status tone="success" onClose={() => setNotice('')}>{notice}</Status>}
    <div className="grid min-h-[680px] overflow-hidden rounded-2xl border bg-white shadow-sm lg:h-[calc(100vh-220px)] lg:grid-cols-[220px_340px_minmax(0,1fr)] xl:grid-cols-[240px_390px_minmax(0,1fr)]">
      <aside className="border-b bg-slate-50 p-2.5 lg:overflow-y-auto lg:border-b-0 lg:border-r"><nav aria-label="Carpetas de correo" className="flex gap-2 overflow-x-auto lg:block lg:space-y-1">{folders.map((item) => <button key={item.path} type="button" onClick={() => changeFolder(item.path)} aria-current={folder === item.path ? 'page' : undefined} className={`flex min-w-fit cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition lg:w-full ${folder === item.path ? 'bg-slate-900 font-semibold text-white shadow-sm' : 'text-slate-700 hover:bg-white hover:shadow-sm'}`}><FolderIcon role={item.role} /><span className="flex-1 truncate">{folderLabel(item)}</span>{item.unseen > 0 && <span className={`rounded-full px-2 py-0.5 text-xs ${folder === item.path ? 'bg-amber-300 text-slate-950' : 'bg-amber-100 text-amber-800'}`}>{item.unseen}</span>}</button>)}</nav></aside>
      <section className={`${message || compose ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-r`}><form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(query) }} className="flex gap-2 border-b p-3"><label className="relative min-w-0 flex-1"><span className="sr-only">Buscar correo</span><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en esta carpeta" className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" /></label>{query && <button type="button" onClick={() => { setQuery(''); setSearch(''); setPage(1) }} className="rounded-lg border px-3 hover:bg-slate-50" aria-label="Limpiar búsqueda"><X className="size-4" /></button>}</form><div className="flex items-center justify-between border-b px-4 py-2 text-xs text-slate-500"><span>{currentFolder ? folderLabel(currentFolder) : 'Correo'} · {list?.total ?? 0}</span><span>Página {list?.page ?? 1} de {list?.pages ?? 1}</span></div>
        <div className="relative min-h-0 flex-1 overflow-y-auto" aria-busy={listLoading}>{listLoading && list && <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-amber-500" />}{listLoading && !list ? <Loading label="Conectando con el servidor…" /> : list?.messages.length ? list.messages.map((item) => <button key={item.uid} type="button" onClick={() => void openMessage(item)} aria-current={selectedUid === item.uid ? 'true' : undefined} className={`block w-full cursor-pointer border-b border-l-4 px-4 py-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500 ${selectedUid === item.uid ? 'border-l-amber-500 bg-amber-50 shadow-[inset_0_0_0_1px_rgba(245,158,11,.12)]' : item.unread ? 'border-l-blue-500 bg-blue-50/50 hover:bg-blue-50' : 'border-l-transparent hover:bg-slate-50'}`}><div className="flex items-center gap-2"><span className={`min-w-0 flex-1 truncate text-sm ${item.unread ? 'font-bold text-slate-950' : 'font-medium text-slate-700'}`}>{item.from || item.to || 'Sin remitente'}</span>{item.flagged && <Star className="size-3.5 fill-amber-400 text-amber-500" />}{item.attachments > 0 && <Paperclip className="size-3.5 text-slate-400" />}<time className="shrink-0 text-[11px] text-slate-400">{shortDate(item.date)}</time></div><p className={`mt-1 truncate text-sm ${item.unread ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{item.subject}</p><p className="mt-1 text-[11px] text-slate-400">{formatBytes(item.size)}</p></button>) : <p className="p-10 text-center text-sm text-slate-500">No hay mensajes en esta carpeta.</p>}</div>
        <div className="flex items-center justify-between border-t p-3"><button type="button" disabled={!list || page <= 1 || listLoading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border p-2 hover:bg-slate-50 disabled:opacity-30" aria-label="Página anterior"><ChevronLeft className="size-4" /></button><button type="button" disabled={!list || page >= list.pages || listLoading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border p-2 hover:bg-slate-50 disabled:opacity-30" aria-label="Página siguiente"><ChevronRight className="size-4" /></button></div></section>
      <section className={`${message || compose ? 'flex' : 'hidden lg:flex'} min-h-0 min-w-0 flex-col`}>{compose ? <ComposePanel initial={compose} onClose={() => setCompose(null)} onSent={async (draft) => { setCompose(null); setNotice(draft ? 'Borrador guardado.' : 'Mensaje enviado.'); await Promise.all([loadFolders(), loadMessages()]) }} /> : messageLoading ? <Loading label="Abriendo mensaje…" /> : message ? <MessageView key={`${folder}:${message.uid}`} message={message} folder={folder} folders={folders} canSend={canSend} canManage={canManage} onBack={() => { setSelectedUid(null); setMessage(null) }} onCompose={setCompose} onMutate={mutate} onDelete={remove} /> : <div className="flex h-full min-h-[500px] flex-col items-center justify-center p-8 text-center text-slate-400"><MailOpen className="size-12" /><p className="mt-3 font-medium text-slate-600">Selecciona un mensaje</p><p className="mt-1 text-sm">El contenido remoto permanece bloqueado por defecto.</p></div>}</section>
    </div></div></main>
}

function MessageView({ message, folder, folders, canSend, canManage, onBack, onCompose, onMutate, onDelete }: { message: Message; folder: string; folders: Folder[]; canSend: boolean; canManage: boolean; onBack: () => void; onCompose: (value: ComposeState) => void; onMutate: (uid: number, action: 'read' | 'unread' | 'flag' | 'unflag' | 'move', destination?: string) => Promise<void>; onDelete: (uid: number) => Promise<void> }) {
  const [showImages, setShowImages] = useState(false)
  const html = showImages ? message.htmlWithRemoteImages : message.html
  const actionClass = 'inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium transition hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500'
  return <div className="flex min-h-0 flex-1 flex-col"><header className="border-b p-4 sm:p-5"><button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 lg:hidden"><ChevronLeft className="size-4" /> Volver</button><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-xl font-bold leading-tight">{message.subject}</h2><p className="mt-3 break-words text-sm"><strong>De:</strong> {message.from}</p><p className="mt-1 break-words text-xs text-slate-500"><strong>Para:</strong> {message.to}{message.cc ? ` · CC: ${message.cc}` : ''}</p><p className="mt-1 text-xs text-slate-400">{longDate(message.date)}</p></div>{canManage && <div className="flex gap-2"><IconButton label={message.unread ? 'Marcar leído' : 'Marcar no leído'} onClick={() => void onMutate(message.uid, message.unread ? 'read' : 'unread')}>{message.unread ? <MailOpen className="size-4" /> : <Mail className="size-4" />}</IconButton><IconButton label={message.flagged ? 'Quitar destacado' : 'Destacar'} onClick={() => void onMutate(message.uid, message.flagged ? 'unflag' : 'flag')}><Star className={`size-4 ${message.flagged ? 'fill-amber-400 text-amber-500' : ''}`} /></IconButton><IconButton danger label="Eliminar" onClick={() => void onDelete(message.uid)}><Trash2 className="size-4" /></IconButton></div>}</div>{canSend && <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => onCompose(replyCompose(message, folder, false))} className={actionClass}><Reply className="size-4" /> Responder</button><button type="button" onClick={() => onCompose(replyCompose(message, folder, true))} className={actionClass}><ReplyAll className="size-4" /> Responder a todos</button><button type="button" onClick={() => onCompose(forwardCompose(message, folder))} className={actionClass}><Forward className="size-4" /> Reenviar</button></div>}</header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900"><span className="flex items-center gap-2"><ShieldAlert className="size-4 shrink-0" />{showImages ? 'Las imágenes remotas están visibles por decisión tuya.' : 'Las imágenes y recursos remotos están bloqueados.'}</span>{message.htmlWithRemoteImages !== message.html && <button type="button" onClick={() => setShowImages((value) => !value)} className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1.5 font-semibold hover:bg-amber-100"><ImageIcon className="size-3.5" />{showImages ? 'Ocultar imágenes' : 'Mostrar imágenes'}</button>}</div>{html ? <iframe title="Contenido aislado del correo" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={mailDocument(html, showImages)} className="h-[min(680px,70vh)] min-h-[420px] w-full rounded-xl border bg-white" /> : <pre className="whitespace-pre-wrap rounded-xl border bg-white p-5 font-sans text-sm leading-7 text-slate-800">{message.text}</pre>}{message.attachments.length > 0 && <div className="mt-6 border-t pt-4"><h3 className="text-sm font-semibold">Adjuntos ({message.attachments.length})</h3><div className="mt-3 flex flex-wrap gap-2">{message.attachments.map((attachment) => <a key={attachment.index} href={attachmentUrl(folder, message.uid, attachment.index)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:border-amber-300 hover:bg-amber-50"><Paperclip className="size-4" /><span>{attachment.filename}</span><span className="text-xs text-slate-400">{formatBytes(attachment.size)}</span></a>)}</div></div>}{canManage && <div className="mt-6 border-t pt-4"><label className="text-sm font-medium">Mover a <select defaultValue="" onChange={(event) => { if (event.target.value) void onMutate(message.uid, 'move', event.target.value) }} className="ml-2 rounded-lg border px-3 py-2"><option value="">Seleccionar carpeta</option>{folders.filter((item) => item.path !== folder).map((item) => <option key={item.path} value={item.path}>{folderLabel(item)}</option>)}</select></label></div>}</div></div>
}

function ComposePanel({ initial, onClose, onSent }: { initial: ComposeState; onClose: () => void; onSent: (draft: boolean) => Promise<void> }) {
  const [value, setValue] = useState(initial), [files, setFiles] = useState<File[]>([]), [saving, setSaving] = useState(false), [error, setError] = useState('')
  const totalSize = useMemo(() => files.reduce((total, file) => total + file.size, 0) + value.sourceAttachments.reduce((total, file) => total + file.size, 0), [files, value.sourceAttachments])
  const set = (key: 'to' | 'cc' | 'bcc' | 'subject' | 'text', next: string) => setValue((current) => ({ ...current, [key]: next }))
  async function submit(draft: boolean) {
    setSaving(true); setError('')
    try {
      const forwarded = await Promise.all(value.sourceAttachments.map(async (attachment) => { const response = await fetch(attachmentUrl(attachment.folder, attachment.uid, attachment.index)); if (!response.ok) throw new Error(`No se pudo adjuntar ${attachment.filename}.`); return new File([await response.blob()], attachment.filename, { type: attachment.contentType }) }))
      const form = new FormData(); form.set('to', value.to); form.set('cc', value.cc); form.set('bcc', value.bcc); form.set('subject', value.subject); form.set('text', value.text); form.set('draft', String(draft)); form.set('inReplyTo', value.inReplyTo); form.set('references', value.references.join(' ')); [...files, ...forwarded].forEach((file) => form.append('attachments', file))
      const response = await fetch('/api/admin/mail/send', { method: 'POST', body: form }); const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'No se pudo guardar el correo.')
      await onSent(draft)
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'No se pudo guardar el correo.'); setSaving(false) }
  }
  return <div className="flex min-h-0 flex-1 flex-col"><header className="flex items-center justify-between border-b px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">{composeLabel(value.mode)}</p><h2 className="text-lg font-semibold">{value.subject || 'Nuevo mensaje'}</h2></div><button type="button" onClick={onClose} className="rounded-lg border p-2 hover:bg-slate-50" aria-label="Cerrar compositor"><X className="size-4" /></button></header><div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5"><Input label="Para" value={value.to} onChange={(next) => set('to', next)} autoFocus /><div className="grid gap-3 sm:grid-cols-2"><Input label="CC" value={value.cc} onChange={(next) => set('cc', next)} /><Input label="CCO" value={value.bcc} onChange={(next) => set('bcc', next)} /></div><Input label="Asunto" value={value.subject} onChange={(next) => set('subject', next)} /><label className="block text-sm font-medium">Mensaje<textarea value={value.text} onChange={(event) => set('text', event.target.value)} className="mt-2 min-h-72 w-full resize-y rounded-lg border p-3 font-sans leading-6 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" /></label><label className="block text-sm font-medium">Adjuntos<input type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} className="mt-2 block w-full rounded-lg border p-2.5 text-sm" /></label>{value.sourceAttachments.length > 0 && <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><strong>Adjuntos del mensaje original:</strong> {value.sourceAttachments.map((item) => item.filename).join(', ')}</div>}{(files.length > 0 || value.sourceAttachments.length > 0) && <p className={`text-xs ${totalSize > 20 * 1024 * 1024 ? 'font-semibold text-red-600' : 'text-slate-500'}`}>{files.length + value.sourceAttachments.length} archivos · {formatBytes(totalSize)} de 20 MB máximo</p>}{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}</div><footer className="flex flex-wrap justify-end gap-2 border-t p-4"><button type="button" disabled={saving} onClick={() => void submit(true)} className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"><FileText className="mr-2 inline size-4" />Guardar borrador</button><button type="button" disabled={saving || totalSize > 20 * 1024 * 1024} onClick={() => void submit(false)} className="inline-flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{saving ? 'Procesando…' : 'Enviar'}</button></footer></div>
}

function Status({ tone, onClose, children }: { tone: 'error' | 'success'; onClose: () => void; children: ReactNode }) { return <div role={tone === 'error' ? 'alert' : 'status'} className={`mb-3 flex items-center justify-between rounded-lg px-4 py-3 text-sm ${tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}><span>{children}</span><button type="button" onClick={onClose} aria-label="Cerrar mensaje"><X className="size-4" /></button></div> }
function Loading({ label }: { label: string }) { return <div className="flex min-h-64 flex-1 flex-col items-center justify-center gap-3 p-8 text-sm text-slate-500"><LoaderCircle className="size-6 animate-spin text-amber-600" />{label}</div> }
function IconButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-lg border p-2 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${danger ? 'border-red-200 text-red-700' : ''}`} title={label} aria-label={label}>{children}</button> }
function Input({ label, value, onChange, autoFocus }: { label: string; value: string; onChange: (value: string) => void; autoFocus?: boolean }) { return <label className="block text-sm font-medium">{label}<input autoFocus={autoFocus} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2.5 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" /></label> }
function FolderIcon({ role }: { role: string }) { if (role === '\\Sent') return <Send className="size-4" />; if (role === '\\Drafts') return <FileText className="size-4" />; if (role === '\\Archive') return <Archive className="size-4" />; if (role === '\\Trash') return <Trash2 className="size-4" />; if (role === '\\Junk') return <ShieldAlert className="size-4" />; return <Inbox className="size-4" /> }
function folderLabel(folder: Folder) { return ({ '\\Inbox': 'Bandeja de entrada', '\\Sent': 'Enviados', '\\Drafts': 'Borradores', '\\Archive': 'Archivo', '\\Junk': 'Spam', '\\Trash': 'Papelera' } as Record<string, string>)[folder.role] ?? folder.name }
function shortDate(value: string | null) { if (!value) return ''; const date = new Date(value); return date.toDateString() === new Date().toDateString() ? date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) }
function longDate(value: string | null) { return value ? new Date(value).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }) : '' }
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB` }
function attachmentUrl(folder: string, uid: number, index: number) { return `/api/admin/mail/messages/${uid}/attachments/${index}?folder=${encodeURIComponent(folder)}` }
function composeLabel(mode: ComposeState['mode']) { return ({ new: 'Redactar', reply: 'Responder', 'reply-all': 'Responder a todos', forward: 'Reenviar' })[mode] }
function extractEmails(value: string) { return [...value.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((match) => match[0].toLocaleLowerCase('en-US')) }
function firstEmail(value: string) { return extractEmails(value)[0] ?? value.trim() }
function replyCompose(message: Message, folder: string, all: boolean): ComposeState { const replyTo = firstEmail(message.replyTo || message.from); const copied = all ? [...extractEmails(message.to), ...extractEmails(message.cc)].filter((email) => email !== 'contacto@tradagora.com' && email !== replyTo) : []; return { to: replyTo, cc: [...new Set(copied)].join(', '), bcc: '', subject: /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`, text: `\n\n--- Mensaje original ---\nDe: ${message.from}\nFecha: ${longDate(message.date)}\nAsunto: ${message.subject}\n\n${message.text}`, inReplyTo: message.messageId ?? '', references: [...message.references, ...(message.messageId ? [message.messageId] : [])], sourceAttachments: [], mode: all ? 'reply-all' : 'reply' } }
function forwardCompose(message: Message, folder: string): ComposeState { return { to: '', cc: '', bcc: '', subject: /^fwd:/i.test(message.subject) ? message.subject : `Fwd: ${message.subject}`, text: `\n\n--- Mensaje reenviado ---\nDe: ${message.from}\nPara: ${message.to}\nFecha: ${longDate(message.date)}\nAsunto: ${message.subject}\n\n${message.text}`, inReplyTo: '', references: [], sourceAttachments: message.attachments.map((attachment) => ({ ...attachment, uid: message.uid, folder })), mode: 'forward' } }
