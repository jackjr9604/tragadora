'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { invalidatePublicSource } from '@/lib/admin-public-translation-revalidation'
import { type OfferSourceInput, type OfferStatusInput } from '@/lib/admin-offer-source-policy'
import { executeSaveOffer, executeSetOfferStatus, type OfferActionDependencies, type OfferActionResult } from '@/lib/admin-offer-actions-runtime'
import { createClient } from '@/lib/supabase/server'

export async function saveOfferSource(input: OfferSourceInput): Promise<OfferActionResult> {
  try { return await executeSaveOffer(input, await dependencies()) } catch { return failure() }
}

export async function setOfferStatus(input: OfferStatusInput): Promise<OfferActionResult> {
  try { return await executeSetOfferStatus(input, await dependencies()) } catch { return failure() }
}

async function dependencies(): Promise<OfferActionDependencies> {
  const supabase = await createClient()
  return {
    getAccess: getCurrentAdminPermissions,
    rpc: async (name, args) => supabase.rpc(name, args),
    invalidate: (result) => {
    invalidatePublicSource('offer_translation')
    for (const path of ['/', '/ofertas', '/prop-firms', '/brokers', '/exchanges', '/comparador', '/admin/offers']) revalidatePath(path)
    for (const pattern of ['/prop-firms/[slug]', '/brokers/[slug]', '/exchanges/[slug]']) revalidatePath(pattern, 'page')
    if (result.id) revalidatePath(`/admin/offers/${result.id}`)
    },
  }
}
function failure(): OfferActionResult { return { ok: false, message: 'No se pudo completar la operación. El resultado es desconocido; recarga antes de intentarlo de nuevo.' } }
