'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Media = {
  id: string
  file_name: string
  file_url: string
  alt_text: string | null
}

type Country = { code: string; name: string }
type RelatedItem = { id: string; name?: string; title?: string; source_type?: string; status?: string | boolean; config?: Record<string, unknown> | null; challenge_type?: string | null }

export default function EditPlatformPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const id = params.id as string

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [logoMediaId, setLogoMediaId] = useState('')
const [media, setMedia] = useState<Media[]>([])

  const [profitSplitMin, setProfitSplitMin] = useState('')
  const [profitSplitMax, setProfitSplitMax] = useState('')

  const [supportsEa, setSupportsEa] = useState(false)
  const [allowsNews, setAllowsNews] = useState(false)
  const [allowsWeekend, setAllowsWeekend] = useState(false)

  const [status, setStatus] = useState('active')
  const [score, setScore] = useState('')
  const [countries, setCountries] = useState<Country[]>([])
  const [availabilityCodes, setAvailabilityCodes] = useState<string[]>([])
  const [initialAvailabilityCodes, setInitialAvailabilityCodes] = useState<string[]>([])
  const [payoutSources, setPayoutSources] = useState<RelatedItem[]>([])
  const [challenges, setChallenges] = useState<RelatedItem[]>([])
  const [offers, setOffers] = useState<RelatedItem[]>([])
  const [affiliateLinks, setAffiliateLinks] = useState<RelatedItem[]>([])
  const [payoutSummary, setPayoutSummary] = useState({ count: 0, total: 0, latest: '' })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPlatform() {
      const { data: platform, error } = await supabase
        .from('platforms')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !platform) {
        setError('No se pudo cargar la Prop Firm.')
        setLoading(false)
        return
      }

      setName(platform.name)
      setSlug(platform.slug)
      setWebsiteUrl(platform.website_url ?? '')
      setStatus(platform.status)
      setLogoMediaId(platform.logo_media_id ?? '')
      setScore(platform.score?.toString() ?? '')

      const { data: details } = await supabase
        .from('prop_firm_details')
        .select('*')
        .eq('platform_id', id)
        .single()

      if (details) {
        setProfitSplitMin(
          details.profit_split_min?.toString() ?? ''
        )

        setProfitSplitMax(
          details.profit_split_max?.toString() ?? ''
        )

        setSupportsEa(details.supports_ea)
        setAllowsNews(details.allows_news_trading)
        setAllowsWeekend(details.allows_weekend_holding)
      }

      const { data: translation } = await supabase
        .from('platform_translations')
        .select('*')
        .eq('platform_id', id)
        .eq('language', 'es')
        .single()

      if (translation) {
        setDescription(
          translation.short_description ?? ''
        )
      }

const { data: mediaData } = await supabase
  .from('media')
  .select(`
    id,
    file_name,
    file_url,
    alt_text
  `)
  .order('created_at', { ascending: false })

setMedia(mediaData ?? [])

      const [countriesResult, availabilityResult, sourcesResult, payoutsResult, challengesResult, offersResult, linksResult] = await Promise.all([
        supabase.from('countries').select('code, name').order('name'),
        supabase.from('platform_availability').select('country_code, status').eq('platform_id', id),
        supabase.from('payout_sources').select('id, name, source_type, status, config').eq('platform_id', id),
        supabase.from('payouts').select('amount, payout_date', { count: 'exact' }).eq('platform_id', id).order('payout_date', { ascending: false }).range(0, 999),
        supabase.from('challenges').select('id, name, challenge_type, status').eq('platform_id', id).order('name'),
        supabase.from('offers').select('id, title, status').eq('platform_id', id).order('created_at', { ascending: false }),
        supabase.from('affiliate_links').select('id, status').eq('platform_id', id),
      ])
      setCountries(countriesResult.data ?? [])
      const codes = (availabilityResult.data ?? []).filter((item) => item.status === 'active' || item.status === true).map((item) => item.country_code)
      setAvailabilityCodes(codes); setInitialAvailabilityCodes(codes)
      setPayoutSources(sourcesResult.data ?? [])
      setChallenges(challengesResult.data ?? [])
      setOffers(offersResult.data ?? [])
      setAffiliateLinks(linksResult.data ?? [])
      const payoutRows = payoutsResult.data ?? []
      setPayoutSummary({ count: payoutsResult.count ?? payoutRows.length, total: payoutRows.reduce((sum, payout) => sum + Number(payout.amount ?? 0), 0), latest: payoutRows[0]?.payout_date ?? '' })

      setLoading(false)
    }

    loadPlatform()
  }, [id])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setSaving(true)
    setError('')

    const { error: platformError } = await supabase
      .from('platforms')
      .update({
        name,
        slug,
        website_url: websiteUrl || null,
        logo_media_id: logoMediaId || null,
        status,
        score: score ? Number(score) : null,
      })
      .eq('id', id)

    if (platformError) {
      setError(platformError.message)
      setSaving(false)
      return
    }

    const { error: detailsError } = await supabase
      .from('prop_firm_details')
      .update({
        profit_split_min: profitSplitMin
          ? Number(profitSplitMin)
          : null,
        profit_split_max: profitSplitMax
          ? Number(profitSplitMax)
          : null,
        supports_ea: supportsEa,
        allows_news_trading: allowsNews,
        allows_weekend_holding: allowsWeekend,
      })
      .eq('platform_id', id)

    if (detailsError) {
      setError(detailsError.message)
      setSaving(false)
      return
    }

    const { error: translationError } = await supabase
      .from('platform_translations')
      .update({
        short_description: description,
      })
      .eq('platform_id', id)
      .eq('language', 'es')

    if (translationError) {
      setError(translationError.message)
      setSaving(false)
      return
    }

    const removedCountries = initialAvailabilityCodes.filter((code) => !availabilityCodes.includes(code))
    const addedCountries = availabilityCodes.filter((code) => !initialAvailabilityCodes.includes(code))
    if (removedCountries.length) {
      const { error: availabilityDeleteError } = await supabase.from('platform_availability').delete().eq('platform_id', id).in('country_code', removedCountries)
      if (availabilityDeleteError) { setError(availabilityDeleteError.message); setSaving(false); return }
    }
    if (addedCountries.length) {
      const { error: availabilityInsertError } = await supabase.from('platform_availability').insert(addedCountries.map((countryCode) => ({ platform_id: id, country_code: countryCode, status: 'active' })))
      if (availabilityInsertError) { setError(availabilityInsertError.message); setSaving(false); return }
    }

    router.push('/admin/platforms')
    router.refresh()
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      '¿Seguro que quieres eliminar esta Prop Firm? Esta acción no se puede deshacer.'
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('platforms')
      .delete()
      .eq('id', id)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/admin/platforms')
    router.refresh()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <p>Cargando...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Editar Prop Firm
          </h1>

          <p className="mt-1 text-slate-500">
            Modifica la información de {name}.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl bg-white p-8 shadow"
        >
          <div className="border-b pb-3"><h2 className="text-xl font-semibold">Información general</h2><p className="text-sm text-slate-500">Identidad, estado y presentación pública.</p></div>
          <div>
            <label className="mb-2 block text-sm font-medium">
              Nombre
            </label>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Slug
            </label>

            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Descripción
            </label>

            <textarea
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              className="min-h-32 w-full rounded-lg border p-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Sitio web
            </label>

            <input
              type="url"
              value={websiteUrl}
              onChange={(e) =>
                setWebsiteUrl(e.target.value)
              }
              className="w-full rounded-lg border p-3"
            />
          </div>

          <div>
  <label className="mb-2 block text-sm font-medium">
    Logo
  </label>

  <select
    value={logoMediaId}
    onChange={(e) =>
      setLogoMediaId(e.target.value)
    }
    className="w-full rounded-lg border p-3"
  >
    <option value="">
      Sin logo
    </option>

    {media.map((item) => (
      <option
        key={item.id}
        value={item.id}
      >
        {item.file_name}
      </option>
    ))}
  </select>

  {logoMediaId && (
    <div className="mt-4">
      {(() => {
        const selectedMedia = media.find(
          (item) => item.id === logoMediaId
        )

        if (!selectedMedia) return null

        return (
          <div className="flex items-center gap-4">
            <img
              src={selectedMedia.file_url}
              alt={
                selectedMedia.alt_text ||
                selectedMedia.file_name
              }
              className="h-20 w-20 rounded-lg border object-contain"
            />

            <div>
              <p className="text-sm font-medium">
                {selectedMedia.file_name}
              </p>

              <p className="text-xs text-slate-500">
                Logo seleccionado
              </p>
            </div>
          </div>
        )
      })()}
    </div>
  )}
</div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Profit Split mínimo %
              </label>

              <input
                type="number"
                step="0.01"
                value={profitSplitMin}
                onChange={(e) =>
                  setProfitSplitMin(e.target.value)
                }
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Profit Split máximo %
              </label>

              <input
                type="number"
                step="0.01"
                value={profitSplitMax}
                onChange={(e) =>
                  setProfitSplitMax(e.target.value)
                }
                className="w-full rounded-lg border p-3"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Estado
            </label>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border p-3"
            >
              <option value="active">Activa</option>
              <option value="draft">Borrador</option>
              <option value="inactive">Inactiva</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Score público</label>
            <input type="number" min="0" max="10" step="0.1" value={score} onChange={(event) => setScore(event.target.value)} className="w-full rounded-lg border p-3" placeholder="0 - 10" />
          </div>

          <div className="border-b pb-3 pt-4"><h2 className="text-xl font-semibold">Reglas de trading</h2><p className="text-sm text-slate-500">Campos estructurados que utiliza actualmente el recomendador.</p></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={supportsEa}
                onChange={(e) =>
                  setSupportsEa(e.target.checked)
                }
              />
              Permite EA / Bots
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={allowsNews}
                onChange={(e) =>
                  setAllowsNews(e.target.checked)
                }
              />
              Permite operar noticias
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={allowsWeekend}
                onChange={(e) =>
                  setAllowsWeekend(e.target.checked)
                }
              />
              Permite mantener operaciones el fin de semana
            </label>
          </div>

          <div className="border-b pb-3 pt-4"><h2 className="text-xl font-semibold">Condiciones económicas</h2><p className="text-sm text-slate-500">El profit split se edita aquí; precios, cuentas y drawdown permanecen en los planes.</p></div>
          <div className="rounded-xl border bg-slate-50 p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h3 className="font-semibold">Challenges y account plans</h3><p className="mt-1 text-sm text-slate-500">{challenges.length} challenges configurados. Accede a cada uno para gestionar precio, tamaño de cuenta, targets, drawdown y días.</p></div><Link href="/admin/challenges" className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">Gestionar challenges</Link></div><div className="mt-4 flex flex-wrap gap-2">{challenges.map((challenge) => <Link key={challenge.id} href={`/admin/challenges/${challenge.id}`} className="rounded-full border bg-white px-3 py-1.5 text-sm">{challenge.name} · {challenge.challenge_type || 'Tipo pendiente'}</Link>)}</div></div>

          <div className="border-b pb-3 pt-4"><h2 className="text-xl font-semibold">Disponibilidad geográfica</h2><p className="text-sm text-slate-500">Sin países seleccionados se interpreta como disponibilidad global/no restringida.</p></div>
          <label className="flex items-center gap-3 rounded-lg border p-4"><input type="checkbox" checked={availabilityCodes.length === 0} onChange={() => setAvailabilityCodes([])} /> Global</label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{countries.map((country) => <label key={country.code} className="flex items-center gap-3 rounded-lg border p-3"><input type="checkbox" checked={availabilityCodes.includes(country.code)} onChange={(event) => setAvailabilityCodes((current) => event.target.checked ? [...current, country.code] : current.filter((code) => code !== country.code))} />{country.name}</label>)}</div>

          <div className="border-b pb-3 pt-4"><h2 className="text-xl font-semibold">Payouts y verificación</h2><p className="text-sm text-slate-500">Datos de solo lectura agregados desde las fuentes automáticas.</p></div>
          <div className="grid gap-4 sm:grid-cols-3"><Summary label="Total payouts" value={payoutSummary.count.toLocaleString('es-CO')} /><Summary label="Total rastreado" value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(payoutSummary.total)} /><Summary label="Último payout" value={payoutSummary.latest ? new Date(payoutSummary.latest).toLocaleDateString('es-CO') : '—'} /></div>
          <div className="rounded-xl border p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">Fuentes asociadas</h3><Link href="/admin/payouts" className="text-sm font-medium underline">Gestionar fuentes de payouts</Link></div>{payoutSources.length ? <div className="mt-4 space-y-2">{payoutSources.map((source) => <div key={source.id} className="flex flex-wrap justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm"><span>{source.name}</span><span>{source.source_type} · {String(source.config?.verification ?? 'sin nivel')} · {String(source.status)}</span></div>)}</div> : <p className="mt-3 text-sm text-slate-500">Sin fuentes asociadas.</p>}</div>

          <div className="border-b pb-3 pt-4"><h2 className="text-xl font-semibold">Ofertas y afiliados</h2><p className="text-sm text-slate-500">Referencias existentes, sin duplicar sus datos en la ficha.</p></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border p-5"><h3 className="font-semibold">Ofertas</h3><p className="mt-2 text-sm text-slate-500">{offers.filter((offer) => offer.status === true).length} activas de {offers.length}</p><Link href="/admin/offers" className="mt-4 inline-block text-sm font-medium underline">Gestionar ofertas</Link></div><div className="rounded-xl border p-5"><h3 className="font-semibold">Enlaces afiliados</h3><p className="mt-2 text-sm text-slate-500">{affiliateLinks.length} enlaces asociados</p><Link href="/admin/affiliate-links" className="mt-4 inline-block text-sm font-medium underline">Gestionar afiliados</Link></div></div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h3 className="font-semibold text-amber-900">Datos aún no estructurados</h3><p className="mt-2 text-sm text-amber-800">Mercados, scalping, day trading, copy trading, límites de tiempo y reglas de consistencia requieren una ampliación de Supabase. No se guardan valores inferidos.</p></div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg border border-red-300 px-5 py-3 text-red-600 hover:bg-red-50"
            >
              Eliminar
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  router.push('/admin/platforms')
                }
                className="rounded-lg border px-5 py-3"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-slate-50 p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>
}
