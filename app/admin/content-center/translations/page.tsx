import { ContentCenterBucketView } from '@/components/admin/content/ContentCenterBucketView'
import TranslationsPage from '@/app/admin/translations/page'
import { normalizeContentCenterParams } from '@/lib/admin-content-center-policy'
import { parseResourceKey } from '@/lib/admin-translation-inventory'
import { redirect } from 'next/navigation'

export default async function ContentCenterTranslationsPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const raw = await searchParams
  const selected = first(raw.selected)
  const legacyResource = parseResourceKey(selected)
  if (legacyResource) {
    const returnTo = listHref(raw)
    redirect(`/admin/content-center/translations/${legacyResource.resourceType}/${encodeURIComponent(legacyResource.resourceId)}?returnTo=${encodeURIComponent(returnTo)}`)
  }
  const bucket = normalizeContentCenterParams(raw).bucket
  if (bucket) return <ContentCenterBucketView searchParams={Promise.resolve(raw)} />
  return <TranslationsPage searchParams={Promise.resolve(raw)} showEditorialBuckets />
}

function first(value:string|string[]|undefined){return Array.isArray(value)?value[0]:value}
function listHref(raw:Record<string,string|string[]|undefined>){const params=new URLSearchParams();for(const[key,value]of Object.entries(raw)){const current=first(value);if(current&&key!=='selected')params.set(key,current)}const query=params.toString();return `/admin/content-center/translations${query?`?${query}`:''}`}
