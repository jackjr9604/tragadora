'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import type { PermissionKey } from '@/lib/admin-permissions'
import { invalidatePublicSource } from '@/lib/admin-public-translation-revalidation'
import {
  isCommunitySourceInput, isGiveawaySourceInput, isToolSourceInput, isUuid,
  type CommunitySourceInput, type GiveawaySourceInput, type ToolSourceInput,
} from '@/lib/admin-catalog-source-policy'
import { createClient } from '@/lib/supabase/server'

type ActionResult = { ok: boolean; message: string }

export async function saveToolSource(input: ToolSourceInput): Promise<ActionResult> {
  if (!isToolSourceInput(input)) return fail('Los datos de la herramienta no son válidos.')
  const access = await getCurrentAdminPermissions(), editing = Boolean(input.id)
  if (!access.userId) return fail('La sesión expiró. Vuelve a iniciar sesión.')
  if (!access.permissions.has(editing ? 'tools.update' : 'tools.create')) return fail('No tienes permiso para guardar herramientas.')
  const db = await createClient()
  const payload = {
    slug: input.slug, name: input.name.trim(), short_description: clean(input.shortDescription), tool_type: input.toolType,
    category: clean(input.category), icon_key: clean(input.iconKey), badge: clean(input.badge), internal_path: input.internalPath,
    external_url: input.externalUrl, is_featured: input.featured, display_order: input.displayOrder, status: input.status,
    open_in_new_tab: input.toolType === 'external' && input.openInNewTab, pricing_model: input.pricingModel,
    has_free_plan: input.pricingModel === 'free' || input.hasFreePlan, price_label: clean(input.priceLabel),
    availability: clean(input.availability), author_name: clean(input.authorName), promo_code: clean(input.promoCode),
    promo_label: clean(input.promoLabel), is_ours: input.isOurs, logo_media_id: input.logoMediaId,
  }
  const result = editing
    ? await db.from('tools').update(payload, { count: 'exact' }).eq('id', input.id!)
    : await db.from('tools').insert(payload)
  if (result.error) return fail('No se pudo guardar la herramienta. Revisa los datos e inténtalo de nuevo.')
  if (editing && result.count !== 1) return fail('La herramienta no existe o ya no está disponible para editarla.')
  return finishSourceWrite('tool_translation', ['/herramientas', '/calculadoras', '/admin/tools', '/admin/calculators'], editing ? 'Herramienta actualizada.' : 'Herramienta creada.')
}

export async function deleteToolSource(id: string): Promise<ActionResult> {
  return deleteSource('tools', id, 'tools.delete', 'tool_translation', ['/herramientas', '/calculadoras', '/admin/tools', '/admin/calculators'], 'Herramienta eliminada.')
}

export async function saveCommunitySource(input: CommunitySourceInput): Promise<ActionResult> {
  if (!isCommunitySourceInput(input)) return fail('Los datos de la comunidad no son válidos.')
  const access = await getCurrentAdminPermissions(), editing = Boolean(input.id)
  if (!access.userId) return fail('La sesión expiró. Vuelve a iniciar sesión.')
  if (!access.permissions.has(editing ? 'communities.update' : 'communities.create')) return fail('No tienes permiso para guardar comunidades.')
  const db = await createClient()
  const payload = { name: input.name.trim(), slug: input.slug, short_description: clean(input.shortDescription), community_type: input.communityType, category: clean(input.category), language_code: clean(input.languageCode), region_label: clean(input.regionLabel), logo_media_id: input.logoMediaId, join_url: input.joinUrl, website_url: input.websiteUrl, badge: clean(input.badge), is_featured: input.featured, display_order: input.displayOrder, status: input.status }
  const result = editing
    ? await db.from('communities').update(payload, { count: 'exact' }).eq('id', input.id!)
    : await db.from('communities').insert(payload)
  if (result.error) return fail('No se pudo guardar la comunidad. Revisa los datos e inténtalo de nuevo.')
  if (editing && result.count !== 1) return fail('La comunidad no existe o ya no está disponible para editarla.')
  return finishSourceWrite('community_translation', ['/comunidades', '/admin/communities'], editing ? 'Comunidad actualizada.' : 'Comunidad creada.')
}

export async function deleteCommunitySource(id: string): Promise<ActionResult> {
  return deleteSource('communities', id, 'communities.delete', 'community_translation', ['/comunidades', '/admin/communities'], 'Comunidad eliminada.')
}

export async function saveGiveawaySource(input: GiveawaySourceInput): Promise<ActionResult> {
  if (!isGiveawaySourceInput(input)) return fail('Los datos del giveaway no son válidos.')
  const access = await getCurrentAdminPermissions(), editing = Boolean(input.id)
  if (!access.userId) return fail('La sesión expiró. Vuelve a iniciar sesión.')
  if (!access.permissions.has(editing ? 'giveaways.update' : 'giveaways.create')) return fail('No tienes permiso para guardar giveaways.')
  const db = await createClient()
  const payload = { slug: input.slug, title: input.title.trim(), short_description: clean(input.shortDescription), sponsor_platform_id: input.sponsorPlatformId, prize_title: input.prizeTitle.trim(), prize_quantity: input.prizeQuantity, prize_description: clean(input.prizeDescription), cover_media_id: input.coverMediaId, starts_at: input.startsAt, ends_at: input.endsAt, participation_url: input.participationUrl, rules_url: input.rulesUrl, badge: clean(input.badge), reveal_title: clean(input.revealTitle), reveal_content: clean(input.revealContent), is_featured: input.featured, display_order: input.displayOrder, status: input.status }
  const result = editing
    ? await db.from('giveaways').update(payload, { count: 'exact' }).eq('id', input.id!)
    : await db.from('giveaways').insert(payload)
  if (result.error) return fail('No se pudo guardar el giveaway. Revisa los datos e inténtalo de nuevo.')
  if (editing && result.count !== 1) return fail('El giveaway no existe o ya no está disponible para editarlo.')
  return finishSourceWrite('giveaway_translation', ['/giveaway', '/admin/giveaways'], editing ? 'Giveaway actualizado.' : 'Giveaway creado.')
}

export async function deleteGiveawaySource(id: string): Promise<ActionResult> {
  return deleteSource('giveaways', id, 'giveaways.delete', 'giveaway_translation', ['/giveaway', '/admin/giveaways'], 'Giveaway eliminado.')
}

async function deleteSource(table: 'tools' | 'communities' | 'giveaways', id: string, permission: PermissionKey, resourceType: 'tool_translation' | 'community_translation' | 'giveaway_translation', paths: string[], message: string): Promise<ActionResult> {
  const access = await getCurrentAdminPermissions()
  if (!access.userId) return fail('La sesión expiró. Vuelve a iniciar sesión.')
  if (!access.permissions.has(permission)) return fail('No tienes permiso para eliminar este recurso.')
  if (!isUuid(id)) return fail('El recurso no es válido.')
  const db = await createClient(), result = await db.from(table).delete({ count: 'exact' }).eq('id', id)
  if (result.error) return fail('No se pudo eliminar el recurso.')
  if (result.count !== 1) return fail('El recurso no existe o ya no está disponible para eliminarlo.')
  return finishSourceWrite(resourceType, paths, message)
}

function finishSourceWrite(resourceType: 'tool_translation' | 'community_translation' | 'giveaway_translation', paths: string[], message: string): ActionResult {
  try {
    invalidatePublicSource(resourceType)
    for (const path of paths) revalidatePath(path)
    return { ok: true, message }
  } catch {
    return fail('El cambio se guardó, pero no fue posible renovar la caché pública. No repitas la operación; recarga y verifica el contenido.')
  }
}

function clean(value: string | null) { const normalized = value?.trim(); return normalized || null }
function fail(message: string): ActionResult { return { ok: false, message } }
