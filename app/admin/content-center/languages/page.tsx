import { ContentCenterLanguages } from '@/components/admin/content/ContentCenterLanguages'
import { getAdminLanguages } from '@/lib/admin-languages'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'

export default async function ContentCenterLanguagesPage() {
  const [data, access] = await Promise.all([getAdminLanguages(), getCurrentAdminPermissions()])
  return <section className="mt-6">{!data.rpcAvailable ? <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">La administración segura de idiomas no está disponible.</div> : <ContentCenterLanguages languages={data.languages} canCreate={access.permissions.has('content.create')} canUpdate={access.permissions.has('content.update')} canDelete={access.permissions.has('content.delete')} />}</section>
}
