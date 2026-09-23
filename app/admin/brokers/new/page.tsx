import { BrokerForm } from '@/components/admin/BrokerForm'
import { createClient } from '@/lib/supabase/server'

export default async function NewBrokerPage() {
  const db = await createClient()
  const [countries, tradingPlatforms] = await Promise.all([
    db.from('countries').select('code, name').order('name'),
    db.from('trading_platforms').select('id, name, status').order('name'),
  ])
  const error = countries.error ?? tradingPlatforms.error
  if (error) throw new Error(error.message)
  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-4xl"><div className="mb-8"><h1 className="text-3xl font-bold">Nuevo broker</h1><p className="mt-1 text-slate-500">Registra únicamente la información esencial y verificable.</p></div><BrokerForm countries={countries.data ?? []} tradingPlatforms={tradingPlatforms.data ?? []} /></div></main>
}
