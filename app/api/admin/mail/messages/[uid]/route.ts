import { NextResponse } from 'next/server'
import { authorizeMail, mailError } from '@/lib/mail-auth'
import { readMessage, updateMessage } from '@/lib/mail-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type MessageRouteContext = { params: Promise<{ uid: string }> }

export async function GET(request: Request, context: MessageRouteContext) {
  const denied = await authorizeMail('mail.view'); if (denied) return denied
  const { uid: rawUid } = await context.params
  const uid = Number(rawUid), folder = new URL(request.url).searchParams.get('folder') || 'INBOX'
  if (!Number.isInteger(uid) || uid <= 0) return NextResponse.json({ success: false, error: 'Mensaje inválido.' }, { status: 400 })
  try { return NextResponse.json({ success: true, message: await readMessage(folder, uid) }) } catch (error) { return mailError(error) }
}

export async function PATCH(request: Request, context: MessageRouteContext) {
  const denied = await authorizeMail('mail.manage'); if (denied) return denied
  const { uid: rawUid } = await context.params
  const uid = Number(rawUid)
  const body = await request.json() as { folder?: string; action?: 'read' | 'unread' | 'flag' | 'unflag' | 'move'; destination?: string }
  if (!Number.isInteger(uid) || uid <= 0 || !body.folder || !body.action) return NextResponse.json({ success: false, error: 'Operación inválida.' }, { status: 400 })
  try { return NextResponse.json(await updateMessage({ folder: body.folder, uid, action: body.action, destination: body.destination })) } catch (error) { return mailError(error) }
}

export async function DELETE(request: Request, context: MessageRouteContext) {
  const denied = await authorizeMail('mail.manage'); if (denied) return denied
  const { uid: rawUid } = await context.params
  const uid = Number(rawUid), folder = new URL(request.url).searchParams.get('folder') || 'INBOX'
  if (!Number.isInteger(uid) || uid <= 0) return NextResponse.json({ success: false, error: 'Mensaje inválido.' }, { status: 400 })
  try { return NextResponse.json(await updateMessage({ folder, uid, action: 'delete' })) } catch (error) { return mailError(error) }
}
