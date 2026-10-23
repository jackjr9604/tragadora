import type { PublicLanguageOption } from '@/lib/public-language'

export type SitemapPlatformRow = { slug: string | null; type: string | null }
export type SitemapSlugRow = { slug: string | null }

type SitemapQueryResult<Row> = {
  data: Row[] | null
  error: unknown
}

type SitemapWarning = (message: string) => void

const PLATFORM_PREFIXES: Record<string, string> = {
  prop_firm: 'prop-firms',
  broker: 'brokers',
  exchange: 'exchanges',
}

export const SITEMAP_QUERY_TIMEOUT_MS = 5_000

const FALLBACK_LANGUAGE: PublicLanguageOption = {
  code: 'es',
  name: 'Español',
  nativeName: 'Español',
  isDefault: true,
}

export async function resilientPublicSitemapData(options: {
  staticPaths: readonly string[]
  loadLanguages: () => Promise<PublicLanguageOption[]>
  loadDynamicPaths: () => Promise<string[]>
  warn?: SitemapWarning
}) {
  const warn = options.warn ?? ((message) => console.warn(message))
  const [languages, dynamicPaths] = await Promise.all([
    options.loadLanguages().catch(() => {
      warn('sitemap_languages_unavailable')
      return [FALLBACK_LANGUAGE]
    }),
    options.loadDynamicPaths().catch(() => {
      warn('sitemap_dynamic_sources_unavailable')
      return []
    }),
  ])
  const publishedLanguages = languages.length ? languages : [FALLBACK_LANGUAGE]
  const uniquePaths = [...new Set([...options.staticPaths, ...dynamicPaths])]
  return { paths: uniquePaths, languages: publishedLanguages }
}

export async function safeSitemapRows<Row>(
  source: string,
  load: (signal: AbortSignal) => PromiseLike<SitemapQueryResult<Row>>,
  options: { timeoutMs?: number; warn?: SitemapWarning } = {}
): Promise<Row[]> {
  const timeoutMs = options.timeoutMs ?? SITEMAP_QUERY_TIMEOUT_MS
  const warn = options.warn ?? ((message) => console.warn(message))

  try {
    const result = await load(AbortSignal.timeout(timeoutMs))
    if (result.error) {
      warn(`sitemap_source_failed:${source}`)
      return []
    }
    return result.data ?? []
  } catch {
    warn(`sitemap_source_failed:${source}`)
    return []
  }
}

export function dynamicPublicPathsFromRows(input: {
  platforms: SitemapPlatformRow[]
  posts: SitemapSlugRow[]
  tools: SitemapSlugRow[]
}) {
  const paths = new Set<string>()

  for (const platform of input.platforms) {
    const prefix = platform.type ? PLATFORM_PREFIXES[platform.type] : undefined
    if (!prefix || !validSlug(platform.slug)) continue
    paths.add(`/${prefix}/${platform.slug}`)
    if (platform.type === 'prop_firm') paths.add(`/payouts/${platform.slug}`)
  }
  for (const post of input.posts) {
    if (validSlug(post.slug)) paths.add(`/blog/${post.slug}`)
  }
  for (const tool of input.tools) {
    if (validSlug(tool.slug)) paths.add(`/calculadoras/${tool.slug}`)
  }

  return [...paths]
}

function validSlug(value: string | null): value is string {
  return Boolean(value?.trim() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
}
