export type BlogSourceInput = {
  id?: string
  title: string
  slug: string
  excerpt: string | null
  bodyMarkdown: string
  category: string | null
  tags: string[]
  coverMediaId: string | null
  authorName: string | null
  featured: boolean
  status: 'draft' | 'published'
  publishedAt: string | null
}

export function isBlogSourceInput(value: unknown): value is BlogSourceInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const input = value as Record<string, unknown>
  return (input.id === undefined || isUuid(input.id))
    && boundedString(input.title, 300) && boundedString(input.slug, 200)
    && nullableBoundedString(input.excerpt, 4_000) && boundedString(input.bodyMarkdown, 750_000)
    && nullableBoundedString(input.category, 200) && nullableBoundedString(input.authorName, 200)
    && (input.coverMediaId === null || isUuid(input.coverMediaId))
    && Array.isArray(input.tags) && input.tags.length <= 50 && input.tags.every((tag) => boundedString(tag, 100))
    && typeof input.featured === 'boolean' && (input.status === 'draft' || input.status === 'published')
    && nullableBoundedString(input.publishedAt, 100)
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function isSafeBlogSlug(value: string) {
  return value.length > 0 && value.length <= 200 && !/[\s/?#\u0000-\u001f\u007f]/.test(value)
}

function boundedString(value: unknown, max: number): value is string { return typeof value === 'string' && value.length <= max }
function nullableBoundedString(value: unknown, max: number): value is string | null { return value === null || boundedString(value, max) }
