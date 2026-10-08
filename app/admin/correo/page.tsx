import { MailClient } from '@/components/admin/mail/MailClient'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'

export default async function AdminMailPage() {
  const access = await getCurrentAdminPermissions()
  return (
    <MailClient
      canSend={access.permissions.has('mail.send')}
      canManage={access.permissions.has('mail.manage')}
    />
  )
}
