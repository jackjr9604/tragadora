import { ContentCenterBucketView } from '@/components/admin/content/ContentCenterBucketView'

export default function ReviewPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) { return <ContentCenterBucketView searchParams={searchParams} bucket="in_review" title="Revisión" description="Recursos con uno o más campos esperando revisión humana." /> }
