import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { reviewOfficialPayoutEvidence } from './official-payout-evidence'

async function main() {
  const [inputPath, outputPath, ...extra] = process.argv.slice(2)
  if (!inputPath || !outputPath || extra.length) throw new Error('Usage: tsx scripts/review-official-payout-evidence.ts <private-input.json> <new-private-output.json>')
  if (resolve(inputPath) === resolve(outputPath)) throw new Error('Output must not overwrite source evidence')
  const evidence: unknown = JSON.parse(await readFile(inputPath, 'utf8'))
  if (!Array.isArray(evidence)) throw new Error('Input must be an array of evidence candidates')
  const results = evidence.map((candidate) => reviewOfficialPayoutEvidence(candidate))
  await writeFile(outputPath, JSON.stringify({ checkedAt: new Date().toISOString(), mode: 'offline_review_only', results }, null, 2) + '\n', { flag: 'wx' })
  console.log(JSON.stringify({ candidates: results.length, blocked: results.filter((result) => result.status === 'blocked').length, referenceOnly: results.filter((result) => result.status === 'reference_only').length, exactCandidatesForHumanReview: results.filter((result) => result.status === 'exact_candidate_for_human_review').length, writesToDatabase: 0 }))
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
