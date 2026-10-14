import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AdminLanguage } from '@/lib/admin-language-policy'

export async function getAdminLanguages() {
  const result=await createAdminClient().rpc('translation_admin_language_inventory')
  if (result.error) {
    if (result.error.code==='PGRST202'||result.error.code==='42883') return {languages:[] as AdminLanguage[],rpcAvailable:false}
    throw new Error(result.error.message)
  }
  return {languages:(result.data??[]).map((row:Record<string,unknown>)=>({
    ...row,sort_order:Number(row.sort_order),lock_version:Number(row.lock_version),content_count:Number(row.content_count),
    state_count:Number(row.state_count),published_field_count:Number(row.published_field_count),job_count:Number(row.job_count),
  })) as AdminLanguage[],rpcAvailable:true}
}
