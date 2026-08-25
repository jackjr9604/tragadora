import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PayoutSourceForm from '../PayoutSourceForm'

export default async function NewPayoutSourcePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: platforms, error } = await supabase
    .from('platforms')
    .select('id, name')
    .eq('type', 'prop_firm')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Nueva fuente de payouts
          </h1>
          <p className="mt-1 text-slate-500">
            Configura una fuente automática para una Prop Firm.
          </p>
        </div>

        {platforms && platforms.length > 0 ? (
          <PayoutSourceForm platforms={platforms} />
        ) : (
          <div className="rounded-xl bg-white p-8 text-slate-600 shadow">
            Primero debes registrar una plataforma de tipo Prop Firm.
          </div>
        )}
      </div>
    </main>
  )
}
