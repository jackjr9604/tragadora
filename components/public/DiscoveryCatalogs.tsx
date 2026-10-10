'use client'

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { ArrowUpRight, MessageCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SearchInput } from '@/components/shared/SearchInput'
import type { BlogPost, Community } from '@/lib/discovery'
import { getPublicUi, publicLocale, publicPath } from '@/lib/public-i18n'
import type { PublicLanguage } from '@/lib/public-language'

export function CommunitiesCatalog({ items, language }: { items: Community[]; language: PublicLanguage }) {
  const t = getPublicUi(language), locale = publicLocale(language)
  const [query, setQuery] = useState(''), [type, setType] = useState('all')
  const types = [...new Set(items.map((item) => item.communityType))]
  const normalized = query.trim().toLocaleLowerCase(locale)
  const shown = items.filter((item) => type === 'all' || item.communityType === type).filter((item) => [item.name, item.shortDescription, item.category].some((value) => value?.toLocaleLowerCase(locale).includes(normalized)))
  const featured = items.filter((item) => item.isFeatured).slice(0, 4)
  return <><Featured title={t('communities.featured')} items={featured} language={language} /><div className="mt-8 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#111c2e] p-3 lg:flex-row"><SearchInput value={query} onChange={setQuery} placeholder={`${t('communities.search')}...`} theme="dark" className="flex-1" /><div className="flex flex-wrap gap-2">{['all', ...types].map((value) => <button type="button" key={value} onClick={() => setType(value)} className={chip(type === value)}>{value === 'all' ? t('common.all') : labelType(value, language)}</button>)}</div></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shown.map((item) => <CommunityCard key={item.id} item={item} language={language} />)}</div>{!shown.length && <Empty text={items.length ? t('communities.noResults') : t('communities.empty')} />}</>
}

function Featured({ title, items, language }: { title: string; items: Community[]; language: PublicLanguage }) {
  const t = getPublicUi(language)
  return items.length ? <section><p className="tg-eyebrow">{t('communities.editorialSelection')}</p><h2 className="mt-2 text-2xl font-bold">{title}</h2><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{items.map((item) => <CommunityCard key={item.id} item={item} language={language} />)}</div></section> : null
}

function CommunityCard({ item, language }: { item: Community; language: PublicLanguage }) {
  const t = getPublicUi(language)
  return <article className="flex min-h-72 flex-col rounded-2xl border border-white/10 bg-[#111c2e] p-5 transition hover:border-amber-300/30"><div className="flex items-start justify-between gap-3">{item.logoUrl ? <img src={item.logoUrl} alt={item.logoAlt || item.name} className="size-14 rounded-xl bg-white object-contain p-1" /> : <span className="flex size-14 items-center justify-center rounded-xl bg-white/5 text-amber-300"><MessageCircle /></span>}{item.badge && <span className="rounded-full border border-amber-300/20 px-2 py-1 text-[10px] uppercase text-amber-200">{item.badge}</span>}</div><h3 className="mt-4 text-xl font-bold">{item.name}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{item.shortDescription || t('communities.fallbackDescription')}</p><div className="mt-4 flex flex-wrap gap-2">{[labelType(item.communityType, language), item.languageCode?.toUpperCase(), item.category, item.regionLabel].filter(Boolean).map((value) => <span key={value} className="rounded-md bg-white/5 px-2 py-1 text-xs text-slate-300">{value}</span>)}</div><a href={item.joinUrl} target="_blank" rel="noopener noreferrer" className="tg-button-gold mt-auto pt-3">{t('communities.join')} <ArrowUpRight className="size-4" /></a></article>
}

export function BlogCatalog({ posts, language }: { posts: BlogPost[]; language: PublicLanguage }) {
  const t = getPublicUi(language), locale = publicLocale(language)
  const [query, setQuery] = useState(''), [category, setCategory] = useState('all')
  const categories = [...new Set(posts.map((post) => post.category).filter((value): value is string => Boolean(value)))]
  const featured = posts.find((post) => post.isFeatured)
  const shown = useMemo(() => posts.filter((post) => category === 'all' || post.category === category).filter((post) => [post.title, post.excerpt, post.category, ...post.tags].some((value) => value?.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale)))), [posts, query, category, locale])
  return <>{featured && <Link href={publicPath(`/blog/${featured.slug}`, language)} className="grid overflow-hidden rounded-3xl border border-amber-300/20 bg-[#111c2e] md:grid-cols-[1.1fr_.9fr]">{featured.coverUrl ? <img src={featured.coverUrl} alt={featured.coverAlt || featured.title} className="h-full min-h-64 w-full object-cover" /> : <div className="tradagora-pattern tradagora-pattern-gold min-h-64" />}<div className="flex flex-col justify-center p-6 sm:p-8"><p className="tg-eyebrow">{featured.category || t('blog.featured')}</p><h2 className="mt-3 text-3xl font-bold">{featured.title}</h2><p className="mt-3 leading-7 text-slate-400">{featured.excerpt}</p><span className="mt-5 inline-flex items-center gap-2 font-semibold text-amber-300">{t('common.readMore')} <ArrowUpRight className="size-4" /></span></div></Link>}<div className="mt-8 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#111c2e] p-3 lg:flex-row"><SearchInput value={query} onChange={setQuery} placeholder={`${t('blog.search')}...`} theme="dark" className="flex-1" /><div className="flex flex-wrap gap-2">{['all', ...categories].map((value) => <button type="button" key={value} onClick={() => setCategory(value)} className={chip(category === value)}>{value === 'all' ? t('common.all') : value}</button>)}</div></div><div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{shown.map((post) => <Link href={publicPath(`/blog/${post.slug}`, language)} key={post.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#111c2e] transition hover:border-amber-300/30">{post.coverUrl ? <img src={post.coverUrl} alt={post.coverAlt || post.title} className="h-44 w-full object-cover" /> : <div className="tradagora-pattern h-44" />}<div className="p-5"><p className="text-xs uppercase tracking-wider text-amber-300">{post.category || t('blog.article')}</p><h3 className="mt-2 text-xl font-bold">{post.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{post.excerpt}</p><p className="mt-4 text-xs text-slate-500">{formatDate(post.publishedAt, locale, t('blog.noDate'))}{post.authorName ? ` · ${post.authorName}` : ''}</p></div></Link>)}</div>{!shown.length && <Empty text={posts.length ? t('blog.noResults') : t('blog.empty')} />}</>
}

function chip(active: boolean) { return `rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition ${active ? 'border-amber-200/55 bg-[linear-gradient(110deg,#a97313,#e8bb49_55%,#f8d779)] text-slate-950' : 'border-white/10 bg-white/5 text-slate-300'}` }
function Empty({ text }: { text: string }) { return <div className="tg-empty mt-5 rounded-2xl p-10 text-center text-slate-400">{text}</div> }
function labelType(value: string, language: PublicLanguage) { const t = getPublicUi(language); return ({ discord: 'Discord', telegram: 'Telegram', whatsapp: 'WhatsApp', x: 'X', reddit: 'Reddit', forum: t('communities.type.forum'), other: t('communities.type.other') } as Record<string, string>)[value] ?? value }
function formatDate(value: string | null, locale: string, empty: string) { return value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value)) : empty }
