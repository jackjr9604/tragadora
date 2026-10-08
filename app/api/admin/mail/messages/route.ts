import { NextResponse } from 'next/server'
import { authorizeMail, mailError } from '@/lib/mail-auth'
import { listMessages } from '@/lib/mail-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await authorizeMail('mail.view'); if (denied) return denied
  const url = new URL(request.url)
  const folder = url.searchParams.get('folder') || 'INBOX'
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const query = (url.searchParams.get('q') || '').slice(0, 200)
  try { return NextResponse.json({ success: true, ...await listMessages(folder, page, query) }) } catch (error) { return mailError(error) }
}
