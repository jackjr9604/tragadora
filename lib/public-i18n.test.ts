import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { comparatorText, firmProfileText, getPublicUi, hasPublicUiCatalog, localizedCountryName, localizeComparatorOutput, localizeFinderReason, publicBrokerProfileCopy, publicCalculatorCopy, publicComparatorCopy, publicExchangeProfileCopy, publicFinderCopy, publicFirmProfileCopy, publicHomeCopy, publicOffersCopy, publicOfferToastCopy, publicPath, publicTradingRuleCopy, publicUiCatalog, publicUiLanguage, publishablePublicLanguages } from './public-i18n'
import { choosePublicLanguage } from './public-language'
import { calculatorMoney, calculatorPercentage } from '../components/tools/Calculators'
import { CountryFlag } from '../components/shared/CountryFlag'
import { PromoCodeButton } from '../components/public/offers/PromoCodeButton'
import { offerBenefit, offerDateLabel } from '../components/public/offers/offer-ui'
import type { PublicOffer } from './public-offers'

test('all UI languages expose exactly the Spanish source keys', () => {
  const source = Object.keys(publicUiCatalog.es).sort()
  assert.deepEqual(Object.keys(publicUiCatalog.en).sort(), source)
  assert.deepEqual(Object.keys(publicUiCatalog.pt).sort(), source)
  for (const messages of Object.values(publicUiCatalog)) {
    assert.equal(Object.values(messages).some((value) => !value.trim()), false)
  }
})

test('normalizes regional locales and falls back to Spanish', () => {
  assert.equal(publicUiLanguage('pt-BR'), 'pt')
  assert.equal(publicUiLanguage('en-US'), 'en')
  assert.equal(publicUiLanguage('fr'), 'es')
  assert.equal(getPublicUi('fr')('nav.offers'), 'Ofertas')
})

test('language resolution follows query, cookie, configured default, then Spanish', () => {
  const active = ['es', 'en', 'pt']
  assert.equal(choosePublicLanguage({ requested: 'pt', stored: 'en', active, defaultLanguage: 'es' }), 'pt')
  assert.equal(choosePublicLanguage({ requested: 'fr', stored: 'en', active, defaultLanguage: 'pt' }), 'en')
  assert.equal(choosePublicLanguage({ requested: 'fr', stored: 'de', active, defaultLanguage: 'pt' }), 'pt')
  assert.equal(choosePublicLanguage({ requested: 'fr', stored: 'de', active: [], defaultLanguage: null }), 'es')
})

test('interpolates variables without changing the source catalog', () => {
  assert.equal(getPublicUi('en')('a11y.viewFirm', { name: 'FTMO' }), 'View FTMO')
  assert.equal(publicUiCatalog.en['a11y.viewFirm'], 'View {name}')
})

test('publicPath preserves filters and selected language', () => {
  assert.equal(publicPath('/payouts?period=30d', 'pt'), '/payouts?period=30d&lang=pt')
  assert.equal(publicPath('/prop-firms', 'en', { market: 'futures' }), '/prop-firms?lang=en&market=futures')
  assert.equal(publicPath('/go/ftmo', 'en', { offer: 'offer-id' }), '/go/ftmo?lang=en&offer=offer-id')
})

test('affiliate route messages are localized in every public language', () => {
  assert.equal(getPublicUi('es')('go.offerUnavailable'), 'La oferta no está disponible.')
  assert.equal(getPublicUi('en')('go.platformNotFound', { slug: 'missing' }), 'The requested platform was not found: missing.')
  assert.equal(getPublicUi('pt')('go.noAffiliateLink', { name: 'Firma' }), 'Não há um link de afiliado ativo para Firma.')
})

test('registered languages are not publishable until a complete UI catalog exists', () => {
  const registered = [{ code: 'es' }, { code: 'en' }, { code: 'pt' }, { code: 'fr' }]
  assert.deepEqual(publishablePublicLanguages(registered).map(({ code }) => code), ['es', 'en', 'pt'])
  assert.equal(hasPublicUiCatalog('fr'), false)
  assert.equal(hasPublicUiCatalog('pt-BR'), true)
  assert.equal(publicHomeCopy[publicUiLanguage('fr')].heroTitle, publicHomeCopy.es.heroTitle)
})

test('specialized public catalogs stay aligned and non-empty', () => {
  for (const catalog of [publicHomeCopy, publicOffersCopy, publicOfferToastCopy]) {
    const source = Object.keys(catalog.es).sort()
    for (const language of ['es', 'en', 'pt'] as const) {
      assert.deepEqual(Object.keys(catalog[language]).sort(), source)
      assert.equal(Object.values(catalog[language]).some((value) => !value.trim()), false)
    }
  }
})

test('communities, giveaway, and directory UI groups are present in every catalog', () => {
  const prefixes = ['communities.', 'giveaway.', 'directory.', 'broker.', 'exchange.']
  for (const prefix of prefixes) {
    const sourceKeys = Object.keys(publicUiCatalog.es).filter((key) => key.startsWith(prefix)).sort()
    assert.ok(sourceKeys.length > 0)
    for (const language of ['es', 'en', 'pt'] as const) {
      const messages = publicUiCatalog[language] as Record<string, string>
      assert.equal(sourceKeys.some((key) => !messages[key]?.trim()), false)
    }
  }
})

test('finder copy is complete and non-empty in every UI language', () => {
  const source = Object.keys(publicFinderCopy.es).sort()
  for (const copy of Object.values(publicFinderCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), source)
    assert.equal(copy.steps.length, 4)
    assert.equal(Object.values(copy.countries).some((value) => !value.trim()), false)
  }
})

test('localizes static and dynamic recommendation reasons without altering business values', () => {
  assert.equal(localizeFinderReason('Presupuesto compatible', 'en'), 'Budget compatible')
  assert.equal(localizeFinderReason('Opera CFD / Forex', 'pt'), 'Opera CFD / Forex')
  assert.equal(localizeFinderReason('Profit split de hasta 90%', 'en'), 'Profit split up to 90%')
  assert.equal(localizeFinderReason('Payout 5 días mediante Weekly · Stellar', 'en'), 'Payout 5 días via Weekly · Stellar')
  assert.equal(localizeFinderReason('Texto de Supabase', 'en'), 'Texto de Supabase')
})

test('comparator copy is complete and non-empty in every UI language', () => {
  const source = Object.keys(publicComparatorCopy.es).sort()
  for (const copy of Object.values(publicComparatorCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), source)
    assert.deepEqual(Object.keys(copy.priorities).sort(), Object.keys(publicComparatorCopy.es.priorities).sort())
  }
  assert.equal(publicTradingRuleCopy.es.weekendHolding, 'Mantener posiciones el fin de semana')
  assert.equal(publicTradingRuleCopy.en.weekendHolding, 'Weekend holding')
  assert.equal(publicTradingRuleCopy.pt.weekendHolding, 'Manter posições no fim de semana')
})

test('localizes comparator interpolations and dynamic engine output', () => {
  assert.equal(comparatorText(publicComparatorCopy.en.matchesEvaluable, { matched: 2, evaluable: 3 }), 'Matches 2 of 3 evaluable preferences')
  assert.equal(localizeComparatorOutput('Disponible en CO según las restricciones publicadas por la firma.', 'en'), 'Available in CO according to the restrictions published by the firm.')
  assert.equal(localizeComparatorOutput('Precio USD 99 dentro de tu presupuesto.', 'pt'), 'Preço USD 99 dentro do seu orçamento.')
  assert.equal(localizeComparatorOutput('FTMO: tamaño $10K frente a $25K.', 'en'), 'FTMO: size $10K versus $25K.')
  assert.equal(localizeComparatorOutput('Nombre oficial', 'en'), 'Nombre oficial')
})

test('localizes country names by ISO code while preserving safe fallbacks', () => {
  assert.equal(localizedCountryName('BR', 'Brasil', 'en'), 'Brazil')
  assert.equal(localizedCountryName('BR', 'Brasil', 'pt'), 'Brasil')
  assert.equal(localizedCountryName('US', 'Estados Unidos', 'es'), 'Estados Unidos')
  assert.equal(localizedCountryName('invalid', 'Original', 'en'), 'Original')
  assert.equal(localizedCountryName('', 'Sin país', 'pt'), 'Sin país')
})

test('country flag localizes visible and accessible country information', () => {
  const english = renderToStaticMarkup(createElement(CountryFlag, { countryCode: 'CO', countryName: 'Colombia', language: 'en', showName: true }))
  const portugueseMissing = renderToStaticMarkup(createElement(CountryFlag, { countryCode: null, language: 'pt' }))
  assert.match(english, /Colombia/)
  assert.match(english, /Country of origin: Colombia/)
  assert.match(portugueseMissing, /País de origem indisponível/)
})

test('promo code actions keep the resolved public language', () => {
  const english = renderToStaticMarkup(createElement(PromoCodeButton, { code: 'SAVE10', language: 'en' }))
  const portuguese = renderToStaticMarkup(createElement(PromoCodeButton, { code: 'SAVE10', language: 'pt' }))

  assert.match(english, /Copy code: SAVE10/)
  assert.match(english, />Copy</)
  assert.match(portuguese, /Copiar código: SAVE10/)
  assert.match(portuguese, />Copiar</)
})

test('editorial PageHero fallbacks are localized in every public language', () => {
  assert.equal(getPublicUi('es')('hero.propFirms.title'), 'Prop Firms para comparar con criterio.')
  assert.equal(getPublicUi('en')('hero.comparator.subtitle'), 'Compare real programs and account sizes based on how you trade.')
  assert.equal(getPublicUi('pt')('hero.blog.title'), 'Ideias, análises e recursos.')
  for (const language of ['es', 'en', 'pt'] as const) {
    const t = getPublicUi(language)
    for (const section of ['propFirms', 'brokers', 'exchanges', 'payouts', 'comparator', 'communities', 'blog', 'giveaway']) {
      assert.ok(t(`hero.${section}.title` as Parameters<typeof t>[0]).trim())
      assert.ok(t(`hero.${section}.subtitle` as Parameters<typeof t>[0]).trim())
    }
  }
})

test('offer fallbacks and dates use the resolved public language', () => {
  const offer = {
    id: 'offer', title: 'Official title', description: null, discountValue: 0, discountType: 'percentage',
    promoCode: null, countryCode: null, expiresAt: null, priority: 1, challengeName: null,
    includesFreeAccount: true, freeAccountLabel: null, isFeatured: false, hotBadge: null, shortHighlight: null,
    platform: { id: 'firm', name: 'Firm', slug: 'firm', logoUrl: null, logoAlt: null, markets: [] },
  } satisfies PublicOffer

  assert.equal(offerBenefit(offer, 'es'), 'Cuenta gratis')
  assert.equal(offerBenefit(offer, 'en'), 'Free account')
  assert.equal(offerBenefit(offer, 'pt'), 'Conta grátis')
  assert.equal(offerBenefit({ ...offer, includesFreeAccount: false }, 'en'), 'Active benefit')
  assert.notEqual(offerDateLabel('2026-01-15T12:00:00Z', 'es'), offerDateLabel('2026-01-15T12:00:00Z', 'en'))
})

test('firm profile copy is complete and supports dynamic labels in every UI language', () => {
  const source = Object.keys(publicFirmProfileCopy.es).sort()
  for (const copy of Object.values(publicFirmProfileCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), source)
    assert.deepEqual(Object.keys(copy.marketsMap).sort(), Object.keys(publicFirmProfileCopy.es.marketsMap).sort())
    assert.equal(Object.entries(copy).some(([key, value]) => key !== 'marketsMap' && typeof value === 'string' && !value.trim()), false)
  }
  assert.equal(firmProfileText(publicFirmProfileCopy.en.visit, { name: 'FTMO' }), 'Visit FTMO')
  assert.equal(firmProfileText(publicFirmProfileCopy.pt.phases, { count: 2 }), '2 fases')
  assert.equal(publicFirmProfileCopy.en.marketsMap.futures, 'Futures')
  assert.equal(firmProfileText(publicFirmProfileCopy.en.operatingFor, { count: 1 }), '1 year operating')
  assert.equal(firmProfileText(publicFirmProfileCopy.pt.operatingForPlural, { count: 4 }), '4 anos em operação')
  assert.equal(firmProfileText(publicFirmProfileCopy.es.payoutPoint, { count: 1 }), '1 payout')
  assert.equal(firmProfileText(publicFirmProfileCopy.en.payoutMetaDescription, { name: 'Firm X' }), 'Payout history, metrics, and activity for Firm X.')
})

test('broker profile copy is complete and maps stable market codes', () => {
  const source = Object.keys(publicBrokerProfileCopy.es).sort()
  for (const copy of Object.values(publicBrokerProfileCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), source)
    assert.deepEqual(Object.keys(copy.marketsMap).sort(), Object.keys(publicBrokerProfileCopy.es.marketsMap).sort())
    assert.equal(Object.entries(copy).some(([key, value]) => key !== 'marketsMap' && typeof value === 'string' && !value.trim()), false)
  }
  assert.equal(firmProfileText(publicBrokerProfileCopy.en.visit, { name: 'Broker X' }), 'Visit Broker X')
  assert.equal(publicBrokerProfileCopy.pt.marketsMap.options, 'Opções')
})

test('exchange profile copy is complete and maps stable enums', () => {
  const source = Object.keys(publicExchangeProfileCopy.es).sort()
  for (const copy of Object.values(publicExchangeProfileCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), source)
    assert.equal(Object.values(copy).some((value) => typeof value === 'string' && !value.trim()), false)
  }
  assert.equal(publicExchangeProfileCopy.en.decentralized, 'Decentralized')
  assert.equal(publicExchangeProfileCopy.pt.no, 'Não')
  assert.equal(firmProfileText(publicExchangeProfileCopy.en.visit, { name: 'Exchange X' }), 'Visit Exchange X')
})

test('calculator copy is complete and non-empty for every public UI language', () => {
  const source = Object.keys(publicCalculatorCopy.es).sort()
  for (const copy of Object.values(publicCalculatorCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), source)
    assert.equal(Object.values(copy).some((value) => !value.trim()), false)
  }
  assert.equal(publicCalculatorCopy.en.back, 'Back to calculators')
  assert.equal(publicCalculatorCopy.pt.notFound, 'Calculadora não encontrada')
})

test('calculator results use regional currency and percentage formats', () => {
  const compact = (value: string) => value.replace(/\s/g, '')
  assert.equal(compact(calculatorMoney(1234.5, 'en')), '$1,234.50')
  assert.match(compact(calculatorMoney(1234.5, 'es')), /1\.234,50/)
  assert.match(compact(calculatorMoney(1234.5, 'pt')), /1\.234,50/)
  assert.equal(compact(calculatorPercentage(12.5, 'en')), '12.5%')
  assert.equal(compact(calculatorPercentage(12.5, 'es')), '12,5%')
  assert.equal(compact(calculatorPercentage(12.5, 'pt')), '12,5%')
})
