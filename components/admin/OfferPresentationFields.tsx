'use client'

export type OfferPresentation = {
  includesFreeAccount: boolean
  freeAccountLabel: string
  isFeatured: boolean
  hotBadge: string
  shortHighlight: string
}

export function OfferPresentationFields({ value, onChange }: { value: OfferPresentation; onChange: (value: OfferPresentation) => void }) {
  const set = <K extends keyof OfferPresentation>(key: K, next: OfferPresentation[K]) => onChange({ ...value, [key]: next })
  return <fieldset className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
    <legend className="px-2 font-semibold">Presentación pública</legend>
    <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={value.includesFreeAccount} onChange={(event) => set('includesFreeAccount', event.target.checked)} className="size-4" />Incluye cuenta gratis</label>
    {value.includesFreeAccount && <label className="block text-sm font-medium">Texto del beneficio<input value={value.freeAccountLabel} onChange={(event) => set('freeAccountLabel', event.target.value)} maxLength={80} placeholder="+ Cuenta gratis" className="mt-2 w-full rounded-lg border bg-white p-3" /></label>}
    <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={value.isFeatured} onChange={(event) => set('isFeatured', event.target.checked)} className="size-4" />Mostrar en ofertas destacadas</label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium">Badge destacado<input value={value.hotBadge} onChange={(event) => set('hotBadge', event.target.value)} maxLength={40} placeholder="Exclusiva" className="mt-2 w-full rounded-lg border bg-white p-3" /></label>
      <label className="block text-sm font-medium">Texto corto<input value={value.shortHighlight} onChange={(event) => set('shortHighlight', event.target.value)} maxLength={100} placeholder="25% en la primera compra" className="mt-2 w-full rounded-lg border bg-white p-3" /></label>
    </div>
  </fieldset>
}
