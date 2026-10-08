import { NextResponse } from 'next/server'
import { authorizeMail, mailError } from '@/lib/mail-auth'
import { listMailFolders } from '@/lib/mail-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const denied = await authorizeMail('mail.view'); if (denied) return denied
  try { return NextResponse.json({ success: true, folders: await listMailFolders() }) } catch (error) { return mailError(error) }
}
