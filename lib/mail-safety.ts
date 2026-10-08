export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_TOTAL_ATTACHMENTS_BYTES = 20 * 1024 * 1024
export const MAX_MESSAGE_BYTES = 30 * 1024 * 1024

const BLOCKED_EXTENSIONS = new Set(['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'vbs', 'js', 'jar', 'hta', 'html', 'htm', 'svg'])

export function safeAttachmentName(value: string) {
  return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 180) || 'adjunto'
}

export function validateAttachment(file: { name: string; size: number; type?: string }) {
  if (file.size <= 0) return 'El archivo está vacío.'
  if (file.size > MAX_ATTACHMENT_BYTES) return 'El archivo supera el límite de 10 MB.'
  const extension = file.name.split('.').pop()?.toLocaleLowerCase('en-US') ?? ''
  if (BLOCKED_EXTENSIONS.has(extension)) return `El tipo .${extension} está bloqueado por seguridad.`
  return null
}

export function parseAddressList(value: string) {
  return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean)
}

export function validEmail(value: string) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)
}
