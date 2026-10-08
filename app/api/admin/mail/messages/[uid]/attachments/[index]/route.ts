import { authorizeMail, mailError } from '@/lib/mail-auth'
import { readAttachment } from '@/lib/mail-server'
import { validateAttachment } from '@/lib/mail-safety'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type AttachmentRouteContext = { params: Promise<{ uid: string; index: string }> }

export async function GET(request: Request, context: AttachmentRouteContext) {
  const denied = await authorizeMail('mail.view'); if (denied) return denied
  const { uid: rawUid, index: rawIndex } = await context.params
  const uid = Number(rawUid), index = Number(rawIndex), folder = new URL(request.url).searchParams.get('folder') || 'INBOX'
  if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(index) || index < 0) return Response.json({ success: false, error: 'Adjunto inválido.' }, { status: 400 })
  try {
    const attachment = await readAttachment(folder, uid, index)
    const validation = validateAttachment({ name: attachment.filename, size: attachment.size, type: attachment.contentType })
    if (validation) return Response.json({ success: false, error: validation }, { status: 415 })
    return new Response(new Uint8Array(attachment.content), { headers: { 'content-type': attachment.contentType, 'content-length': String(attachment.size), 'content-disposition': `attachment; filename="${attachment.filename.replace(/"/g, '')}"`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } })
  } catch (error) { return mailError(error) }
}
