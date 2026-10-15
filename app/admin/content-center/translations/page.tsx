import { ContentCenterBucketView } from '@/components/admin/content/ContentCenterBucketView'
import TranslationsPage from '@/app/admin/translations/page'
import { normalizeContentCenterParams } from '@/lib/admin-content-center-policy'

export default async function ContentCenterTranslationsPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const raw = await searchParams
  const bucket = normalizeContentCenterParams(raw).bucket
  if (bucket) return <ContentCenterBucketView searchParams={Promise.resolve(raw)} />
  return <TranslationsPage searchParams={Promise.resolve(raw)} showEditorialBuckets />
}
