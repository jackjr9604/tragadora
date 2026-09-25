import { DocumentationWiki, type DocumentationSummary } from '@/components/admin/DocumentationWiki'
import { createClient } from '@/lib/supabase/server'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'

export default async function DocumentationPage({searchParams}:{searchParams:Promise<{section?:string}>}){const[db,access,params]=await Promise.all([createClient(),getCurrentAdminPermissions(),searchParams]);const result=await db.from('documentation_articles').select('id,slug,title,excerpt,section,subsection,audience,status,sort_order,updated_at,body_markdown').order('section').order('sort_order').order('title');if(result.error)throw new Error(result.error.message);return <main className="min-h-screen p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-[1500px]"><DocumentationWiki articles={(result.data??[]) as DocumentationSummary[]} canCreate={access.permissions.has('docs.create')} initialSection={params.section}/></div></main>}
