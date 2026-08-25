import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PayoutSourceForm, {
  type PayoutSourceFormValue,
} from '../../PayoutSourceForm'

const SOURCE_TYPES = [
  'blockchain',
  'official_api',
  'provider',
  'public_page',
] as const

type SourceType = (typeof SOURCE_TYPES)[number]

function isSourceType(value: string): value is SourceType {
  return SOURCE_TYPES.some((type) => type === value)
}

export default async function EditPayoutSourcePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [platformsResult, sourceResult] = await Promise.all([
    supabase
      .from('platforms')
      .select('id, name')
      .eq('type', 'prop_firm')
      .order('name', { ascending: true }),
    supabase
      .from('payout_sources')
      .select(`
        id,
        platform_id,
        name,
        source_type,
        source_url,
        status,
        config
      `)
      .eq('id', id)
      .maybeSingle(),
  ])

  if (platformsResult.error) {
    throw new Error(platformsResult.error.message)
  }

  if (sourceResult.error) {
    throw new Error(sourceResult.error.message)
  }

  if (!sourceResult.data) {
    notFound()
  }

  if (!isSourceType(sourceResult.data.source_type)) {
    throw new Error(
      `Tipo de fuente no compatible: ${sourceResult.data.source_type}`
    )
  }

  const source: PayoutSourceFormValue = {
    id: sourceResult.data.id,
    platformId: sourceResult.data.platform_id,
    name: sourceResult.data.name,
    sourceType: sourceResult.data.source_type,
    sourceUrl: sourceResult.data.source_url ?? '',
    status: sourceResult.data.status,
    config: (
      sourceResult.data.config ?? {}
    ) as Record<string, unknown>,
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Editar fuente de payouts
          </h1>
          <p className="mt-1 text-slate-500">
            Modifica la configuración de {source.name}.
          </p>
        </div>

        <PayoutSourceForm
          platforms={platformsResult.data ?? []}
          source={source}
        />
      </div>
    </main>
  )
}
