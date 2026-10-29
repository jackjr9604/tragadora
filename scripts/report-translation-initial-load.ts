import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())
void main().catch((error) => { console.error(error instanceof Error ? error.message : 'Error inesperado'); process.exitCode = 1 })

async function main() {
  const runId = process.argv[2]
  if (!runId?.match(/^[0-9a-f-]{36}$/i)) throw new Error('run_id inválido')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error('Configuración Supabase ausente')
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const status = await db.rpc('translation_initial_load_status', { p_run_id: runId })
  if (status.error) throw new Error(status.error.message)
  const resources = ['site_content','platform_translation','broker_detail_translation','exchange_detail_translation','offer_translation','challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation','tool_translation','community_translation','giveaway_translation','blog_post_translation']
  const coverage = await db.rpc('translation_admin_language_coverage', { p_allowed_resource_types: resources })
  if (coverage.error) throw new Error(coverage.error.message)
  const summary = await db.rpc('translation_admin_content_center_summary', { p_allowed_resource_types: resources })
  if (summary.error) throw new Error(summary.error.message)
  const platformErrors = await db.rpc('translation_admin_exact_group_inventory', {
    p_allowed_resource_types: resources, p_resource_type: 'platform_translation', p_field_name: null,
    p_target_language: null, p_status: 'error', p_query: null, p_page: 1, p_page_size: 100,
  })
  if (platformErrors.error) throw new Error(platformErrors.error.message)

  console.log(JSON.stringify({
    run: status.data,
    coverage: coverage.data,
    summary: summary.data,
    platformErrors: (platformErrors.data ?? []).map((row: Record<string, unknown>) => ({
      field_name: row.field_name, target_language: row.target_language, resource_count: row.resource_count,
      error_count: row.error_count, sensitivity: row.sensitivity,
    })),
  }, null, 2))
}
