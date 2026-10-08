import 'server-only'

import { NextResponse } from 'next/server'
import { getCurrentAdminPermissions, hasPermission } from '@/lib/admin-permissions-server'
import type { PermissionKey } from '@/lib/admin-permissions'

export async function authorizeMail(permission: Extract<PermissionKey, `mail.${string}`>) {
  const access = await getCurrentAdminPermissions()
  if (!access.userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(access, permission)) return NextResponse.json({ success: false, error: 'No tienes permiso para esta operación.' }, { status: 403 })
  return null
}

export function mailError(error: unknown) {
  const code = error instanceof Error ? error.message : 'MAIL_UNKNOWN_ERROR'
  if (code.startsWith('MAIL_CONFIGURATION_MISSING:')) return NextResponse.json({ success: false, error: `Falta configurar ${code.split(':')[1]}.` }, { status: 503 })
  const known: Record<string, string> = {
    MAIL_FOLDER_NOT_FOUND: 'La carpeta ya no existe en el servidor.',
    MAIL_MESSAGE_NOT_FOUND: 'El mensaje ya no existe.',
    MAIL_MESSAGE_TOO_LARGE: 'El mensaje supera el límite de lectura permitido.',
    MAIL_ATTACHMENT_UNAVAILABLE: 'El adjunto no está disponible o el mensaje supera el límite permitido.',
    MAIL_ATTACHMENT_NOT_FOUND: 'No encontramos ese adjunto.',
    MAIL_DESTINATION_NOT_FOUND: 'La carpeta de destino no existe.',
  }
  return NextResponse.json({ success: false, error: known[code] ?? 'No fue posible conectar con el servidor de correo.' }, { status: known[code] ? 400 : 502 })
}
