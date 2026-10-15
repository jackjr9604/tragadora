import { ContentCenterBucketView } from '@/components/admin/content/ContentCenterBucketView'

export default function PublicationPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) { return <ContentCenterBucketView searchParams={searchParams} bucket="approved" title="Publicación" description="Recursos con traducciones aprobadas que aún requieren publicación humana." /> }
