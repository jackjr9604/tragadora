import assert from 'node:assert/strict'
import test from 'node:test'
import { isCommunitySourceInput, isGiveawaySourceInput, isToolSourceInput } from './admin-catalog-source-policy'

const id = '11111111-1111-4111-8111-111111111111'

test('valida herramientas y conserva destinos mutuamente excluyentes', () => {
  const tool = { id, slug: 'risk-tool', name: 'Risk Tool', shortDescription: null, toolType: 'external', category: null, iconKey: null, badge: null, internalPath: null, externalUrl: 'https://example.com/tool', featured: false, displayOrder: 10, status: 'published', openInNewTab: true, pricingModel: 'free', hasFreePlan: true, priceLabel: null, availability: null, authorName: null, promoCode: null, promoLabel: null, isOurs: false, logoMediaId: null }
  assert.equal(isToolSourceInput(tool), true)
  assert.equal(isToolSourceInput({ ...tool, slug: '../unsafe' }), false)
  assert.equal(isToolSourceInput({ ...tool, internalPath: '/calculadoras/risk' }), false)
  assert.equal(isToolSourceInput({ ...tool, externalUrl: 'javascript:alert(1)' }), false)
})

test('valida comunidades con UUID, límites y URLs HTTP seguras', () => {
  const community = { id, name: 'Comunidad', slug: 'comunidad', shortDescription: null, communityType: 'discord', category: null, languageCode: 'es', regionLabel: null, logoMediaId: null, joinUrl: 'https://discord.com/example', websiteUrl: null, badge: null, featured: false, displayOrder: 100, status: 'draft' }
  assert.equal(isCommunitySourceInput(community), true)
  assert.equal(isCommunitySourceInput({ ...community, id: 'invalid' }), false)
  assert.equal(isCommunitySourceInput({ ...community, joinUrl: 'file:///tmp/value' }), false)
  assert.equal(isCommunitySourceInput({ ...community, shortDescription: 'x'.repeat(2_001) }), false)
})

test('valida giveaways, fechas y cantidades sin confiar en TypeScript', () => {
  const giveaway = { id, slug: 'giveaway-demo', title: 'Demo', shortDescription: null, sponsorPlatformId: null, prizeTitle: 'Premio', prizeQuantity: 1, prizeDescription: null, coverMediaId: null, startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-10-02T00:00:00.000Z', participationUrl: null, rulesUrl: null, badge: null, revealTitle: null, revealContent: null, featured: false, displayOrder: 100, status: 'published' }
  assert.equal(isGiveawaySourceInput(giveaway), true)
  assert.equal(isGiveawaySourceInput({ ...giveaway, endsAt: giveaway.startsAt }), false)
  assert.equal(isGiveawaySourceInput({ ...giveaway, prizeQuantity: -1 }), false)
  assert.equal(isGiveawaySourceInput({ ...giveaway, revealContent: 'x'.repeat(20_001) }), false)
})
