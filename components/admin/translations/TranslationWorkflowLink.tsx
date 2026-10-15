import Link from 'next/link'
import { Languages } from 'lucide-react'
import type { TranslationResourceType } from '@/lib/admin-translation-inventory-policy'

export function TranslationWorkflowLink({ resourceType, resourceId, label = 'Gestionar traducciones', returnTo }: { resourceType: TranslationResourceType; resourceId: string; label?: string; returnTo?: string }) {
  const path = `/admin/content-center/translations/${resourceType}/${encodeURIComponent(resourceId)}`
  const href = returnTo ? `${path}?returnTo=${encodeURIComponent(returnTo)}` : path
  return <Link href={href} className="admin-secondary-button gap-2 px-3 py-2 text-sm"><Languages className="size-4" />{label}</Link>
}
