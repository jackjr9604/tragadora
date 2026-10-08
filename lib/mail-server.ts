import 'server-only'

import { ImapFlow, type FetchMessageObject, type ListResponse, type MessageAddressObject, type MessageStructureObject, type SearchObject } from 'imapflow'
import { simpleParser } from 'mailparser'
import nodemailer from 'nodemailer'
import MailComposer from 'nodemailer/lib/mail-composer'
import sanitizeHtml from 'sanitize-html'
import { getMailConfig } from '@/lib/mail-config'
import { MAX_MESSAGE_BYTES, safeAttachmentName } from '@/lib/mail-safety'

export type MailFolder = { path: string; name: string; role: string; messages: number; unseen: number }
export type MailSummary = { uid: number; subject: string; from: string; to: string; date: string | null; unread: boolean; flagged: boolean; attachments: number; size: number }

export async function listMailFolders() {
  return withImap(async (client) => {
    const folders = await client.list({ statusQuery: { messages: true, unseen: true } })
    return folders.filter((folder) => folder.listed && !folder.flags.has('\\Noselect')).map(folderDto).sort(folderSort)
  })
}

export async function listMessages(folderPath: string, page: number, query: string, pageSize = 30) {
  return withImap(async (client) => {
    const folder = await requireFolder(client, folderPath)
    const lock = await client.getMailboxLock(folder.path)
    try {
      let total = folder.status?.messages ?? (client.mailbox ? client.mailbox.exists : 0)
      let range: string | number[] = ''
      let uidMode = false
      if (query.trim()) {
        const criteria: SearchObject = { or: [{ subject: query }, { from: query }, { to: query }, { body: query }] }
        const matches = await client.search(criteria, { uid: true })
        const uids = Array.isArray(matches) ? matches.sort((a, b) => b - a) : []
        total = uids.length
        range = uids.slice((page - 1) * pageSize, page * pageSize)
        uidMode = true
      } else if (total > 0) {
        const end = Math.max(1, total - (page - 1) * pageSize)
        const start = Math.max(1, end - pageSize + 1)
        range = `${start}:${end}`
      }

      const messages: MailSummary[] = []
      if ((Array.isArray(range) && range.length) || (typeof range === 'string' && range)) {
        for await (const message of client.fetch(range, { uid: true, envelope: true, flags: true, internalDate: true, bodyStructure: true, size: true }, { uid: uidMode })) messages.push(summaryDto(message))
      }
      messages.sort((a, b) => (Date.parse(b.date ?? '') || 0) - (Date.parse(a.date ?? '') || 0))
      return { folder: folderDto(folder), messages, page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) }
    } finally { lock.release() }
  })
}

export async function readMessage(folderPath: string, uid: number) {
  return withImap(async (client) => {
    const folder = await requireFolder(client, folderPath)
    const lock = await client.getMailboxLock(folder.path)
    try {
      const meta = await client.fetchOne(String(uid), { uid: true, envelope: true, flags: true, size: true }, { uid: true })
      if (!meta) throw new Error('MAIL_MESSAGE_NOT_FOUND')
      if ((meta.size ?? 0) > MAX_MESSAGE_BYTES) throw new Error('MAIL_MESSAGE_TOO_LARGE')
      const full = await client.fetchOne(String(uid), { source: true }, { uid: true })
      if (!full || !full.source) throw new Error('MAIL_MESSAGE_SOURCE_MISSING')
      const parsed = await simpleParser(full.source, { skipImageLinks: true, maxHtmlLengthToParse: MAX_MESSAGE_BYTES })
      return {
        ...summaryDto(meta),
        messageId: parsed.messageId ?? null,
        inReplyTo: parsed.inReplyTo ?? null,
        references: Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [],
        cc: addressText(parsed.cc),
        replyTo: addressText(parsed.replyTo),
        text: parsed.text ?? '',
        html: parsed.html ? sanitizeMailHtml(parsed.html) : '',
        attachments: parsed.attachments.map((attachment, index) => ({ index, filename: safeAttachmentName(attachment.filename || `adjunto-${index + 1}`), contentType: attachment.contentType, size: attachment.size, contentId: attachment.cid ?? null })),
      }
    } finally { lock.release() }
  })
}

export async function readAttachment(folderPath: string, uid: number, attachmentIndex: number) {
  return withImap(async (client) => {
    const folder = await requireFolder(client, folderPath)
    const lock = await client.getMailboxLock(folder.path)
    try {
      const message = await client.fetchOne(String(uid), { source: true, size: true }, { uid: true })
      if (!message || !message.source || (message.size ?? 0) > MAX_MESSAGE_BYTES) throw new Error('MAIL_ATTACHMENT_UNAVAILABLE')
      const parsed = await simpleParser(message.source, { skipImageLinks: true, maxHtmlLengthToParse: MAX_MESSAGE_BYTES })
      const attachment = parsed.attachments[attachmentIndex]
      if (!attachment) throw new Error('MAIL_ATTACHMENT_NOT_FOUND')
      return { filename: safeAttachmentName(attachment.filename || `adjunto-${attachmentIndex + 1}`), contentType: attachment.contentType || 'application/octet-stream', content: attachment.content, size: attachment.size }
    } finally { lock.release() }
  })
}

export async function updateMessage(input: { folder: string; uid: number; action: 'read' | 'unread' | 'flag' | 'unflag' | 'move' | 'delete'; destination?: string }) {
  return withImap(async (client) => {
    const folder = await requireFolder(client, input.folder)
    const folders = await client.list()
    const lock = await client.getMailboxLock(folder.path)
    try {
      if (input.action === 'read') await client.messageFlagsAdd([input.uid], ['\\Seen'], { uid: true })
      else if (input.action === 'unread') await client.messageFlagsRemove([input.uid], ['\\Seen'], { uid: true })
      else if (input.action === 'flag') await client.messageFlagsAdd([input.uid], ['\\Flagged'], { uid: true })
      else if (input.action === 'unflag') await client.messageFlagsRemove([input.uid], ['\\Flagged'], { uid: true })
      else if (input.action === 'move') {
        const destination = folders.find((item) => item.path === input.destination)
        if (!destination) throw new Error('MAIL_DESTINATION_NOT_FOUND')
        await client.messageMove([input.uid], destination.path, { uid: true })
      } else {
        const trash = folders.find((item) => item.specialUse === '\\Trash')
        if (trash && trash.path !== folder.path) await client.messageMove([input.uid], trash.path, { uid: true })
        else await client.messageDelete([input.uid], { uid: true })
      }
      return { success: true }
    } finally { lock.release() }
  })
}

export async function submitMessage(input: { to: string[]; cc: string[]; bcc: string[]; subject: string; text: string; inReplyTo?: string; references?: string[]; attachments: { filename: string; contentType: string; content: Buffer }[]; draft: boolean }) {
  const config = getMailConfig()
  const options = { from: config.from, to: input.to, cc: input.cc, bcc: input.bcc, subject: input.subject, text: input.text, inReplyTo: input.inReplyTo, references: input.references, attachments: input.attachments }
  const raw = await new MailComposer(options).compile().build()
  if (input.draft) {
    await appendSpecialUse('\\Drafts', raw, ['\\Draft'])
    return { success: true, draft: true }
  }
  const transporter = nodemailer.createTransport({ ...config.smtp, connectionTimeout: config.connectionTimeout, greetingTimeout: config.connectionTimeout, socketTimeout: config.socketTimeout, pool: true, maxConnections: 2, maxMessages: 20 })
  try { await transporter.sendMail({ envelope: { from: config.from, to: [...input.to, ...input.cc, ...input.bcc] }, raw }) } finally { transporter.close() }
  if (config.appendSent) await appendSpecialUse('\\Sent', raw, ['\\Seen'])
  return { success: true, draft: false }
}

async function appendSpecialUse(role: string, raw: Buffer, flags: string[]) {
  await withImap(async (client) => {
    const folders = await client.list()
    const folder = folders.find((item) => item.specialUse === role)
    if (!folder) throw new Error(`MAIL_SPECIAL_FOLDER_MISSING:${role}`)
    await client.append(folder.path, raw, flags, new Date())
  })
}

async function withImap<T>(callback: (client: ImapFlow) => Promise<T>) {
  const config = getMailConfig()
  const client = new ImapFlow({ ...config.imap, logger: false, connectionTimeout: config.connectionTimeout, greetingTimeout: config.connectionTimeout, socketTimeout: config.socketTimeout, disableAutoIdle: true })
  await client.connect()
  try { return await callback(client) } finally { await client.logout().catch(() => undefined) }
}

async function requireFolder(client: ImapFlow, path: string) {
  const folders = await client.list({ statusQuery: { messages: true, unseen: true } })
  const folder = folders.find((item) => item.path === path)
  if (!folder || folder.flags.has('\\Noselect')) throw new Error('MAIL_FOLDER_NOT_FOUND')
  return folder
}

function folderDto(folder: ListResponse): MailFolder {
  return { path: folder.path, name: folder.name, role: folder.specialUse ?? (folder.path.toLocaleUpperCase('en-US') === 'INBOX' ? '\\Inbox' : ''), messages: folder.status?.messages ?? 0, unseen: folder.status?.unseen ?? 0 }
}

function folderSort(a: MailFolder, b: MailFolder) {
  const order = ['\\Inbox', '\\Sent', '\\Drafts', '\\Archive', '\\Junk', '\\Trash']
  const ai = order.indexOf(a.role), bi = order.indexOf(b.role)
  return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.name.localeCompare(b.name)
}

function summaryDto(message: FetchMessageObject): MailSummary {
  return { uid: message.uid, subject: message.envelope?.subject || '(Sin asunto)', from: addresses(message.envelope?.from), to: addresses(message.envelope?.to), date: message.envelope?.date ? new Date(message.envelope.date).toISOString() : message.internalDate ? new Date(message.internalDate).toISOString() : null, unread: !(message.flags?.has('\\Seen') ?? false), flagged: message.flags?.has('\\Flagged') ?? false, attachments: countAttachments(message.bodyStructure), size: message.size ?? 0 }
}

function addresses(items?: MessageAddressObject[]) {
  return (items ?? []).map((item) => item.name ? `${item.name} <${item.address ?? ''}>` : item.address ?? '').filter(Boolean).join(', ')
}

function addressText(value?: { text: string } | { text: string }[]) {
  if (!value) return ''
  return Array.isArray(value) ? value.map((item) => item.text).join(', ') : value.text
}

function countAttachments(node?: MessageStructureObject): number {
  if (!node) return 0
  return (node.disposition?.toLocaleLowerCase('en-US') === 'attachment' ? 1 : 0) + (node.childNodes ?? []).reduce((total, child) => total + countAttachments(child), 0)
}

function sanitizeMailHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags
      .filter((tag) => tag !== 'img')
      .concat(['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td']),
    allowedAttributes: {
      a: ['href', 'title'],
      table: ['border', 'cellpadding', 'cellspacing'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform(
        'a',
        { target: '_blank', rel: 'noopener noreferrer' },
        true,
      ),
    },
    disallowedTagsMode: 'discard',
  })
}
