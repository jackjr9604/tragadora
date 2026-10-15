import { ContentCenterFrame } from '@/components/admin/content/ContentCenterFrame'
import { publicAiEngineStatus } from '@/lib/admin-translation-ai'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'

export default async function ContentCenterLayout({ children }: { children: React.ReactNode }) {
  const access = await getCurrentAdminPermissions()
  return <ContentCenterFrame ai={publicAiEngineStatus()} canManageContent={access.permissions.has('content.view')}>{children}</ContentCenterFrame>
}
