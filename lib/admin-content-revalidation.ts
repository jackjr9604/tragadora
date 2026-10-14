import 'server-only'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getContentPage } from './content-schema'

export function revalidateSiteContent(resourceId?: string) {
  revalidateTag('public-site-content', 'max')
  const pageSlug = resourceId?.split('.')[0]
  const page = pageSlug ? getContentPage(pageSlug) : undefined
  if (page) revalidatePath(page.publicPath)
  else revalidatePath('/', 'layout')
  revalidatePath('/admin/content')
  revalidatePath('/admin/translations')
  revalidatePath('/admin/content-center')
}
