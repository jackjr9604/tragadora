import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { SafeMarkdown } from '@/components/public/SafeMarkdown'
import { getBlogPosts } from '@/lib/discovery'
import { resolvePublicLanguage } from '@/lib/language'
import { getPublicUi, publicLocale } from '@/lib/public-i18n'

export const revalidate = 60

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string | string[] }> }

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const language = await resolvePublicLanguage(query.lang)
  const post = (await getBlogPosts(language)).find((item) => item.slug === slug)
  return post ? { title: `${post.title} | Tradagora`, description: post.excerpt ?? undefined } : { title: 'Blog | Tradagora' }
}

export default async function Page({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const language = await resolvePublicLanguage(query.lang)
  const post = (await getBlogPosts(language)).find((item) => item.slug === slug)
  if (!post) notFound()

  const t = getPublicUi(language)
  const publishedAt = post.publishedAt
    ? new Intl.DateTimeFormat(publicLocale(language), { dateStyle: 'long' }).format(new Date(post.publishedAt))
    : null

  return <PublicPageShell language={language}>
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <p className="tg-eyebrow">{post.category || t('blog.article')}</p>
      <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">{post.title}</h1>
      {post.excerpt && <p className="mt-5 text-xl leading-8 text-slate-400">{post.excerpt}</p>}
      <p className="mt-5 text-sm text-slate-500">{post.authorName || 'Tradagora'}{publishedAt ? ` · ${publishedAt}` : ''}</p>
      {post.coverUrl && <img src={post.coverUrl} alt={post.coverAlt || post.title} className="mt-8 max-h-[500px] w-full rounded-2xl object-cover" />}
      <div className="mt-10"><SafeMarkdown source={post.bodyMarkdown} /></div>
    </article>
  </PublicPageShell>
}
