import { NextResponse } from 'next/server'
import { authorizeMail, mailError } from '@/lib/mail-auth'
import { submitMessage } from '@/lib/mail-server'
import { MAX_TOTAL_ATTACHMENTS_BYTES, parseAddressList, safeAttachmentName, validateAttachment, validEmail } from '@/lib/mail-safety'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const denied = await authorizeMail('mail.send'); if (denied) return denied
  try {
    const form = await request.formData()
    const to = parseAddressList(text(form, 'to')), cc = parseAddressList(text(form, 'cc')), bcc = parseAddressList(text(form, 'bcc'))
    const draft = text(form, 'draft') === 'true'
    if (!draft && !to.length) return NextResponse.json({ success: false, error: 'Agrega al menos un destinatario.' }, { status: 400 })
    if (![...to, ...cc, ...bcc].every(validEmail)) return NextResponse.json({ success: false, error: 'Hay una dirección de correo inválida.' }, { status: 400 })
    const files = form.getAll('attachments').filter((value): value is File => value instanceof File && value.size > 0)
    const invalid = files.map((file) => validateAttachment(file)).find(Boolean)
    if (invalid) return NextResponse.json({ success: false, error: invalid }, { status: 415 })
    if (files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_ATTACHMENTS_BYTES) return NextResponse.json({ success: false, error: 'Los adjuntos superan el límite total de 20 MB.' }, { status: 413 })
    const attachments = await Promise.all(files.map(async (file) => ({ filename: safeAttachmentName(file.name), contentType: file.type || 'application/octet-stream', content: Buffer.from(await file.arrayBuffer()) })))
    const references = text(form, 'references').split(/\s+/).filter(Boolean)
    const result = await submitMessage({ to, cc, bcc, subject: text(form, 'subject').slice(0, 500), text: text(form, 'text').slice(0, 250_000), inReplyTo: text(form, 'inReplyTo') || undefined, references, attachments, draft })
    return NextResponse.json(result)
  } catch (error) { return mailError(error) }
}

function text(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}
