import { redirect } from 'next/navigation'

export default async function LegacyContentEditor({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params
  redirect(`/admin/content-center/content/${encodeURIComponent(page)}`)
}
