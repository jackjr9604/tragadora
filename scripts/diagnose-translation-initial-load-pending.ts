import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { evaluateInitialLoadTranslation } from '../lib/translation/initial-load-quality'

loadEnvConfig(process.cwd())
const resources = ['site_content','platform_translation','broker_detail_translation','exchange_detail_translation','offer_translation','challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation','tool_translation','community_translation','giveaway_translation','blog_post_translation']

void main().catch((error) => { console.error(error instanceof Error ? error.message : 'Error inesperado'); process.exitCode = 1 })

async function main() {
  const url = required('NEXT_PUBLIC_SUPABASE_URL'); const key = required('SUPABASE_SERVICE_ROLE_KEY')
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const groups: Record<string, unknown>[] = []
  for (let page = 1; ; page += 1) {
    const result = await db.rpc('translation_admin_exact_group_inventory', { p_allowed_resource_types: resources, p_resource_type: null, p_field_name: null, p_target_language: null, p_status: 'pending', p_query: null, p_page: page, p_page_size: 100 })
    if (result.error) throw new Error(result.error.message)
    groups.push(...(result.data ?? [])); if ((result.data?.length ?? 0) < 100) break
  }
  const details = []
  for (const group of groups) {
    const members: Record<string, unknown>[] = []
    for (let page = 1; ; page += 1) {
      const result = await db.rpc('translation_admin_exact_group_members', { p_allowed_resource_types: resources, p_resource_type: group.resource_type, p_field_name: group.field_name, p_source_hash: group.source_hash, p_target_language: group.target_language, p_page: page, p_page_size: 100 })
      if (result.error) throw new Error(result.error.message)
      members.push(...(result.data ?? [])); if ((result.data?.length ?? 0) < 100) break
    }
    const proposal = members.find((member) => member.proposal_draft_value != null)?.proposal_draft_value ?? members.find((member) => member.draft_value != null)?.draft_value ?? null
    const qa = proposal == null ? null : evaluateInitialLoadTranslation({ resourceType: String(group.resource_type), fieldName: String(group.field_name), source: group.source_value, draft: proposal })
    details.push({ resource_type: group.resource_type, field_name: group.field_name, target_language: group.target_language, source_hash: group.source_hash, source_value: group.source_value, proposal, qa, resource_count: Number(group.resource_count), eligible_count: Number(group.eligible_count), draft_count: Number(group.draft_count), error_count: Number(group.error_count), sensitivity: group.sensitivity, members: members.map((member) => ({ state_id: member.state_id, resource_id: member.resource_id, status: member.status, workflow_status: member.workflow_status, publication_status: member.publication_status, is_protected: member.is_protected, source_revision: member.source_revision, lock_version: member.lock_version })) })
  }
  const report = { groups: details.length, fields: details.reduce((sum, item) => sum + item.resource_count, 0), byResource: countBy(details, (item) => `${item.resource_type}:${item.target_language}`), byQa: countBy(details, (item) => item.qa?.status ?? 'no_proposal'), byQaCode: countBy(details.flatMap((item) => item.qa?.codes ?? ['no_proposal']), (code) => code), details }
  const output = JSON.stringify(report, null, 2)
  const outputPath = process.env.TRANSLATION_PENDING_REPORT?.trim()
  if (outputPath) { writeFileSync(outputPath, output, { encoding: 'utf8', flag: 'w' }); console.log(JSON.stringify({ ...report, details: undefined, outputPath })) }
  else console.log(output)
}

function countBy<T>(rows: T[], key: (row: T) => string) { return Object.fromEntries([...rows.reduce((map, row) => map.set(key(row), (map.get(key(row)) ?? 0) + 1), new Map<string, number>())].sort()) }
function required(name: string) { const value = process.env[name]?.trim(); if (!value) throw new Error(`Falta ${name}`); return value }
