import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveChallenge, type AccountPlan, type ChallengePhase, type ChallengeRewardOption, type ChallengeVariant, type ChallengeVariantPhase } from './challenge-resolver'

const challenge = { id: 'challenge', name: '2 Step Flex', phases: 2 }
const basePhases: ChallengePhase[] = [phase(1, 10), phase(2, 6)]
const variant85: ChallengeVariant = { id: 'v85', challenge_id: challenge.id, name: '85%', slug: '85', profit_split: 85, price_modifier: null, payout_frequency: null, notes: null, status: true }
const variant95: ChallengeVariant = { ...variant85, id: 'v95', name: '95%', slug: '95', profit_split: 95 }

test('null overrides preserve base rules and non-null overrides win', () => {
  const overrides: ChallengeVariantPhase[] = [override('v85', 1, { profit_target: null, min_trading_days: 1 })]
  const resolved = resolveChallenge({ challenge, phases: basePhases, variants: [variant85], variantPhases: overrides, plans: [] })
  assert.equal(resolved.variants[0].effectivePhases[0].profitTarget, 10)
  assert.equal(resolved.variants[0].effectivePhases[0].minTradingDays, 1)
})

test('variant can override minimum profitable days', () => {
  const overrides = [override('v95', 1, { min_profitable_days: 3 })]
  const resolved = resolveChallenge({ challenge, phases: basePhases, variants: [variant95], variantPhases: overrides, plans: [] })
  assert.equal(resolved.variants[0].effectivePhases[0].minProfitableDays, 3)
})

test('legacy challenge resolves rules per plan without inventing challenge-wide phases', () => {
  const plan = accountPlan('base', null, { profit_target: 10, max_drawdown: 12 })
  const resolved = resolveChallenge({ challenge, phases: [], variants: [], variantPhases: [], plans: [plan] })
  assert.equal(resolved.hasNormalizedPhases, false)
  assert.equal(resolved.basePhases.length, 0)
  assert.equal(resolved.basePlans[0].effectivePhases[0].profitTarget, 10)
})

test('two normalized phases remain distinct instead of becoming one target', () => {
  const resolved = resolveChallenge({ challenge, phases: basePhases, variants: [], variantPhases: [], plans: [] })
  assert.deepEqual(resolved.basePhases.map((item) => item.profitTarget), [10, 6])
})

test('variant plans never mix with plans from another variant', () => {
  const plans = [accountPlan('85-plan', 'v85'), accountPlan('95-plan', 'v95'), accountPlan('base-plan', null)]
  const resolved = resolveChallenge({ challenge, phases: basePhases, variants: [variant85, variant95], variantPhases: [], plans })
  assert.deepEqual(resolved.basePlans.map((plan) => plan.id), ['base-plan'])
  assert.deepEqual(resolved.variants[0].plans.map((plan) => plan.id), ['85-plan'])
  assert.deepEqual(resolved.variants[1].plans.map((plan) => plan.id), ['95-plan'])
})

test('challenge without reward options preserves legacy split', () => {
  const resolved = resolveChallenge({ challenge, phases: [], variants: [], variantPhases: [], plans: [accountPlan('legacy', null, { profit_split: 80 })] })
  assert.equal(resolved.basePlans[0].effectiveProfitSplit, 80)
  assert.deepEqual(resolved.generalRewardOptions, [])
})

test('general reward option applies to a base plan', () => {
  const reward = rewardOption('general', null, { profit_split: 90 })
  const resolved = resolveChallenge({ challenge, phases: basePhases, variants: [], variantPhases: [], plans: [accountPlan('base', null)], rewardOptions: [reward] })
  assert.deepEqual(resolved.basePlans[0].rewardOptions.map((option) => option.id), ['general'])
  assert.equal(resolved.basePlans[0].effectiveProfitSplit, 90)
})

test('variant without specific rewards inherits general rewards', () => {
  const reward = rewardOption('general', null, { profit_split: 100 })
  const resolved = resolveChallenge({ challenge, phases: basePhases, variants: [variant85], variantPhases: [], plans: [accountPlan('85-plan', 'v85')], rewardOptions: [reward] })
  assert.equal(resolved.variants[0].rewardOptionsSource, 'inherited')
  assert.deepEqual(resolved.variants[0].rewardOptions.map((option) => option.id), ['general'])
  assert.equal(resolved.variants[0].plans[0].effectiveProfitSplit, 100)
})

test('variant-specific rewards replace rather than mix with general rewards', () => {
  const rewards = [rewardOption('general', null, { profit_split: 100 }), rewardOption('specific', 'v85', { profit_split: 85 })]
  const resolved = resolveChallenge({ challenge, phases: basePhases, variants: [variant85], variantPhases: [], plans: [accountPlan('85-plan', 'v85')], rewardOptions: rewards })
  assert.equal(resolved.variants[0].rewardOptionsSource, 'specific')
  assert.deepEqual(resolved.variants[0].rewardOptions.map((option) => option.id), ['specific'])
  assert.equal(resolved.variants[0].plans[0].effectiveProfitSplit, 85)
})

test('null reward split does not erase variant or plan fallback', () => {
  const nullSplit = rewardOption('null-split', 'v85', { profit_split: null })
  const withVariant = resolveChallenge({ challenge, phases: basePhases, variants: [variant85], variantPhases: [], plans: [accountPlan('85-plan', 'v85', { profit_split: 80 })], rewardOptions: [nullSplit] })
  const withPlan = resolveChallenge({ challenge, phases: basePhases, variants: [], variantPhases: [], plans: [accountPlan('base', null, { profit_split: 80 })], rewardOptions: [rewardOption('general-null', null, { profit_split: null })] })
  assert.equal(withVariant.variants[0].plans[0].effectiveProfitSplit, 85)
  assert.equal(withPlan.basePlans[0].effectiveProfitSplit, 80)
})

test('multiple applicable rewards use the highest non-null split for summary', () => {
  const rewards = [rewardOption('first', null, { profit_split: 80, sort_order: 2 }), rewardOption('second', null, { profit_split: 95, sort_order: 1 })]
  const resolved = resolveChallenge({ challenge, phases: basePhases, variants: [], variantPhases: [], plans: [accountPlan('base', null)], rewardOptions: rewards })
  assert.equal(resolved.basePlans[0].effectiveProfitSplit, 95)
  assert.deepEqual(resolved.generalRewardOptions.map((option) => option.id), ['second', 'first'])
})

test('reward minimum profitable days never alters evaluation phases', () => {
  const reward = rewardOption('reward-days', null, { minimum_profitable_days: 5 })
  const resolved = resolveChallenge({ challenge, phases: basePhases, variants: [], variantPhases: [], plans: [accountPlan('base', null)], rewardOptions: [reward] })
  assert.equal(resolved.basePhases[0].minProfitableDays, null)
  assert.equal(resolved.generalRewardOptions[0].minimum_profitable_days, 5)
})

test('FundingPips 2 Step Flex keeps 85 and 95 rewards isolated from Monthly 100', () => {
  const rewards = [
    rewardOption('monthly-100', null, { name: 'Monthly 100%', profit_split: 100, effective_from: '2026-08-15T00:00:00Z' }),
    rewardOption('biweekly-85', 'v85', { name: 'Bi-Weekly 85%', profit_split: 85 }),
    rewardOption('biweekly-95', 'v95', { name: 'Bi-Weekly 95%', profit_split: 95 }),
  ]
  const variantPhases = [override('v85', 1, { min_trading_days: 1 }), override('v85', 2, { min_trading_days: 1 }), override('v95', 1, { min_profitable_days: 3 }), override('v95', 2, { min_profitable_days: 3 })]
  const plans = [accountPlan('85-plan', 'v85'), accountPlan('95-plan', 'v95')]
  const resolved = resolveChallenge({ challenge, phases: basePhases, variants: [variant85, variant95], variantPhases, plans, rewardOptions: rewards, now: '2026-08-31T00:00:00Z' })
  assert.deepEqual(resolved.generalRewardOptions.map((option) => option.name), ['Monthly 100%'])
  assert.deepEqual(resolved.variants[0].rewardOptions.map((option) => option.name), ['Bi-Weekly 85%'])
  assert.deepEqual(resolved.variants[1].rewardOptions.map((option) => option.name), ['Bi-Weekly 95%'])
  assert.equal(resolved.variants[0].plans[0].effectiveProfitSplit, 85)
  assert.equal(resolved.variants[1].plans[0].effectiveProfitSplit, 95)
  assert.deepEqual(resolved.variants[0].effectivePhases.map((phase) => phase.minTradingDays), [1, 1])
  assert.deepEqual(resolved.variants[1].effectivePhases.map((phase) => phase.minProfitableDays), [3, 3])
})

function phase(phaseNumber: number, target: number): ChallengePhase {
  return { id: `p${phaseNumber}`, challenge_id: challenge.id, phase_number: phaseNumber, name: `Phase ${phaseNumber}`, profit_target: target, daily_drawdown: 4, max_drawdown: 12, min_trading_days: null, max_trading_days: null, min_profitable_days: null, drawdown_type: 'static', drawdown_basis: 'balance', notes: null }
}

function override(variantId: string, phaseNumber: number, values: Partial<ChallengeVariantPhase>): ChallengeVariantPhase {
  return { id: `${variantId}-${phaseNumber}`, variant_id: variantId, phase_number: phaseNumber, profit_target: null, daily_drawdown: null, max_drawdown: null, min_trading_days: null, min_profitable_days: null, drawdown_type: null, drawdown_basis: null, notes: null, ...values }
}

function accountPlan(id: string, variantId: string | null, values: Partial<AccountPlan> = {}): AccountPlan {
  return { id, challenge_id: challenge.id, variant_id: variantId, account_size: 100_000, price: 500, currency: 'USD', profit_target: null, daily_drawdown: null, max_drawdown: null, profit_split: 80, min_trading_days: null, max_trading_days: null, payout_frequency: null, ...values }
}

function rewardOption(id: string, variantId: string | null, values: Partial<ChallengeRewardOption> = {}): ChallengeRewardOption {
  return { id, challenge_id: challenge.id, variant_id: variantId, name: id, profit_split: null, payout_frequency: null, minimum_payout_days: null, minimum_profitable_days: null, profitable_day_threshold_pct: null, consistency_rule_pct: null, notes: null, status: true, sort_order: 0, source_url: null, effective_from: null, effective_to: null, ...values }
}
