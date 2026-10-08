import 'server-only'

export type MailConfig = ReturnType<typeof getMailConfig>

export function getMailConfig() {
  const user = required('MAIL_IMAP_USER')
  return {
    imap: {
      host: required('MAIL_IMAP_HOST'),
      port: numberValue('MAIL_IMAP_PORT', 993),
      secure: booleanValue('MAIL_IMAP_SECURE', true),
      auth: { user, pass: required('MAIL_IMAP_PASSWORD') },
    },
    smtp: {
      host: required('MAIL_SMTP_HOST'),
      port: numberValue('MAIL_SMTP_PORT', 465),
      secure: booleanValue('MAIL_SMTP_SECURE', true),
      auth: { user: process.env.MAIL_SMTP_USER || user, pass: required('MAIL_SMTP_PASSWORD') },
    },
    from: process.env.MAIL_FROM || user,
    appendSent: booleanValue('MAIL_APPEND_SENT', true),
    connectionTimeout: numberValue('MAIL_CONNECTION_TIMEOUT_MS', 15_000),
    socketTimeout: numberValue('MAIL_SOCKET_TIMEOUT_MS', 30_000),
  }
}

function required(key: string) {
  const value = process.env[key]?.trim()
  if (!value) throw new Error(`MAIL_CONFIGURATION_MISSING:${key}`)
  return value
}

function numberValue(key: string, fallback: number) {
  const value = Number(process.env[key] || fallback)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function booleanValue(key: string, fallback: boolean) {
  const value = process.env[key]
  if (value === undefined) return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLocaleLowerCase('en-US'))
}
