import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'

const MAX_SOURCE_PAGE_LENGTH = 500
const MAX_USER_AGENT_LENGTH = 300
const MIN_TRACKING_SECRET_BYTES = 32

export const AFFILIATE_CLICK_DEDUP_MINUTES = 30
export const AFFILIATE_CLICK_RATE_LIMIT_PER_HOUR = 60

export function affiliateVisitorHash(
  request: Request,
  secret: string | undefined,
  now = new Date(),
  trustVercelHeaders = process.env.VERCEL === '1'
) {
  const ip = trustedProxyIp(request.headers, trustVercelHeaders)
  const key = secret?.trim()
  if (!ip || !key || Buffer.byteLength(key, 'utf8') < MIN_TRACKING_SECRET_BYTES) return null
  const userAgent = sanitizeHeader(request.headers.get('user-agent'), MAX_USER_AGENT_LENGTH)
  const dailyBucket = now.toISOString().slice(0, 10)
  return createHmac('sha256', key)
    .update(`${dailyBucket}\n${ip}\n${userAgent ?? ''}`)
    .digest('hex')
}

export function trustedProxyIp(headers: Headers, trustVercelHeaders = process.env.VERCEL === '1') {
  if (!trustVercelHeaders) return null
  const candidates = [
    headers.get('x-vercel-forwarded-for'),
    headers.get('x-forwarded-for'),
    headers.get('x-real-ip'),
  ]
  for (const candidate of candidates) {
    const value = candidate?.split(',')[0]?.trim()
    if (value && isIP(value)) return value
  }
  return null
}

export function sanitizeAffiliateCountry(value: string | null) {
  const candidate = value?.trim().toUpperCase()
  return candidate && /^[A-Z]{2}$/.test(candidate) ? candidate : null
}

export function sanitizeAffiliateSourcePage(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    const sanitized = `${url.origin}${url.pathname}`
    return sanitized.length <= MAX_SOURCE_PAGE_LENGTH
      ? sanitized
      : sanitized.slice(0, MAX_SOURCE_PAGE_LENGTH)
  } catch {
    return null
  }
}

function sanitizeHeader(value: string | null, maxLength: number) {
  if (!value) return null
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength) || null
}
