import type { PublicLanguage } from '@/lib/public-language'

const esMessages = {
  'a11y.home': 'Tradagora, inicio',
  'a11y.mainNavigation': 'Navegación principal',
  'a11y.mobileNavigation': 'Navegación móvil',
  'a11y.openNavigation': 'Abrir navegación',
  'a11y.closeNavigation': 'Cerrar navegación',
  'a11y.language': 'Idioma',
  'a11y.action': 'Acción',
  'a11y.viewFirm': 'Ver {name}',
  'a11y.viewPayouts': 'Ver payouts de {name}',
  'common.all': 'Todas',
  'common.apply': 'Aplicar',
  'common.back': 'Volver',
  'common.cancel': 'Cancelar',
  'common.clearFilters': 'Limpiar filtros',
  'common.close': 'Cerrar',
  'common.copy': 'Copiar',
  'common.copied': 'Copiado',
  'common.details': 'Ver detalle',
  'common.externalLink': 'Abrir enlace externo',
  'common.learnMore': 'Ver más',
  'common.loading': 'Cargando…',
  'common.name': 'Nombre',
  'common.noData': 'Sin datos',
  'common.notAvailable': 'No disponible',
  'common.pending': 'Pendiente',
  'common.readMore': 'Leer más',
  'common.search': 'Buscar',
  'common.unknown': 'Sin verificar',
  'common.visit': 'Visitar',
  'common.yes': 'Sí',
  'common.no': 'No',
  'common.withOffer': 'Con oferta',
  'common.noPublished': 'Todavía no hay contenido publicado.',
  'go.platformNotFound': 'No encontramos la plataforma solicitada: {slug}.',
  'go.offerUnavailable': 'La oferta no está disponible.',
  'go.noAffiliateLink': 'No hay un enlace de afiliado activo para {name}.',
  'nav.payouts': 'Payouts',
  'nav.propFirms': 'Prop Firms',
  'nav.comparator': 'Comparador',
  'nav.offers': 'Ofertas',
  'nav.brokers': 'Brokers',
  'nav.tools': 'Herramientas',
  'nav.calculators': 'Calculadoras',
  'nav.communities': 'Comunidades',
  'nav.exchanges': 'Exchanges',
  'nav.blog': 'Blog',
  'nav.giveaway': 'Giveaway',
  'nav.methodology': 'Metodología',
  'nav.exploreFirms': 'Explorar firmas',
  'footer.description': 'Información comparativa para traders. Verifica siempre las condiciones oficiales.',
  'footer.explore': 'Explorar',
  'footer.discover': 'Descubrir',
  'footer.transparency': 'Transparencia',
  'footer.verifiableSources': 'Fuentes verificables',
  'footer.sourcedData': 'Datos con fuente',
  'footer.continuousUpdates': 'Actualización continua',
  'footer.region': 'Hecho para traders de Latinoamérica.',
  'search.placeholder': 'Buscar en Tradagora',
  'search.empty': 'No encontramos resultados',
  'search.clear': 'Limpiar búsqueda',
  'search.type.propFirm': 'Prop Firm',
  'search.type.broker': 'Broker',
  'search.type.exchange': 'Exchange',
  'search.type.tool': 'Herramienta',
  'search.type.calculator': 'Calculadora',
  'directory.searchFirm': 'Buscar Prop Firm',
  'directory.new': 'Nuevas',
  'directory.popularity': 'Popularidad',
  'directory.firm': 'Firma',
  'directory.country': 'País',
  'directory.operation': 'Operación',
  'directory.markets': 'Mercados / activos',
  'directory.marketsShort': 'Mercados',
  'directory.profitSplit': 'Profit split',
  'directory.newNotice': 'Las firmas nuevas pueden tener un historial limitado. Revisa sus condiciones, regulación y experiencia de usuarios antes de operar.',
  'directory.noSearchResults': 'No encontramos firmas que coincidan con «{query}».',
  'directory.noFilterResults': 'No encontramos firmas con estos filtros.',
  'directory.upTo': 'Hasta {value}%',
  'directory.year': 'año',
  'directory.years': 'años',
  'directory.operating': 'operando',
  'directory.informationPending': 'Información pendiente',
  'market.unconfirmed': 'Mercado sin confirmar',
  'market.options': 'Opciones',
  'payout.period': 'Periodo de payouts',
  'payout.hours24': '24 horas',
  'payout.allTime': 'Todo el tiempo',
  'payout.total': 'Total',
  'payout.count': 'Payouts',
  'payout.largest': 'Mayor',
  'payout.average': 'Promedio',
  'payout.noFilterResults': 'No encontramos firmas con estos filtros.',
  'payout.verified': 'Verificado por Tradagora',
  'payout.external': 'Fuente externa',
  'payout.externalKnown': 'Datos externos conocidos',
  'payout.firmReported': 'Reportado por la firma',
  'payout.noKnownTotal': 'Sin total conocido',
  'payout.noComparableTotal': 'Sin total comparable',
  'payout.exceedsKnown': 'El volumen verificado supera el último snapshot externo.',
  'payout.externalReference': 'Referencia externa',
  'payout.externalReferenceHelp': 'Los datos externos de referencia se mantienen separados del volumen verificado directamente por Tradagora.',
  'payout.insufficientData': 'Sin datos suficientes para este periodo.',
  'payout.dailyActivity': 'Actividad diaria registrada',
  'payout.noSource': 'Sin fuente',
  'payout.live': 'En vivo',
  'payout.enableMotion': 'Activar movimiento',
  'payout.activityPlaceholder': 'La actividad verificada aparecerá aquí.',
  'payout.verifiedItem': 'Payout verificado',
  'payout.days30': '30 días',
  'payout.history': 'Histórico',
  'payout.highestAmount': 'Mayor monto pagado',
  'payout.highestCount': 'Mayor número de payouts',
  'payout.noPeriodData': 'Sin datos disponibles para este período.',
  'payout.externalSnapshots': 'Datos externos agregados · snapshots actuales del período seleccionado.',
  'payout.heading': 'Payouts · {period}',
  'payout.methodologyBadge': 'Verificación',
  'payout.methodologyTitle': 'Cómo verificamos los payouts',
  'payout.methodologySubtitle': 'Contrastamos fuentes y registros on-chain.',
  'payout.source.blockchain': 'Blockchain verificado',
  'payout.source.verifiedApi': 'API verificada',
  'payout.source.officialApi': 'API oficial',
  'payout.source.thirdPartyApi': 'API de tercero',
  'payout.source.officialFirm': 'Fuente oficial',
  'payout.source.externalPublic': 'Fuente pública externa',
  'payout.source.manual': 'Carga manual',
  'filter.allMarkets': 'Todos los mercados',
  'filter.sortTotal': 'Ordenar por total',
  'filter.sortCount': 'Ordenar por payouts',
  'filter.sortLargest': 'Ordenar por mayor payout',
  'filter.sortAverage': 'Ordenar por promedio',
  'filter.searchFirm': 'Buscar firma',
  'broker.featured': 'Brokers destacados',
  'broker.editorialSelection': 'Selección editorial',
  'broker.minimumDeposit': 'Depósito mínimo',
  'broker.regulation': 'Regulación',
  'broker.unverifiedMarkets': 'Mercados sin verificar',
  'broker.search': 'Buscar broker',
  'broker.noResults': 'No encontramos brokers con estos filtros.',
  'broker.noPublished': 'Todavía no hay brokers publicados.',
  'broker.offer': 'Oferta',
  'exchange.products': 'Productos',
  'exchange.fiatSupport': 'Soporte fiat',
  'exchange.type': 'Tipo',
  'exchange.search': 'Buscar exchange',
  'exchange.centralized': 'Centralizado',
  'exchange.decentralized': 'Descentralizado',
  'exchange.noPublished': 'Todavía no hay exchanges publicados.',
  'detail.since': 'Desde {year}',
  'detail.summary': 'Resumen',
  'detail.generalInformation': 'Información general',
  'detail.noVerifiedDescription': 'Sin descripción verificada.',
  'detail.checkSource': 'Consultar fuente',
  'detail.activeOffers': 'Ofertas activas',
  'detail.viewOffer': 'Ver oferta',
  'detail.essentialInformation': 'Información esencial',
  'detail.founded': 'Fundación',
  'detail.visitWebsite': 'Visitar sitio',
  'detail.country': 'País',
  'detail.markets': 'Mercados',
  'detail.platforms': 'Plataformas',
  'detail.minimumDeposit': 'Depósito mínimo',
  'detail.regulation': 'Regulación',
  'detail.officialSource': 'Consultar fuente oficial',
  'detail.activePromotion': 'Promoción activa',
  'detail.applyOffer': 'Aplicar oferta',
  'offers.search': 'Buscar ofertas o firmas',
  'offers.empty': 'No encontramos ofertas con estos filtros.',
  'offers.code': 'Código',
  'offers.copyCode': 'Copiar código',
  'offers.expires': 'Vence {date}',
  'offers.noExpiry': 'Sin fecha de vencimiento',
  'offers.available': 'Oferta disponible',
  'offers.view': 'Ver oferta',
  'offers.freeAccount': 'Cuenta gratis',
  'offers.activeBenefit': 'Beneficio activo',
  'hero.propFirms.title': 'Prop Firms para comparar con criterio.',
  'hero.propFirms.subtitle': 'Busca, filtra y compara firmas antes de elegir.',
  'hero.brokers.title': 'Brokers para operar con criterio.',
  'hero.brokers.subtitle': 'Compara información esencial antes de elegir.',
  'hero.exchanges.title': 'Activos digitales, con criterio.',
  'hero.exchanges.subtitle': 'Plataformas para comprar, vender y operar activos digitales.',
  'hero.payouts.title': 'Ranking de payouts de Prop Firms.',
  'hero.payouts.subtitle': 'Explora las cifras de payouts de las principales Prop Firms. Los datos de referencia provienen de seguimiento externo y pueden consultarse por periodo.',
  'hero.comparator.title': 'Comparador de Prop Firms',
  'hero.comparator.subtitle': 'Compara programas y tamaños reales según tu forma de operar.',
  'hero.communities.title': 'Espacios para aprender y conectar.',
  'hero.communities.subtitle': 'Encuentra comunidades relevantes para traders.',
  'hero.blog.title': 'Ideas, análisis y recursos.',
  'hero.blog.subtitle': 'Contenido editorial para traders.',
  'hero.giveaway.title': 'Giveaways para la comunidad.',
  'hero.giveaway.subtitle': 'Consulta campañas activas y sus condiciones.',
  'blog.empty': 'No hay artículos publicados por ahora.',
  'blog.article': 'Artículo',
  'blog.back': 'Volver al blog',
  'blog.featured': 'Destacado',
  'blog.editorialSelection': 'Selección editorial',
  'blog.search': 'Buscar artículos',
  'blog.noResults': 'No encontramos artículos con estos filtros.',
  'blog.noDate': 'Sin fecha',
  'communities.empty': 'No hay comunidades publicadas por ahora.',
  'communities.featured': 'Comunidades destacadas',
  'communities.editorialSelection': 'Selección editorial',
  'communities.search': 'Buscar comunidades',
  'communities.noResults': 'No encontramos comunidades con estos filtros.',
  'communities.fallbackDescription': 'Comunidad para traders.',
  'communities.join': 'Unirme',
  'communities.type.forum': 'Foro',
  'communities.type.other': 'Otra',
  'giveaway.empty': 'No hay giveaways publicados por ahora.',
  'giveaway.history': 'Histórico',
  'giveaway.previous': 'Giveaways anteriores',
  'giveaway.ended': 'Finalizado',
  'giveaway.brand': 'Giveaway de Tradagora',
  'giveaway.participate': 'Participar ahora',
  'giveaway.rules': 'Ver reglas',
  'giveaway.resultsSoon': 'Resultados próximamente',
  'giveaway.days': 'Días',
  'giveaway.hours': 'Horas',
  'giveaway.minutes': 'Min',
  'giveaway.seconds': 'Seg',
  'tools.empty': 'No encontramos herramientas con estos filtros.',
  'tools.use': 'Usar herramienta',
  'tools.visit': 'Visitar herramienta',
  'tools.free': 'Gratis',
  'tools.paid': 'De pago',
  'tools.freePlan': 'Plan gratuito',
  'calculators.use': 'Usar calculadora',
  'calculators.back': 'Volver a calculadoras',
  'calculators.note': 'Los resultados son estimaciones educativas y no constituyen asesoría financiera.',
  'hero.tools.badge': 'Herramientas',
  'hero.tools.title': 'Herramientas de trading',
  'hero.tools.subtitle': 'Descubre plataformas, datos, indicadores y recursos útiles para mejorar tu operativa.',
  'hero.calculators.badge': 'Calculadoras',
  'hero.calculators.title': 'Calculadoras de trading',
  'hero.calculators.subtitle': 'Utilidades propias de Tradagora para estimar riesgo, objetivos y distribución de ganancias.',
  'placeholder.comingSoon': 'Próximamente',
  'placeholder.ready': 'Sección preparada',
  'placeholder.description': 'La navegación y el contenido administrable ya están disponibles. Los módulos de datos específicos se incorporarán aquí sin recargar la portada.',
  'calculator.calculate': 'Calcular',
  'calculator.reset': 'Restablecer',
  'calculator.result': 'Resultado',
  'calculator.accountSize': 'Tamaño de cuenta',
  'calculator.currentBalance': 'Balance actual',
  'calculator.drawdown': 'Drawdown',
  'calculator.profit': 'Ganancia',
  'calculator.target': 'Objetivo',
  'calculator.split': 'Profit split',
  'calculator.traderReceives': 'El trader recibe',
  'calculator.firmReceives': 'La firma recibe',
  'finder.start': 'Encontrar mi Prop Firm',
  'finder.next': 'Siguiente',
  'finder.previous': 'Anterior',
  'finder.results': 'Resultados',
  'finder.noResults': 'No encontramos coincidencias exactas. Prueba con criterios menos restrictivos.',
  'availability.available': 'Disponible',
  'availability.restricted': 'Restringida',
  'availability.unknown': 'Sin dato verificado',
  'availability.warning': 'Restricción documentada',
  'country.question': '¿Cuál es tu país?',
  'country.reason': 'Lo usamos para comprobar las restricciones publicadas por cada firma.',
  'country.frequent': 'Países frecuentes',
  'country.searchOther': 'Buscar otro país',
  'country.remove': 'Quitar país',
  'country.choose': 'Elige tu país',
  'country.search': 'Buscar por país o código',
  'country.results': 'Resultados de países',
  'country.notFound': 'No encontramos ese país.',
  'country.origin': 'País de origen',
  'country.unavailable': 'País de origen no disponible',
} as const

export type PublicUiKey = keyof typeof esMessages
type PublicUiMessages = Record<PublicUiKey, string>

const enMessages = {
  'a11y.home': 'Tradagora, home', 'a11y.mainNavigation': 'Main navigation', 'a11y.mobileNavigation': 'Mobile navigation', 'a11y.openNavigation': 'Open navigation', 'a11y.closeNavigation': 'Close navigation', 'a11y.language': 'Language', 'a11y.action': 'Action', 'a11y.viewFirm': 'View {name}', 'a11y.viewPayouts': 'View payouts for {name}',
  'common.all': 'All', 'common.apply': 'Apply', 'common.back': 'Back', 'common.cancel': 'Cancel', 'common.clearFilters': 'Clear filters', 'common.close': 'Close', 'common.copy': 'Copy', 'common.copied': 'Copied', 'common.details': 'View details', 'common.externalLink': 'Open external link', 'common.learnMore': 'Learn more', 'common.loading': 'Loading…', 'common.name': 'Name', 'common.noData': 'No data', 'common.notAvailable': 'Not available', 'common.pending': 'Pending', 'common.readMore': 'Read more', 'common.search': 'Search', 'common.unknown': 'Unverified', 'common.visit': 'Visit', 'common.yes': 'Yes', 'common.no': 'No', 'common.withOffer': 'With offer', 'common.noPublished': 'No content has been published yet.',
  'go.platformNotFound': 'The requested platform was not found: {slug}.', 'go.offerUnavailable': 'The offer is unavailable.', 'go.noAffiliateLink': 'There is no active affiliate link for {name}.',
  'nav.payouts': 'Payouts', 'nav.propFirms': 'Prop Firms', 'nav.comparator': 'Compare', 'nav.offers': 'Offers', 'nav.brokers': 'Brokers', 'nav.tools': 'Tools', 'nav.calculators': 'Calculators', 'nav.communities': 'Communities', 'nav.exchanges': 'Exchanges', 'nav.blog': 'Blog', 'nav.giveaway': 'Giveaway', 'nav.methodology': 'Methodology', 'nav.exploreFirms': 'Explore firms',
  'footer.description': 'Comparative information for traders. Always verify the official terms.', 'footer.explore': 'Explore', 'footer.discover': 'Discover', 'footer.transparency': 'Transparency', 'footer.verifiableSources': 'Verifiable sources', 'footer.sourcedData': 'Sourced data', 'footer.continuousUpdates': 'Continuously updated', 'footer.region': 'Built for traders in Latin America.',
  'search.placeholder': 'Search Tradagora', 'search.empty': 'No results found', 'search.clear': 'Clear search', 'search.type.propFirm': 'Prop Firm', 'search.type.broker': 'Broker', 'search.type.exchange': 'Exchange', 'search.type.tool': 'Tool', 'search.type.calculator': 'Calculator',
  'directory.searchFirm': 'Search Prop Firm', 'directory.new': 'New', 'directory.popularity': 'Popularity', 'directory.firm': 'Firm', 'directory.country': 'Country', 'directory.operation': 'Operating history', 'directory.markets': 'Markets / assets', 'directory.marketsShort': 'Markets', 'directory.profitSplit': 'Profit split', 'directory.newNotice': 'New firms may have limited history. Review their terms, regulation, and user experience before trading.', 'directory.noSearchResults': 'No firms match “{query}”.', 'directory.noFilterResults': 'No firms match these filters.', 'directory.upTo': 'Up to {value}%', 'directory.year': 'year', 'directory.years': 'years', 'directory.operating': 'in operation', 'directory.informationPending': 'Information pending', 'market.unconfirmed': 'Market not confirmed', 'market.options': 'Options',
  'payout.period': 'Payout period', 'payout.hours24': '24 hours', 'payout.allTime': 'All time', 'payout.total': 'Total', 'payout.count': 'Payouts', 'payout.largest': 'Largest', 'payout.average': 'Average', 'payout.noFilterResults': 'No firms match these filters.', 'payout.verified': 'Verified by Tradagora', 'payout.external': 'External source', 'payout.externalKnown': 'Known external data', 'payout.firmReported': 'Reported by the firm', 'payout.noKnownTotal': 'No known total', 'payout.noComparableTotal': 'No comparable total', 'payout.exceedsKnown': 'Verified volume exceeds the latest external snapshot.', 'payout.externalReference': 'External reference', 'payout.externalReferenceHelp': 'External reference data remains separate from volume directly verified by Tradagora.', 'payout.insufficientData': 'Not enough data for this period.', 'payout.dailyActivity': 'Recorded daily activity', 'payout.noSource': 'No source', 'payout.live': 'Live', 'payout.enableMotion': 'Enable motion', 'payout.activityPlaceholder': 'Verified activity will appear here.', 'payout.verifiedItem': 'Verified payout', 'payout.heading': 'Payouts · {period}', 'payout.methodologyBadge': 'Verification', 'payout.methodologyTitle': 'How we verify payouts', 'payout.methodologySubtitle': 'We cross-check sources and on-chain records.', 'payout.source.blockchain': 'Verified blockchain', 'payout.source.verifiedApi': 'Verified API', 'payout.source.officialApi': 'Official API', 'payout.source.thirdPartyApi': 'Third-party API', 'payout.source.officialFirm': 'Official source', 'payout.source.externalPublic': 'External public source', 'payout.source.manual': 'Manual entry',
  'filter.allMarkets': 'All markets', 'filter.sortTotal': 'Sort by total', 'filter.sortCount': 'Sort by payouts', 'filter.sortLargest': 'Sort by largest payout', 'filter.sortAverage': 'Sort by average', 'filter.searchFirm': 'Search firm',
  'broker.featured': 'Featured brokers', 'broker.editorialSelection': 'Editorial selection', 'broker.minimumDeposit': 'Minimum deposit', 'broker.regulation': 'Regulation', 'broker.unverifiedMarkets': 'Markets not verified', 'broker.search': 'Search brokers', 'broker.noResults': 'No brokers match these filters.', 'broker.noPublished': 'No brokers have been published yet.', 'broker.offer': 'Offer', 'exchange.products': 'Products', 'exchange.fiatSupport': 'Fiat support', 'exchange.type': 'Type', 'exchange.search': 'Search exchanges', 'exchange.centralized': 'Centralized', 'exchange.decentralized': 'Decentralized', 'exchange.noPublished': 'No exchanges have been published yet.',
  'detail.since': 'Since {year}', 'detail.summary': 'Overview', 'detail.generalInformation': 'General information', 'detail.noVerifiedDescription': 'No verified description.', 'detail.checkSource': 'Check source', 'detail.activeOffers': 'Active offers', 'detail.viewOffer': 'View offer', 'detail.essentialInformation': 'Essential information', 'detail.founded': 'Founded', 'detail.visitWebsite': 'Visit website', 'detail.country': 'Country', 'detail.markets': 'Markets', 'detail.platforms': 'Platforms', 'detail.minimumDeposit': 'Minimum deposit', 'detail.regulation': 'Regulation', 'detail.officialSource': 'Check official source', 'detail.activePromotion': 'Active promotion', 'detail.applyOffer': 'Apply offer',
  'offers.search': 'Search offers or firms', 'offers.empty': 'No offers match these filters.', 'offers.code': 'Code', 'offers.copyCode': 'Copy code', 'offers.expires': 'Expires {date}', 'offers.noExpiry': 'No expiry date', 'offers.available': 'Offer available', 'offers.view': 'View offer', 'offers.freeAccount': 'Free account', 'offers.activeBenefit': 'Active benefit',
  'hero.propFirms.title': 'Prop Firms to compare with confidence.', 'hero.propFirms.subtitle': 'Search, filter, and compare firms before choosing.', 'hero.brokers.title': 'Brokers for informed trading.', 'hero.brokers.subtitle': 'Compare essential information before choosing.', 'hero.exchanges.title': 'Digital assets, approached with confidence.', 'hero.exchanges.subtitle': 'Platforms for buying, selling, and trading digital assets.', 'hero.payouts.title': 'Prop Firm payout rankings.', 'hero.payouts.subtitle': 'Explore payout figures from leading Prop Firms. Reference data comes from external tracking and can be viewed by period.', 'hero.comparator.title': 'Prop Firm Comparator', 'hero.comparator.subtitle': 'Compare real programs and account sizes based on how you trade.', 'hero.communities.title': 'Spaces to learn and connect.', 'hero.communities.subtitle': 'Find relevant communities for traders.', 'hero.blog.title': 'Ideas, analysis, and resources.', 'hero.blog.subtitle': 'Editorial content for traders.', 'hero.giveaway.title': 'Giveaways for the community.', 'hero.giveaway.subtitle': 'Browse active campaigns and their terms.',
  'blog.empty': 'No articles have been published yet.', 'blog.article': 'Article', 'blog.back': 'Back to blog', 'blog.featured': 'Featured', 'blog.editorialSelection': 'Editorial selection', 'blog.search': 'Search articles', 'blog.noResults': 'No articles match these filters.', 'blog.noDate': 'No date', 'communities.empty': 'No communities have been published yet.', 'communities.featured': 'Featured communities', 'communities.editorialSelection': 'Editorial selection', 'communities.search': 'Search communities', 'communities.noResults': 'No communities match these filters.', 'communities.fallbackDescription': 'A community for traders.', 'communities.join': 'Join', 'communities.type.forum': 'Forum', 'communities.type.other': 'Other', 'giveaway.empty': 'No giveaways are currently published.', 'giveaway.history': 'History', 'giveaway.previous': 'Previous giveaways', 'giveaway.ended': 'Ended', 'giveaway.brand': 'Tradagora Giveaway', 'giveaway.participate': 'Join now', 'giveaway.rules': 'View rules', 'giveaway.resultsSoon': 'Results coming soon', 'giveaway.days': 'Days', 'giveaway.hours': 'Hours', 'giveaway.minutes': 'Min', 'giveaway.seconds': 'Sec',
  'tools.empty': 'No tools match these filters.', 'tools.use': 'Use tool', 'tools.visit': 'Visit tool', 'tools.free': 'Free', 'tools.paid': 'Paid', 'tools.freePlan': 'Free plan', 'calculators.use': 'Use calculator', 'calculators.back': 'Back to calculators', 'calculators.note': 'Results are educational estimates and do not constitute financial advice.', 'hero.tools.badge': 'Tools', 'hero.tools.title': 'Trading tools', 'hero.tools.subtitle': 'Discover platforms, data, indicators, and resources that can support your trading workflow.', 'hero.calculators.badge': 'Calculators', 'hero.calculators.title': 'Trading calculators', 'hero.calculators.subtitle': 'Tradagora utilities for estimating risk, targets, and payout splits.', 'placeholder.comingSoon': 'Coming soon', 'placeholder.ready': 'Section ready', 'placeholder.description': 'Navigation and managed content are available. Specific data modules will be added here without overloading the home page.',
  'calculator.calculate': 'Calculate', 'calculator.reset': 'Reset', 'calculator.result': 'Result', 'calculator.accountSize': 'Account size', 'calculator.currentBalance': 'Current balance', 'calculator.drawdown': 'Drawdown', 'calculator.profit': 'Profit', 'calculator.target': 'Target', 'calculator.split': 'Profit split', 'calculator.traderReceives': 'Trader receives', 'calculator.firmReceives': 'Firm receives',
  'finder.start': 'Find my Prop Firm', 'finder.next': 'Next', 'finder.previous': 'Previous', 'finder.results': 'Results', 'finder.noResults': 'No exact matches found. Try less restrictive criteria.',
  'availability.available': 'Available', 'availability.restricted': 'Restricted', 'availability.unknown': 'No verified data', 'availability.warning': 'Documented restriction', 'country.question': 'What is your country?', 'country.reason': 'We use it to check the restrictions published by each firm.', 'country.frequent': 'Frequent countries', 'country.searchOther': 'Search another country', 'country.remove': 'Remove country', 'country.choose': 'Choose your country', 'country.search': 'Search by country or code', 'country.results': 'Country results', 'country.notFound': 'We could not find that country.', 'country.origin': 'Country of origin', 'country.unavailable': 'Country of origin unavailable',
  'payout.days30': '30 days', 'payout.history': 'History', 'payout.highestAmount': 'Highest amount paid', 'payout.highestCount': 'Highest payout count', 'payout.noPeriodData': 'No data available for this period.', 'payout.externalSnapshots': 'Aggregated external data · current snapshots for the selected period.',
} satisfies PublicUiMessages

const ptMessages = {
  'a11y.home': 'Tradagora, início', 'a11y.mainNavigation': 'Navegação principal', 'a11y.mobileNavigation': 'Navegação móvel', 'a11y.openNavigation': 'Abrir navegação', 'a11y.closeNavigation': 'Fechar navegação', 'a11y.language': 'Idioma', 'a11y.action': 'Ação', 'a11y.viewFirm': 'Ver {name}', 'a11y.viewPayouts': 'Ver payouts de {name}',
  'common.all': 'Todas', 'common.apply': 'Aplicar', 'common.back': 'Voltar', 'common.cancel': 'Cancelar', 'common.clearFilters': 'Limpar filtros', 'common.close': 'Fechar', 'common.copy': 'Copiar', 'common.copied': 'Copiado', 'common.details': 'Ver detalhes', 'common.externalLink': 'Abrir link externo', 'common.learnMore': 'Ver mais', 'common.loading': 'Carregando…', 'common.name': 'Nome', 'common.noData': 'Sem dados', 'common.notAvailable': 'Não disponível', 'common.pending': 'Pendente', 'common.readMore': 'Ler mais', 'common.search': 'Buscar', 'common.unknown': 'Não verificado', 'common.visit': 'Visitar', 'common.yes': 'Sim', 'common.no': 'Não', 'common.withOffer': 'Com oferta', 'common.noPublished': 'Ainda não há conteúdo publicado.',
  'go.platformNotFound': 'A plataforma solicitada não foi encontrada: {slug}.', 'go.offerUnavailable': 'A oferta não está disponível.', 'go.noAffiliateLink': 'Não há um link de afiliado ativo para {name}.',
  'nav.payouts': 'Payouts', 'nav.propFirms': 'Prop Firms', 'nav.comparator': 'Comparador', 'nav.offers': 'Ofertas', 'nav.brokers': 'Brokers', 'nav.tools': 'Ferramentas', 'nav.calculators': 'Calculadoras', 'nav.communities': 'Comunidades', 'nav.exchanges': 'Exchanges', 'nav.blog': 'Blog', 'nav.giveaway': 'Giveaway', 'nav.methodology': 'Metodologia', 'nav.exploreFirms': 'Explorar firmas',
  'footer.description': 'Informações comparativas para traders. Verifique sempre as condições oficiais.', 'footer.explore': 'Explorar', 'footer.discover': 'Descobrir', 'footer.transparency': 'Transparência', 'footer.verifiableSources': 'Fontes verificáveis', 'footer.sourcedData': 'Dados com fonte', 'footer.continuousUpdates': 'Atualização contínua', 'footer.region': 'Feito para traders da América Latina.',
  'search.placeholder': 'Buscar na Tradagora', 'search.empty': 'Nenhum resultado encontrado', 'search.clear': 'Limpar busca', 'search.type.propFirm': 'Prop Firm', 'search.type.broker': 'Broker', 'search.type.exchange': 'Exchange', 'search.type.tool': 'Ferramenta', 'search.type.calculator': 'Calculadora',
  'directory.searchFirm': 'Buscar Prop Firm', 'directory.new': 'Novas', 'directory.popularity': 'Popularidade', 'directory.firm': 'Firma', 'directory.country': 'País', 'directory.operation': 'Operação', 'directory.markets': 'Mercados / ativos', 'directory.marketsShort': 'Mercados', 'directory.profitSplit': 'Profit split', 'directory.newNotice': 'Firmas novas podem ter um histórico limitado. Revise suas condições, regulamentação e experiência dos usuários antes de operar.', 'directory.noSearchResults': 'Nenhuma firma corresponde a “{query}”.', 'directory.noFilterResults': 'Nenhuma firma corresponde a estes filtros.', 'directory.upTo': 'Até {value}%', 'directory.year': 'ano', 'directory.years': 'anos', 'directory.operating': 'em operação', 'directory.informationPending': 'Informação pendente', 'market.unconfirmed': 'Mercado não confirmado', 'market.options': 'Opções',
  'payout.period': 'Período de payouts', 'payout.hours24': '24 horas', 'payout.allTime': 'Todo o período', 'payout.total': 'Total', 'payout.count': 'Payouts', 'payout.largest': 'Maior', 'payout.average': 'Média', 'payout.noFilterResults': 'Nenhuma firma corresponde a estes filtros.', 'payout.verified': 'Verificado pela Tradagora', 'payout.external': 'Fonte externa', 'payout.externalKnown': 'Dados externos conhecidos', 'payout.firmReported': 'Reportado pela firma', 'payout.noKnownTotal': 'Sem total conhecido', 'payout.noComparableTotal': 'Sem total comparável', 'payout.exceedsKnown': 'O volume verificado supera o último snapshot externo.', 'payout.externalReference': 'Referência externa', 'payout.externalReferenceHelp': 'Os dados externos de referência permanecem separados do volume verificado diretamente pela Tradagora.', 'payout.insufficientData': 'Dados insuficientes para este período.', 'payout.dailyActivity': 'Atividade diária registrada', 'payout.noSource': 'Sem fonte', 'payout.live': 'Ao vivo', 'payout.enableMotion': 'Ativar movimento', 'payout.activityPlaceholder': 'A atividade verificada aparecerá aqui.', 'payout.verifiedItem': 'Payout verificado', 'payout.heading': 'Payouts · {period}', 'payout.methodologyBadge': 'Verificação', 'payout.methodologyTitle': 'Como verificamos os payouts', 'payout.methodologySubtitle': 'Comparamos fontes e registros on-chain.', 'payout.source.blockchain': 'Blockchain verificado', 'payout.source.verifiedApi': 'API verificada', 'payout.source.officialApi': 'API oficial', 'payout.source.thirdPartyApi': 'API de terceiros', 'payout.source.officialFirm': 'Fonte oficial', 'payout.source.externalPublic': 'Fonte pública externa', 'payout.source.manual': 'Carga manual',
  'filter.allMarkets': 'Todos os mercados', 'filter.sortTotal': 'Ordenar por total', 'filter.sortCount': 'Ordenar por payouts', 'filter.sortLargest': 'Ordenar por maior payout', 'filter.sortAverage': 'Ordenar por média', 'filter.searchFirm': 'Buscar firma',
  'broker.featured': 'Brokers em destaque', 'broker.editorialSelection': 'Seleção editorial', 'broker.minimumDeposit': 'Depósito mínimo', 'broker.regulation': 'Regulamentação', 'broker.unverifiedMarkets': 'Mercados não verificados', 'broker.search': 'Buscar broker', 'broker.noResults': 'Nenhum broker corresponde a estes filtros.', 'broker.noPublished': 'Ainda não há brokers publicados.', 'broker.offer': 'Oferta', 'exchange.products': 'Produtos', 'exchange.fiatSupport': 'Suporte a fiat', 'exchange.type': 'Tipo', 'exchange.search': 'Buscar exchange', 'exchange.centralized': 'Centralizado', 'exchange.decentralized': 'Descentralizado', 'exchange.noPublished': 'Ainda não há exchanges publicados.',
  'detail.since': 'Desde {year}', 'detail.summary': 'Resumo', 'detail.generalInformation': 'Informações gerais', 'detail.noVerifiedDescription': 'Sem descrição verificada.', 'detail.checkSource': 'Consultar fonte', 'detail.activeOffers': 'Ofertas ativas', 'detail.viewOffer': 'Ver oferta', 'detail.essentialInformation': 'Informações essenciais', 'detail.founded': 'Fundação', 'detail.visitWebsite': 'Visitar site', 'detail.country': 'País', 'detail.markets': 'Mercados', 'detail.platforms': 'Plataformas', 'detail.minimumDeposit': 'Depósito mínimo', 'detail.regulation': 'Regulamentação', 'detail.officialSource': 'Consultar fonte oficial', 'detail.activePromotion': 'Promoção ativa', 'detail.applyOffer': 'Aplicar oferta',
  'offers.search': 'Buscar ofertas ou firmas', 'offers.empty': 'Nenhuma oferta corresponde a estes filtros.', 'offers.code': 'Código', 'offers.copyCode': 'Copiar código', 'offers.expires': 'Expira em {date}', 'offers.noExpiry': 'Sem data de expiração', 'offers.available': 'Oferta disponível', 'offers.view': 'Ver oferta', 'offers.freeAccount': 'Conta grátis', 'offers.activeBenefit': 'Benefício ativo',
  'hero.propFirms.title': 'Prop Firms para comparar com critério.', 'hero.propFirms.subtitle': 'Busque, filtre e compare firmas antes de escolher.', 'hero.brokers.title': 'Brokers para operar com critério.', 'hero.brokers.subtitle': 'Compare informações essenciais antes de escolher.', 'hero.exchanges.title': 'Ativos digitais, com critério.', 'hero.exchanges.subtitle': 'Plataformas para comprar, vender e operar ativos digitais.', 'hero.payouts.title': 'Ranking de payouts de Prop Firms.', 'hero.payouts.subtitle': 'Explore os números de payouts das principais Prop Firms. Os dados de referência vêm de acompanhamento externo e podem ser consultados por período.', 'hero.comparator.title': 'Comparador de Prop Firms', 'hero.comparator.subtitle': 'Compare programas e tamanhos reais de acordo com sua forma de operar.', 'hero.communities.title': 'Espaços para aprender e se conectar.', 'hero.communities.subtitle': 'Encontre comunidades relevantes para traders.', 'hero.blog.title': 'Ideias, análises e recursos.', 'hero.blog.subtitle': 'Conteúdo editorial para traders.', 'hero.giveaway.title': 'Giveaways para a comunidade.', 'hero.giveaway.subtitle': 'Consulte campanhas ativas e suas condições.',
  'blog.empty': 'Ainda não há artigos publicados.', 'blog.article': 'Artigo', 'blog.back': 'Voltar ao blog', 'blog.featured': 'Destaque', 'blog.editorialSelection': 'Seleção editorial', 'blog.search': 'Buscar artigos', 'blog.noResults': 'Nenhum artigo corresponde a estes filtros.', 'blog.noDate': 'Sem data', 'communities.empty': 'Ainda não há comunidades publicadas.', 'communities.featured': 'Comunidades em destaque', 'communities.editorialSelection': 'Seleção editorial', 'communities.search': 'Buscar comunidades', 'communities.noResults': 'Nenhuma comunidade corresponde a estes filtros.', 'communities.fallbackDescription': 'Comunidade para traders.', 'communities.join': 'Participar', 'communities.type.forum': 'Fórum', 'communities.type.other': 'Outra', 'giveaway.empty': 'Não há giveaways publicados no momento.', 'giveaway.history': 'Histórico', 'giveaway.previous': 'Giveaways anteriores', 'giveaway.ended': 'Finalizado', 'giveaway.brand': 'Giveaway da Tradagora', 'giveaway.participate': 'Participar agora', 'giveaway.rules': 'Ver regras', 'giveaway.resultsSoon': 'Resultados em breve', 'giveaway.days': 'Dias', 'giveaway.hours': 'Horas', 'giveaway.minutes': 'Min', 'giveaway.seconds': 'Seg',
  'tools.empty': 'Nenhuma ferramenta corresponde a estes filtros.', 'tools.use': 'Usar ferramenta', 'tools.visit': 'Visitar ferramenta', 'tools.free': 'Grátis', 'tools.paid': 'Pago', 'tools.freePlan': 'Plano gratuito', 'calculators.use': 'Usar calculadora', 'calculators.back': 'Voltar às calculadoras', 'calculators.note': 'Os resultados são estimativas educacionais e não constituem aconselhamento financeiro.', 'hero.tools.badge': 'Ferramentas', 'hero.tools.title': 'Ferramentas de trading', 'hero.tools.subtitle': 'Descubra plataformas, dados, indicadores e recursos úteis para sua operação.', 'hero.calculators.badge': 'Calculadoras', 'hero.calculators.title': 'Calculadoras de trading', 'hero.calculators.subtitle': 'Utilidades da Tradagora para estimar risco, objetivos e divisão de lucros.', 'placeholder.comingSoon': 'Em breve', 'placeholder.ready': 'Seção preparada', 'placeholder.description': 'A navegação e o conteúdo administrável estão disponíveis. Os módulos de dados específicos serão adicionados aqui sem sobrecarregar a página inicial.',
  'calculator.calculate': 'Calcular', 'calculator.reset': 'Redefinir', 'calculator.result': 'Resultado', 'calculator.accountSize': 'Tamanho da conta', 'calculator.currentBalance': 'Saldo atual', 'calculator.drawdown': 'Drawdown', 'calculator.profit': 'Lucro', 'calculator.target': 'Objetivo', 'calculator.split': 'Profit split', 'calculator.traderReceives': 'O trader recebe', 'calculator.firmReceives': 'A firma recebe',
  'finder.start': 'Encontrar minha Prop Firm', 'finder.next': 'Próximo', 'finder.previous': 'Anterior', 'finder.results': 'Resultados', 'finder.noResults': 'Nenhuma correspondência exata encontrada. Tente critérios menos restritivos.',
  'availability.available': 'Disponível', 'availability.restricted': 'Restrita', 'availability.unknown': 'Sem dado verificado', 'availability.warning': 'Restrição documentada', 'country.question': 'Qual é o seu país?', 'country.reason': 'Usamos essa informação para verificar as restrições publicadas por cada firma.', 'country.frequent': 'Países frequentes', 'country.searchOther': 'Buscar outro país', 'country.remove': 'Remover país', 'country.choose': 'Escolha seu país', 'country.search': 'Buscar por país ou código', 'country.results': 'Resultados de países', 'country.notFound': 'Não encontramos esse país.', 'country.origin': 'País de origem', 'country.unavailable': 'País de origem indisponível',
  'payout.days30': '30 dias', 'payout.history': 'Histórico', 'payout.highestAmount': 'Maior valor pago', 'payout.highestCount': 'Maior número de payouts', 'payout.noPeriodData': 'Sem dados disponíveis para este período.', 'payout.externalSnapshots': 'Dados externos agregados · snapshots atuais do período selecionado.',
} satisfies PublicUiMessages

// Adding a UI language only requires registering one complete catalog here.
// Database registration (`languages`) and UI publication remain separate concerns.
export const publicUiCatalog = { es: esMessages, en: enMessages, pt: ptMessages } as const
export type SupportedPublicUiLanguage = keyof typeof publicUiCatalog
export const publicUiCatalogCodes = Object.keys(publicUiCatalog) as SupportedPublicUiLanguage[]

export function hasPublicUiCatalog(language?: PublicLanguage | null): language is SupportedPublicUiLanguage {
  const code = language?.trim().toLowerCase().split('-')[0]
  return Boolean(code && Object.prototype.hasOwnProperty.call(publicUiCatalog, code))
}

export function publicUiLanguage(language?: PublicLanguage | null): SupportedPublicUiLanguage {
  const base = language?.trim().toLowerCase().split('-')[0]
  return hasPublicUiCatalog(base) ? base : 'es'
}

export function publishablePublicLanguages<T extends { code: string }>(registered: T[]) {
  return registered.filter((language) => hasPublicUiCatalog(language.code))
}

export function getPublicUi(language?: PublicLanguage | null, fallbackLanguage?: PublicLanguage | null) {
  const requested = publicUiCatalog[publicUiLanguage(language)]
  const fallback = publicUiCatalog[publicUiLanguage(fallbackLanguage)]
  return (key: PublicUiKey, variables?: Record<string, string | number>) => {
    let value: string = requested[key] ?? fallback[key] ?? esMessages[key]
    if (variables) for (const [name, replacement] of Object.entries(variables)) value = value.replaceAll(`{${name}}`, String(replacement))
    return value
  }
}

export function publicLocale(language?: PublicLanguage | null) {
  return ({ es: 'es-CO', en: 'en-US', pt: 'pt-BR' } as const)[publicUiLanguage(language)]
}

export function localizedCountryName(code: string, fallbackName: string, language?: PublicLanguage | null) {
  const normalizedCode = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(normalizedCode) || typeof Intl.DisplayNames !== 'function') return fallbackName

  try {
    return new Intl.DisplayNames([publicLocale(language)], { type: 'region' }).of(normalizedCode) ?? fallbackName
  } catch {
    return fallbackName
  }
}

export const publicFirmProfileCopy = {
  es: {
    payoutMetaDescription: 'Historial, métricas y actividad de payouts de {name}.', backToPayoutTracker: 'Volver al Payout Tracker', operatingFor: '{count} año operando', operatingForPlural: '{count} años operando', payoutPoint: '{count} payout', payoutPoints: '{count} payouts',
    metaDescription: 'Condiciones, reglas, cuentas y actividad de payouts de {name}.', profileIndex: 'Índice del perfil', firmViews: 'Vistas de la firma', overview: 'Resumen', information: 'Información', markets: 'Mercados', rules: 'Reglas', challenges: 'Desafíos', withdrawals: 'Retiros', restrictions: 'Restricciones', offers: 'Ofertas', payouts: 'Payouts', visit: 'Visitar {name}', viewOffer: 'Ver oferta', founded: 'Fundada', operating: 'Operando', score: 'Score', fallbackDescription: 'Consulta las condiciones y datos disponibles de {name}.', country: 'País', market: 'Mercado', maximumAccount: 'Cuenta máxima', upTo: 'Hasta {value}', generalInformation: 'Información general', tradingPlatforms: 'Plataformas de trading', paymentMethods: 'Métodos de pago', payoutMethods: 'Métodos de retiro', instruments: 'Instrumentos', broker: 'Broker', tradingRules: 'Reglas de trading', newsTrading: 'Trading en noticias', automatedTrading: 'EA / trading automatizado', copyTrading: 'Copy trading', weekendHolding: 'Mantener posiciones el fin de semana', scalping: 'Scalping', dayTrading: 'Day trading', inactivity: 'Inactividad', days: '{count} días', consistencyRule: 'Regla de consistencia', payoutPolicy: 'Política de retiros', restrictedCountries: 'Países restringidos', activePromotions: 'Promociones activas', offersDescription: 'Beneficios disponibles actualmente para comenzar con {name}.', off: 'DE DESCUENTO', specificChallenge: 'Challenge específico', code: 'Código', getOffer: 'Obtener oferta', noActiveOffers: 'No hay ofertas activas', noActiveOffersHelp: 'Cuando haya una promoción disponible, aparecerá aquí con sus condiciones y código.', payoutTracker: 'Payout tracker', payments: 'Pagos', payoutsDescription: 'Historial y actividad de payouts de {name}.', noActivity: 'Aún no hay actividad', noActivityHelp: 'Las métricas aparecerán cuando haya información disponible para esta firma.', allowed: 'Permitido', notAllowed: 'No permitido', notKnown: 'N/D', challenge: 'Challenge', accountAndPrice: 'Cuenta y precio', accountSizes: 'Tamaños de cuenta', account: 'Cuenta', price: 'Precio', plansPending: 'Tamaños y precios pendientes de registrar.', target: 'Objetivo', dailyLoss: 'Pérdida diaria', maxLoss: 'Pérdida máxima', withdrawal: 'Retiro', unconfirmed: 'No confirmado', optionsAvailable: 'Opciones de retiro disponibles', everyBusinessDays: 'Cada {count} días hábiles', firstWithdrawal: 'Primer retiro: {count} días', thenEvery: 'Después: cada {count} días', minimumWait: 'Espera mínima: {count} días', conditionsInDetail: 'Condiciones disponibles en el detalle', profitableDaysRequired: 'Requiere {count} días rentables', instant: 'Instantáneo', phasesUnknown: 'Número de fases no confirmado', phase: '{count} fase', phases: '{count} fases', sizeUnavailable: 'Tamaño no disponible', priceUnavailable: 'Precio no disponible', phaseShort: 'F{number}', activityFor: 'Actividad para', totalPaid: 'Total pagado', noExternalTotal: 'Sin total externo disponible', largestPayout: 'Mayor payout', average: 'Promedio', payoutHistory: 'Historial de payouts', recentActivity: 'Actividad reciente', amount: 'Monto', date: 'Fecha', method: 'Método', detail: 'Detalle', viewRecord: 'Ver registro', consolidation: 'El historial detallado de esta firma todavía está en consolidación.', comparison: 'Comparación', currentPeriod: 'Periodo actual', previousPeriod: 'Periodo anterior', payoutCycles: 'Ciclos de retiro', fromDays: 'Desde {count} días', marketsMap: { cfd: 'CFD / Forex', futures: 'Futuros', crypto: 'Cripto', options: 'Opciones' }, year: 'año', years: 'años', profitSplit: 'Profit split', payoutCount: 'Payouts', percentageDiscount: '{value}%', fixedDiscount: '{value} USD',
  },
  en: {
    payoutMetaDescription: 'Payout history, metrics, and activity for {name}.', backToPayoutTracker: 'Back to the Payout Tracker', operatingFor: '{count} year operating', operatingForPlural: '{count} years operating', payoutPoint: '{count} payout', payoutPoints: '{count} payouts',
    metaDescription: 'Terms, rules, accounts, and payout activity for {name}.', profileIndex: 'Profile index', firmViews: 'Firm views', overview: 'Overview', information: 'Information', markets: 'Markets', rules: 'Rules', challenges: 'Challenges', withdrawals: 'Withdrawals', restrictions: 'Restrictions', offers: 'Offers', payouts: 'Payouts', visit: 'Visit {name}', viewOffer: 'View offer', founded: 'Founded', operating: 'Operating', score: 'Score', fallbackDescription: 'Review the available terms and data for {name}.', country: 'Country', market: 'Market', maximumAccount: 'Maximum account', upTo: 'Up to {value}', generalInformation: 'General information', tradingPlatforms: 'Trading platforms', paymentMethods: 'Payment methods', payoutMethods: 'Withdrawal methods', instruments: 'Instruments', broker: 'Broker', tradingRules: 'Trading rules', newsTrading: 'News trading', automatedTrading: 'EA / automated trading', copyTrading: 'Copy trading', weekendHolding: 'Weekend holding', scalping: 'Scalping', dayTrading: 'Day trading', inactivity: 'Inactivity', days: '{count} days', consistencyRule: 'Consistency rule', payoutPolicy: 'Withdrawal policy', restrictedCountries: 'Restricted countries', activePromotions: 'Active promotions', offersDescription: 'Benefits currently available to get started with {name}.', off: 'OFF', specificChallenge: 'Specific challenge', code: 'Code', getOffer: 'Get offer', noActiveOffers: 'No active offers', noActiveOffersHelp: 'When a promotion is available, it will appear here with its terms and code.', payoutTracker: 'Payout tracker', payments: 'Payouts', payoutsDescription: 'Payout history and activity for {name}.', noActivity: 'No activity yet', noActivityHelp: 'Metrics will appear when information becomes available for this firm.', allowed: 'Allowed', notAllowed: 'Not allowed', notKnown: 'N/A', challenge: 'Challenge', accountAndPrice: 'Account and price', accountSizes: 'Account sizes', account: 'Account', price: 'Price', plansPending: 'Account sizes and prices are pending registration.', target: 'Target', dailyLoss: 'Daily loss', maxLoss: 'Maximum loss', withdrawal: 'Withdrawal', unconfirmed: 'Unconfirmed', optionsAvailable: 'Withdrawal options available', everyBusinessDays: 'Every {count} business days', firstWithdrawal: 'First withdrawal: {count} days', thenEvery: 'Then: every {count} days', minimumWait: 'Minimum wait: {count} days', conditionsInDetail: 'Terms available in the details', profitableDaysRequired: 'Requires {count} profitable days', instant: 'Instant', phasesUnknown: 'Number of phases not confirmed', phase: '{count} phase', phases: '{count} phases', sizeUnavailable: 'Size unavailable', priceUnavailable: 'Price unavailable', phaseShort: 'P{number}', activityFor: 'Activity for', totalPaid: 'Total paid', noExternalTotal: 'No external total available', largestPayout: 'Largest payout', average: 'Average', payoutHistory: 'Payout history', recentActivity: 'Recent activity', amount: 'Amount', date: 'Date', method: 'Method', detail: 'Details', viewRecord: 'View record', consolidation: 'The detailed history for this firm is still being consolidated.', comparison: 'Comparison', currentPeriod: 'Current period', previousPeriod: 'Previous period', payoutCycles: 'Withdrawal cycles', fromDays: 'From {count} days', marketsMap: { cfd: 'CFD / Forex', futures: 'Futures', crypto: 'Crypto', options: 'Options' }, year: 'year', years: 'years', profitSplit: 'Profit split', payoutCount: 'Payouts', percentageDiscount: '{value}%', fixedDiscount: '{value} USD',
  },
  pt: {
    payoutMetaDescription: 'Histórico, métricas e atividade de payouts da {name}.', backToPayoutTracker: 'Voltar ao Payout Tracker', operatingFor: '{count} ano em operação', operatingForPlural: '{count} anos em operação', payoutPoint: '{count} payout', payoutPoints: '{count} payouts',
    metaDescription: 'Condições, regras, contas e atividade de payouts da {name}.', profileIndex: 'Índice do perfil', firmViews: 'Visões da firma', overview: 'Resumo', information: 'Informações', markets: 'Mercados', rules: 'Regras', challenges: 'Challenges', withdrawals: 'Saques', restrictions: 'Restrições', offers: 'Ofertas', payouts: 'Payouts', visit: 'Visitar {name}', viewOffer: 'Ver oferta', founded: 'Fundada', operating: 'Operando', score: 'Score', fallbackDescription: 'Consulte as condições e os dados disponíveis da {name}.', country: 'País', market: 'Mercado', maximumAccount: 'Conta máxima', upTo: 'Até {value}', generalInformation: 'Informações gerais', tradingPlatforms: 'Plataformas de trading', paymentMethods: 'Métodos de pagamento', payoutMethods: 'Métodos de saque', instruments: 'Instrumentos', broker: 'Broker', tradingRules: 'Regras de trading', newsTrading: 'Trading de notícias', automatedTrading: 'EA / trading automatizado', copyTrading: 'Copy trading', weekendHolding: 'Manter posições no fim de semana', scalping: 'Scalping', dayTrading: 'Day trading', inactivity: 'Inatividade', days: '{count} dias', consistencyRule: 'Regra de consistência', payoutPolicy: 'Política de saques', restrictedCountries: 'Países restritos', activePromotions: 'Promoções ativas', offersDescription: 'Benefícios disponíveis atualmente para começar com {name}.', off: 'DE DESCONTO', specificChallenge: 'Challenge específico', code: 'Código', getOffer: 'Obter oferta', noActiveOffers: 'Não há ofertas ativas', noActiveOffersHelp: 'Quando houver uma promoção disponível, ela aparecerá aqui com suas condições e código.', payoutTracker: 'Payout tracker', payments: 'Pagamentos', payoutsDescription: 'Histórico e atividade de payouts da {name}.', noActivity: 'Ainda não há atividade', noActivityHelp: 'As métricas aparecerão quando houver informações disponíveis para esta firma.', allowed: 'Permitido', notAllowed: 'Não permitido', notKnown: 'N/D', challenge: 'Challenge', accountAndPrice: 'Conta e preço', accountSizes: 'Tamanhos de conta', account: 'Conta', price: 'Preço', plansPending: 'Tamanhos e preços pendentes de registro.', target: 'Objetivo', dailyLoss: 'Perda diária', maxLoss: 'Perda máxima', withdrawal: 'Saque', unconfirmed: 'Não confirmado', optionsAvailable: 'Opções de saque disponíveis', everyBusinessDays: 'A cada {count} dias úteis', firstWithdrawal: 'Primeiro saque: {count} dias', thenEvery: 'Depois: a cada {count} dias', minimumWait: 'Espera mínima: {count} dias', conditionsInDetail: 'Condições disponíveis nos detalhes', profitableDaysRequired: 'Requer {count} dias lucrativos', instant: 'Instantâneo', phasesUnknown: 'Número de fases não confirmado', phase: '{count} fase', phases: '{count} fases', sizeUnavailable: 'Tamanho indisponível', priceUnavailable: 'Preço indisponível', phaseShort: 'F{number}', activityFor: 'Atividade para', totalPaid: 'Total pago', noExternalTotal: 'Sem total externo disponível', largestPayout: 'Maior payout', average: 'Média', payoutHistory: 'Histórico de payouts', recentActivity: 'Atividade recente', amount: 'Valor', date: 'Data', method: 'Método', detail: 'Detalhe', viewRecord: 'Ver registro', consolidation: 'O histórico detalhado desta firma ainda está em consolidação.', comparison: 'Comparação', currentPeriod: 'Período atual', previousPeriod: 'Período anterior', payoutCycles: 'Ciclos de saque', fromDays: 'A partir de {count} dias', marketsMap: { cfd: 'CFD / Forex', futures: 'Futuros', crypto: 'Cripto', options: 'Opções' }, year: 'ano', years: 'anos', profitSplit: 'Profit split', payoutCount: 'Payouts', percentageDiscount: '{value}%', fixedDiscount: '{value} USD',
  },
} as const

export function firmProfileText(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template)
}

export const publicBrokerProfileCopy = {
  es: {
    broker: 'Broker', since: 'Desde {year}', generalUnverified: 'Información general sin verificar', visit: 'Visitar {name}', summary: 'Resumen', noDescription: 'Sin descripción verificada.', markets: 'Mercados', platforms: 'Plataformas', minimumDeposit: 'Depósito mínimo', regulation: 'Regulación', officialSource: 'Consultar fuente oficial', activePromotion: 'Promoción activa', offerAvailable: 'Oferta disponible', off: 'DE DESCUENTO', applyOffer: 'Aplicar oferta', essentialInformation: 'Información esencial', country: 'País', founded: 'Fundación', unverified: 'Sin verificar', percentageDiscount: '{value}%', fixedDiscount: '{value} USD', marketsMap: { cfd: 'CFD / Forex', futures: 'Futuros', crypto: 'Cripto', options: 'Opciones' },
  },
  en: {
    broker: 'Broker', since: 'Since {year}', generalUnverified: 'General information unverified', visit: 'Visit {name}', summary: 'Overview', noDescription: 'No verified description.', markets: 'Markets', platforms: 'Platforms', minimumDeposit: 'Minimum deposit', regulation: 'Regulation', officialSource: 'Check official source', activePromotion: 'Active promotion', offerAvailable: 'Offer available', off: 'OFF', applyOffer: 'Apply offer', essentialInformation: 'Essential information', country: 'Country', founded: 'Founded', unverified: 'Unverified', percentageDiscount: '{value}%', fixedDiscount: '{value} USD', marketsMap: { cfd: 'CFD / Forex', futures: 'Futures', crypto: 'Crypto', options: 'Options' },
  },
  pt: {
    broker: 'Broker', since: 'Desde {year}', generalUnverified: 'Informações gerais não verificadas', visit: 'Visitar {name}', summary: 'Resumo', noDescription: 'Sem descrição verificada.', markets: 'Mercados', platforms: 'Plataformas', minimumDeposit: 'Depósito mínimo', regulation: 'Regulamentação', officialSource: 'Consultar fonte oficial', activePromotion: 'Promoção ativa', offerAvailable: 'Oferta disponível', off: 'DE DESCONTO', applyOffer: 'Aplicar oferta', essentialInformation: 'Informações essenciais', country: 'País', founded: 'Fundação', unverified: 'Sem verificação', percentageDiscount: '{value}%', fixedDiscount: '{value} USD', marketsMap: { cfd: 'CFD / Forex', futures: 'Futuros', crypto: 'Cripto', options: 'Opções' },
  },
} as const

export const publicExchangeProfileCopy = {
  es: {
    exchange: 'Exchange', since: 'Desde {year}', generalUnverified: 'Información general sin verificar', visit: 'Visitar {name}', summary: 'Resumen', noDescription: 'Sin descripción verificada.', type: 'Tipo', products: 'Productos', fiatSupport: 'Soporte fiat', regulation: 'Regulación', centralized: 'Centralizado', decentralized: 'Descentralizado', yes: 'Sí', no: 'No', unverified: 'Sin verificar', checkSource: 'Consultar fuente', activeOffers: 'Ofertas activas', viewOffer: 'Ver oferta', essentialInformation: 'Información esencial', country: 'País', founded: 'Fundación', fiat: 'Fiat', off: 'DE DESCUENTO', percentageDiscount: '{value}%', fixedDiscount: '{value} USD',
  },
  en: {
    exchange: 'Exchange', since: 'Since {year}', generalUnverified: 'General information unverified', visit: 'Visit {name}', summary: 'Overview', noDescription: 'No verified description.', type: 'Type', products: 'Products', fiatSupport: 'Fiat support', regulation: 'Regulation', centralized: 'Centralized', decentralized: 'Decentralized', yes: 'Yes', no: 'No', unverified: 'Unverified', checkSource: 'Check source', activeOffers: 'Active offers', viewOffer: 'View offer', essentialInformation: 'Essential information', country: 'Country', founded: 'Founded', fiat: 'Fiat', off: 'OFF', percentageDiscount: '{value}%', fixedDiscount: '{value} USD',
  },
  pt: {
    exchange: 'Exchange', since: 'Desde {year}', generalUnverified: 'Informações gerais não verificadas', visit: 'Visitar {name}', summary: 'Resumo', noDescription: 'Sem descrição verificada.', type: 'Tipo', products: 'Produtos', fiatSupport: 'Suporte a fiat', regulation: 'Regulamentação', centralized: 'Centralizado', decentralized: 'Descentralizado', yes: 'Sim', no: 'Não', unverified: 'Sem verificação', checkSource: 'Consultar fonte', activeOffers: 'Ofertas ativas', viewOffer: 'Ver oferta', essentialInformation: 'Informações essenciais', country: 'País', founded: 'Fundação', fiat: 'Fiat', off: 'DE DESCONTO', percentageDiscount: '{value}%', fixedDiscount: '{value} USD',
  },
} as const

export function publicPath(path: string, language: PublicLanguage, params?: Record<string, string | number | null | undefined>) {
  const [pathname, rawQuery = ''] = path.split('?')
  const query = new URLSearchParams(rawQuery)
  query.set('lang', language)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined || value === '') query.delete(key)
    else query.set(key, String(value))
  }
  const serialized = query.toString()
  return serialized ? `${pathname}?${serialized}` : pathname
}

export const publicCalculatorCopy = {
  es: { back: 'Volver a calculadoras', estimateNote: 'Los cálculos son orientativos. Verifica siempre las reglas oficiales de tu broker o Prop Firm.', notFound: 'Calculadora no encontrada', result: 'Resultado', initialBalance: 'Balance inicial de la cuenta', initialBalanceShort: 'Balance inicial', currentBalance: 'Balance / equity actual', maxLoss: 'Límite máximo de pérdida (%)', dailyLoss: 'Límite diario (%) · opcional', minimumBalance: 'Límite mínimo permitido', currentLoss: 'Pérdida actual', remaining: 'Margen restante', consumed: 'Drawdown consumido', profit: 'Ganancia', traderSplit: 'Split del trader (%)', trader: 'Trader', firm: 'Firma', target: 'Objetivo (%)', targetAmount: 'Objetivo monetario', targetBalance: 'Balance objetivo', currentProfit: 'Ganancia actual', missing: 'Faltante', progress: 'Progreso' },
  en: { back: 'Back to calculators', estimateNote: 'Results are estimates. Always verify the official rules of your broker or Prop Firm.', notFound: 'Calculator not found', result: 'Result', initialBalance: 'Initial account balance', initialBalanceShort: 'Initial balance', currentBalance: 'Current balance / equity', maxLoss: 'Maximum loss limit (%)', dailyLoss: 'Daily loss limit (%) · optional', minimumBalance: 'Minimum allowed balance', currentLoss: 'Current loss', remaining: 'Remaining margin', consumed: 'Drawdown used', profit: 'Profit', traderSplit: 'Trader split (%)', trader: 'Trader', firm: 'Firm', target: 'Target (%)', targetAmount: 'Target amount', targetBalance: 'Target balance', currentProfit: 'Current profit', missing: 'Remaining', progress: 'Progress' },
  pt: { back: 'Voltar às calculadoras', estimateNote: 'Os cálculos são estimativas. Verifique sempre as regras oficiais da sua corretora ou Prop Firm.', notFound: 'Calculadora não encontrada', result: 'Resultado', initialBalance: 'Saldo inicial da conta', initialBalanceShort: 'Saldo inicial', currentBalance: 'Saldo / equity atual', maxLoss: 'Limite máximo de perda (%)', dailyLoss: 'Limite diário (%) · opcional', minimumBalance: 'Saldo mínimo permitido', currentLoss: 'Perda atual', remaining: 'Margem restante', consumed: 'Drawdown consumido', profit: 'Lucro', traderSplit: 'Split do trader (%)', trader: 'Trader', firm: 'Firma', target: 'Objetivo (%)', targetAmount: 'Objetivo monetário', targetBalance: 'Saldo objetivo', currentProfit: 'Lucro atual', missing: 'Restante', progress: 'Progresso' },
} as const

export const publicCalculatorsDirectoryCopy = {
  es: { use: 'Abrir calculadora', empty: 'Todavía no hay calculadoras publicadas.', note: 'Las calculadoras son utilidades propias de Tradagora. Sus resultados son orientativos y no sustituyen las reglas oficiales de tu broker o Prop Firm.' },
  en: { use: 'Open calculator', empty: 'No calculators have been published yet.', note: 'These calculators are tools developed by Tradagora. Results are estimates and do not replace the official rules of your broker or Prop Firm.' },
  pt: { use: 'Abrir calculadora', empty: 'Ainda não há calculadoras publicadas.', note: 'As calculadoras são utilidades próprias da Tradagora. Os resultados são estimativas e não substituem as regras oficiais da sua corretora ou Prop Firm.' },
} as const

export const publicToolsCopy = {
  es: { freePlan: 'Con plan gratis', price: 'Precio', works: 'Dónde funciona', author: 'Autor', own: 'NUESTRO', visit: 'Ir al sitio oficial', soon: 'Próximamente', empty: 'No hay herramientas que coincidan con estos filtros.', clear: 'Limpiar filtros', disclaimer: 'Tradagora no garantiza la disponibilidad, precios ni resultados de servicios externos. Verifica siempre las condiciones en el sitio oficial.', promo: 'Promoción', fallbackDescription: 'Recurso para complementar tu operativa y análisis.', codeAvailable: 'Código disponible' },
  en: { freePlan: 'Free plan available', price: 'Price', works: 'Works on', author: 'Author', own: 'OURS', visit: 'Go to official site', soon: 'Coming soon', empty: 'No tools match these filters.', clear: 'Clear filters', disclaimer: 'Tradagora does not guarantee the availability, pricing, or results of external services. Always verify the terms on the official website.', promo: 'Promotion', fallbackDescription: 'A resource to support your trading and analysis.', codeAvailable: 'Code available' },
  pt: { freePlan: 'Com plano grátis', price: 'Preço', works: 'Onde funciona', author: 'Autor', own: 'NOSSO', visit: 'Ir ao site oficial', soon: 'Em breve', empty: 'Nenhuma ferramenta corresponde a estes filtros.', clear: 'Limpar filtros', disclaimer: 'A Tradagora não garante disponibilidade, preços ou resultados de serviços externos. Verifique sempre as condições no site oficial.', promo: 'Promoção', fallbackDescription: 'Recurso para complementar sua operação e análise.', codeAvailable: 'Código disponível' },
} as const

export const publicToolPriceCopy = {
  es: { free: 'Gratis', freemium: 'Freemium', paid: 'De pago' },
  en: { free: 'Free', freemium: 'Freemium', paid: 'Paid' },
  pt: { free: 'Grátis', freemium: 'Freemium', paid: 'Pago' },
} as const

export const publicToolFilters = [
  { value: 'all', es: 'Todas', en: 'All', pt: 'Todas' },
  { value: 'Gráficos y datos', es: 'Gráficos y datos', en: 'Charts & data', pt: 'Gráficos e dados' },
  { value: 'Indicadores', es: 'Indicadores', en: 'Indicators', pt: 'Indicadores' },
  { value: 'Noticias y calendario', es: 'Noticias y calendario', en: 'News & calendar', pt: 'Notícias e calendário' },
  { value: 'Plataformas', es: 'Plataformas', en: 'Platforms', pt: 'Plataformas' },
  { value: 'Diario de trading', es: 'Diario de trading', en: 'Trading journal', pt: 'Diário de trading' },
] as const

export const publicRecommendationCopy = {
  es: { badge: 'Recomendador', title: 'Encuentra una firma para tu forma de operar.', subtitle: 'Cuéntanos lo esencial de tu perfil. Esta primera versión organiza tus preferencias mientras ampliamos el motor de comparación.', market: 'Mercado', experience: 'Experiencia', budget: 'Presupuesto', select: 'Seleccionar', futures: 'Futuros', crypto: 'Cripto', beginner: 'Estoy empezando', intermediate: 'Intermedia', advanced: 'Avanzada', upTo100: 'Hasta $100', over300: 'Más de $300', submit: 'Ver mi perfil', ready: 'Perfil listo. Pronto podrás recibir comparaciones personalizadas con datos del catálogo.' },
  en: { badge: 'Recommender', title: 'Find a firm that fits your trading style.', subtitle: 'Tell us the essentials about your profile. This first version organizes your preferences while we expand the comparison engine.', market: 'Market', experience: 'Experience', budget: 'Budget', select: 'Select', futures: 'Futures', crypto: 'Crypto', beginner: 'I am getting started', intermediate: 'Intermediate', advanced: 'Advanced', upTo100: 'Up to $100', over300: 'Over $300', submit: 'View my profile', ready: 'Your profile is ready. Personalized comparisons using catalog data are coming soon.' },
  pt: { badge: 'Recomendador', title: 'Encontre uma firma para o seu estilo de operação.', subtitle: 'Conte-nos o essencial sobre seu perfil. Esta primeira versão organiza suas preferências enquanto ampliamos o motor de comparação.', market: 'Mercado', experience: 'Experiência', budget: 'Orçamento', select: 'Selecionar', futures: 'Futuros', crypto: 'Cripto', beginner: 'Estou começando', intermediate: 'Intermediária', advanced: 'Avançada', upTo100: 'Até $100', over300: 'Mais de $300', submit: 'Ver meu perfil', ready: 'Perfil pronto. Em breve você poderá receber comparações personalizadas com dados do catálogo.' },
} as const

export const publicOffersCopy = {
  es: { featured: 'Ofertas destacadas', editorial: 'Selección editorial', viewAll: 'Ver todas', freeAccount: 'Cuenta gratis', until: 'Hasta', active: 'Vigente', view: 'Ver', search: 'Buscar firma o código', searchLabel: 'Buscar firma', type: 'Tipo', discount: 'Descuento', code: 'Código', market: 'Mercado', state: 'Estado', activePlural: 'Activas', ending: 'Por vencer', current: 'Promociones vigentes', promotion: 'promoción', promotions: 'promociones', firm: 'firma', firms: 'firmas', empty: 'No encontramos ofertas con esos filtros', emptyHelp: 'Prueba otro mercado, tipo o término de búsqueda.', benefit: 'Beneficio', only: 'Solo', linkApplied: 'Se aplica desde el enlace', apply: 'Aplicar', viewFirm: 'Ver firma', more: 'Más', offer: 'oferta', offers: 'ofertas', noCode: 'Sin código', pageTitle: 'Ofertas activas para traders', pageSubtitle: 'Compara descuentos, códigos promocionales y beneficios vigentes de Prop Firms.' },
  en: { featured: 'Featured offers', editorial: 'Editorial selection', viewAll: 'View all', freeAccount: 'Free account', until: 'Until', active: 'Active', view: 'View', search: 'Search firm or code', searchLabel: 'Search firm', type: 'Type', discount: 'Discount', code: 'Code', market: 'Market', state: 'Status', activePlural: 'Active', ending: 'Ending soon', current: 'Current promotions', promotion: 'promotion', promotions: 'promotions', firm: 'firm', firms: 'firms', empty: 'No offers match these filters', emptyHelp: 'Try another market, type, or search term.', benefit: 'Benefit', only: 'Only', linkApplied: 'Applied through the link', apply: 'Apply', viewFirm: 'View firm', more: 'More', offer: 'offer', offers: 'offers', noCode: 'No code', pageTitle: 'Active offers for traders', pageSubtitle: 'Compare discounts, promo codes, and current Prop Firm benefits.' },
  pt: { featured: 'Ofertas em destaque', editorial: 'Seleção editorial', viewAll: 'Ver todas', freeAccount: 'Conta grátis', until: 'Até', active: 'Vigente', view: 'Ver', search: 'Buscar firma ou código', searchLabel: 'Buscar firma', type: 'Tipo', discount: 'Desconto', code: 'Código', market: 'Mercado', state: 'Estado', activePlural: 'Ativas', ending: 'Perto do fim', current: 'Promoções vigentes', promotion: 'promoção', promotions: 'promoções', firm: 'firma', firms: 'firmas', empty: 'Nenhuma oferta corresponde a estes filtros', emptyHelp: 'Tente outro mercado, tipo ou termo de busca.', benefit: 'Benefício', only: 'Somente', linkApplied: 'Aplicada pelo link', apply: 'Aplicar', viewFirm: 'Ver firma', more: 'Mais', offer: 'oferta', offers: 'ofertas', noCode: 'Sem código', pageTitle: 'Ofertas ativas para traders', pageSubtitle: 'Compare descontos, códigos promocionais e benefícios vigentes de Prop Firms.' },
} as const

export const publicOfferToastCopy = {
  es: { activeSuffix: 'activo', featured: 'Oferta destacada', current: 'Oferta vigente', freeAccount: 'Cuenta gratis', close: 'Cerrar notificación de oferta' },
  en: { activeSuffix: 'active', featured: 'Featured offer', current: 'Current offer', freeAccount: 'Free account', close: 'Close offer notification' },
  pt: { activeSuffix: 'ativa', featured: 'Oferta em destaque', current: 'Oferta vigente', freeAccount: 'Conta grátis', close: 'Fechar notificação de oferta' },
} as const

export const publicHomeCopy = {
  es: { heroBadge: 'Datos para operar con criterio', heroTitle: 'Compara antes de poner tu capital en juego.', heroSubtitle: 'Prop firms, ofertas y pagos verificados en un mismo lugar.', exploreFirms: 'Explorar Prop Firms', viewVerified: 'Ver pagos verificados', activityToday: 'Actividad verificada hoy', noRecent: 'Sin datos recientes disponibles', noRecentHelp: 'Esto no significa que el monto pagado sea cero.', withdrawals: 'retiros', activeFirms: 'firmas con actividad', lastEvidence: 'Última evidencia', verifiedPayout: 'Payout verificado', openTracker: 'Abrir Payout Tracker', recommender: 'Recomendador', finderTitle: 'Encuentra la Prop Firm adecuada para ti', finderSubtitle: 'Cuéntanos cómo operas y Tradagora compara las firmas por ti.', finderCta: 'Encontrar mis mejores opciones', tracker: 'Payout tracker', payoutTitle: 'Pagos reales. Evidencia rastreable.', payoutSubtitle: 'Evidencias individuales registradas por Tradagora; las métricas externas permanecen separadas en el tracker.', viewTracker: 'Ver Payout Tracker', totalRecorded: 'Total registrado', payouts: 'Payouts', firmsWithEvidence: 'Firmas con evidencia', noData: 'Sin datos', aggregated: 'Datos agregados', rankingsTitle: 'Rankings de payouts reportados', rankingsSubtitle: 'Métricas agregadas por firma y período; no son payouts verificados individualmente.', editorial: 'Selección editorial', featuredFirms: 'Prop Firms destacadas', featuredSubtitle: 'Firmas con datos disponibles para comparar.', viewAllFirms: 'Ver todas las firmas', firmFallback: 'Consulta sus datos y condiciones.', details: 'Ver detalles', visit: 'Visitar', currentOffers: 'Ofertas vigentes', offerTitle: 'Beneficios activos ahora.', offerSubtitle: 'Promociones configuradas y dentro de su vigencia.', viewAllOffers: 'Ver todas las ofertas', methodology: 'Metodología', methodologyTitle: 'Cómo verificamos la información.', methodologySubtitle: 'Separamos información estructurada, evidencia rastreable, fuentes públicas y relaciones comerciales para que sepas qué estás comparando.', compareCriteria: 'Cómo comparar con criterio', ownData: 'Datos propios', ownDataText: 'Información estructurada que recopilamos y administramos.', verifiableEvidence: 'Evidencia verificable', verifiableEvidenceText: 'Payouts y pruebas individuales que pueden rastrearse.', publicSources: 'Fuentes públicas', publicSourcesText: 'Reglas, condiciones y restricciones publicadas por fuentes identificables.', commercialLinks: 'Enlaces comerciales', commercialLinksText: 'La afiliación se identifica y nunca se mezcla con la verificación.', decideContext: 'Decide con contexto', finalTitle: 'Menos promesas. Más contexto para decidir.', finalSubtitle: 'Compara firmas, evidencia de payouts y ofertas activas sin mezclar fuentes ni intereses comerciales.', explore: 'Explorar firmas', viewMethodology: 'Ver metodología', comparableFirms: 'Prop Firms comparables', sourcedPayouts: 'Payouts con fuente identificada', offersComparator: 'Ofertas activas y comparador' },
  en: { heroBadge: 'Data for informed trading', heroTitle: 'Compare before putting your capital at risk.', heroSubtitle: 'Prop firms, offers, and verified payouts in one place.', exploreFirms: 'Explore Prop Firms', viewVerified: 'View verified payouts', activityToday: 'Verified activity today', noRecent: 'No recent data available', noRecentHelp: 'This does not mean the amount paid is zero.', withdrawals: 'withdrawals', activeFirms: 'firms with activity', lastEvidence: 'Latest evidence', verifiedPayout: 'Verified payout', openTracker: 'Open Payout Tracker', recommender: 'Recommender', finderTitle: 'Find the right Prop Firm for you', finderSubtitle: 'Tell us how you trade and Tradagora will compare firms for you.', finderCta: 'Find my best options', tracker: 'Payout tracker', payoutTitle: 'Real payouts. Traceable evidence.', payoutSubtitle: 'Individual evidence recorded by Tradagora; external metrics remain separate in the tracker.', viewTracker: 'View Payout Tracker', totalRecorded: 'Total recorded', payouts: 'Payouts', firmsWithEvidence: 'Firms with evidence', noData: 'No data', aggregated: 'Aggregated data', rankingsTitle: 'Reported payout rankings', rankingsSubtitle: 'Aggregated metrics by firm and period; these are not individually verified payouts.', editorial: 'Editorial selection', featuredFirms: 'Featured Prop Firms', featuredSubtitle: 'Firms with data available for comparison.', viewAllFirms: 'View all firms', firmFallback: 'Review its available data and terms.', details: 'View details', visit: 'Visit', currentOffers: 'Current offers', offerTitle: 'Active benefits now.', offerSubtitle: 'Promotions configured and currently valid.', viewAllOffers: 'View all offers', methodology: 'Methodology', methodologyTitle: 'How we verify information.', methodologySubtitle: 'We separate structured information, traceable evidence, public sources, and commercial relationships so you know what you are comparing.', compareCriteria: 'How to compare with context', ownData: 'First-party data', ownDataText: 'Structured information we collect and manage.', verifiableEvidence: 'Verifiable evidence', verifiableEvidenceText: 'Individual payouts and evidence that can be traced.', publicSources: 'Public sources', publicSourcesText: 'Rules, terms, and restrictions published by identifiable sources.', commercialLinks: 'Commercial links', commercialLinksText: 'Affiliation is identified and never mixed with verification.', decideContext: 'Decide with context', finalTitle: 'Fewer promises. More context to decide.', finalSubtitle: 'Compare firms, payout evidence, and active offers without mixing sources or commercial interests.', explore: 'Explore firms', viewMethodology: 'View methodology', comparableFirms: 'Comparable Prop Firms', sourcedPayouts: 'Payouts with identified sources', offersComparator: 'Active offers and comparator' },
  pt: { heroBadge: 'Dados para operar com critério', heroTitle: 'Compare antes de colocar seu capital em jogo.', heroSubtitle: 'Prop firms, ofertas e payouts verificados em um só lugar.', exploreFirms: 'Explorar Prop Firms', viewVerified: 'Ver payouts verificados', activityToday: 'Atividade verificada hoje', noRecent: 'Sem dados recentes disponíveis', noRecentHelp: 'Isso não significa que o valor pago seja zero.', withdrawals: 'saques', activeFirms: 'firmas com atividade', lastEvidence: 'Última evidência', verifiedPayout: 'Payout verificado', openTracker: 'Abrir Payout Tracker', recommender: 'Recomendador', finderTitle: 'Encontre a Prop Firm certa para você', finderSubtitle: 'Conte-nos como você opera e a Tradagora compara as firmas para você.', finderCta: 'Encontrar minhas melhores opções', tracker: 'Payout tracker', payoutTitle: 'Payouts reais. Evidência rastreável.', payoutSubtitle: 'Evidências individuais registradas pela Tradagora; as métricas externas permanecem separadas no tracker.', viewTracker: 'Ver Payout Tracker', totalRecorded: 'Total registrado', payouts: 'Payouts', firmsWithEvidence: 'Firmas com evidência', noData: 'Sem dados', aggregated: 'Dados agregados', rankingsTitle: 'Rankings de payouts reportados', rankingsSubtitle: 'Métricas agregadas por firma e período; não são payouts verificados individualmente.', editorial: 'Seleção editorial', featuredFirms: 'Prop Firms em destaque', featuredSubtitle: 'Firmas com dados disponíveis para comparar.', viewAllFirms: 'Ver todas as firmas', firmFallback: 'Consulte seus dados e condições.', details: 'Ver detalhes', visit: 'Visitar', currentOffers: 'Ofertas vigentes', offerTitle: 'Benefícios ativos agora.', offerSubtitle: 'Promoções configuradas e dentro da vigência.', viewAllOffers: 'Ver todas as ofertas', methodology: 'Metodologia', methodologyTitle: 'Como verificamos as informações.', methodologySubtitle: 'Separamos informações estruturadas, evidências rastreáveis, fontes públicas e relações comerciais para que você saiba o que está comparando.', compareCriteria: 'Como comparar com critério', ownData: 'Dados próprios', ownDataText: 'Informações estruturadas que coletamos e administramos.', verifiableEvidence: 'Evidência verificável', verifiableEvidenceText: 'Payouts e provas individuais que podem ser rastreados.', publicSources: 'Fontes públicas', publicSourcesText: 'Regras, condições e restrições publicadas por fontes identificáveis.', commercialLinks: 'Links comerciais', commercialLinksText: 'A afiliação é identificada e nunca se mistura com a verificação.', decideContext: 'Decida com contexto', finalTitle: 'Menos promessas. Mais contexto para decidir.', finalSubtitle: 'Compare firmas, evidências de payouts e ofertas ativas sem misturar fontes ou interesses comerciais.', explore: 'Explorar firmas', viewMethodology: 'Ver metodologia', comparableFirms: 'Prop Firms comparáveis', sourcedPayouts: 'Payouts com fonte identificada', offersComparator: 'Ofertas ativas e comparador' },
} as const

const finderReasons = {
  es: {
    'Mercado no confirmado': 'Mercado no confirmado', 'Presupuesto compatible': 'Presupuesto compatible',
    'No encontramos un plan dentro del presupuesto': 'No encontramos un plan dentro del presupuesto', 'Precio no disponible': 'Precio no disponible',
    'Tiene el tamaño de cuenta solicitado': 'Tiene el tamaño de cuenta solicitado', 'No aparece el tamaño de cuenta solicitado': 'No aparece el tamaño de cuenta solicitado',
    'Tamaños de cuenta no disponibles': 'Tamaños de cuenta no disponibles', 'Tipo de evaluación compatible': 'Tipo de evaluación compatible',
    'Evaluación distinta a la preferida': 'Evaluación distinta a la preferida', 'Tipo de evaluación no disponible': 'Tipo de evaluación no disponible',
    'Permite EA / Bots': 'Permite EA / Bots', 'Permite operar noticias': 'Permite operar noticias',
    'Permite mantener el fin de semana': 'Permite mantener el fin de semana', 'Permite scalping': 'Permite scalping',
    'Permite Day Trading': 'Permite Day Trading', 'Permite Copy Trading': 'Permite Copy Trading',
    'No permite ea / bots': 'No permite EA / Bots', 'No permite operar noticias': 'No permite operar noticias',
    'No permite mantener el fin de semana': 'No permite mantener el fin de semana', 'No permite scalping': 'No permite scalping',
    'No permite day trading': 'No permite Day Trading', 'No permite copy trading': 'No permite Copy Trading',
    'Profit split no disponible': 'Profit split no disponible', 'Velocidad de payout: dato no disponible': 'Velocidad de payout: dato no disponible',
    'Sin fuente de payouts verificada': 'Sin fuente de payouts verificada', 'API oficial': 'API oficial',
    'Verificado on-chain': 'Verificado on-chain', Proveedor: 'Proveedor', 'Datos públicos': 'Datos públicos', 'Sin verificación': 'Sin verificación',
  },
  en: {
    'Mercado no confirmado': 'Market not confirmed', 'Presupuesto compatible': 'Budget compatible',
    'No encontramos un plan dentro del presupuesto': 'No plan found within the budget', 'Precio no disponible': 'Price unavailable',
    'Tiene el tamaño de cuenta solicitado': 'Has the requested account size', 'No aparece el tamaño de cuenta solicitado': 'Requested account size not listed',
    'Tamaños de cuenta no disponibles': 'Account sizes unavailable', 'Tipo de evaluación compatible': 'Compatible evaluation type',
    'Evaluación distinta a la preferida': 'Evaluation differs from your preference', 'Tipo de evaluación no disponible': 'Evaluation type unavailable',
    'Permite EA / Bots': 'Allows EA / Bots', 'Permite operar noticias': 'Allows news trading',
    'Permite mantener el fin de semana': 'Allows weekend holding', 'Permite scalping': 'Allows scalping',
    'Permite Day Trading': 'Allows day trading', 'Permite Copy Trading': 'Allows copy trading',
    'No permite ea / bots': 'Does not allow EA / Bots', 'No permite operar noticias': 'Does not allow news trading',
    'No permite mantener el fin de semana': 'Does not allow weekend holding', 'No permite scalping': 'Does not allow scalping',
    'No permite day trading': 'Does not allow day trading', 'No permite copy trading': 'Does not allow copy trading',
    'Profit split no disponible': 'Profit split unavailable', 'Velocidad de payout: dato no disponible': 'Payout speed: data unavailable',
    'Sin fuente de payouts verificada': 'No verified payout source', 'API oficial': 'Official API',
    'Verificado on-chain': 'Verified on-chain', Proveedor: 'Provider', 'Datos públicos': 'Public data', 'Sin verificación': 'Unverified',
  },
  pt: {
    'Mercado no confirmado': 'Mercado não confirmado', 'Presupuesto compatible': 'Orçamento compatível',
    'No encontramos un plan dentro del presupuesto': 'Não encontramos um plano dentro do orçamento', 'Precio no disponible': 'Preço indisponível',
    'Tiene el tamaño de cuenta solicitado': 'Tem o tamanho de conta solicitado', 'No aparece el tamaño de cuenta solicitado': 'O tamanho de conta solicitado não está listado',
    'Tamaños de cuenta no disponibles': 'Tamanhos de conta indisponíveis', 'Tipo de evaluación compatible': 'Tipo de avaliação compatível',
    'Evaluación distinta a la preferida': 'Avaliação diferente da preferência', 'Tipo de evaluación no disponible': 'Tipo de avaliação indisponível',
    'Permite EA / Bots': 'Permite EA / Bots', 'Permite operar noticias': 'Permite operar notícias',
    'Permite mantener el fin de semana': 'Permite manter posições no fim de semana', 'Permite scalping': 'Permite scalping',
    'Permite Day Trading': 'Permite Day Trading', 'Permite Copy Trading': 'Permite Copy Trading',
    'No permite ea / bots': 'Não permite EA / Bots', 'No permite operar noticias': 'Não permite operar notícias',
    'No permite mantener el fin de semana': 'Não permite manter posições no fim de semana', 'No permite scalping': 'Não permite scalping',
    'No permite day trading': 'Não permite Day Trading', 'No permite copy trading': 'Não permite Copy Trading',
    'Profit split no disponible': 'Profit split indisponível', 'Velocidad de payout: dato no disponible': 'Velocidade de payout: dado indisponível',
    'Sin fuente de payouts verificada': 'Sem fonte de payouts verificada', 'API oficial': 'API oficial',
    'Verificado on-chain': 'Verificado on-chain', Proveedor: 'Provedor', 'Datos públicos': 'Dados públicos', 'Sin verificación': 'Sem verificação',
  },
} as const

export const publicFinderCopy = {
  es: {
    steps: ['Qué quieres operar', 'Cuánto quieres invertir', 'Cómo operas', 'Qué priorizas'], step: 'Paso', of: 'de',
    country: 'País', selectCountry: 'Seleccionar país', market: 'Mercado', noPreference: 'Sin preferencia', futures: 'Futuros', crypto: 'Cripto', other: 'Otros',
    experience: 'Experiencia', select: 'Seleccionar', beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado',
    maxBudget: 'Presupuesto máximo', undefined: 'Sin definir', under50: 'Menos de $50', over500: 'Más de $500', accountSize: 'Tamaño de cuenta deseado', evaluation: 'Tipo de evaluación', instantFunding: 'Instant Funding',
    tradingStyle: 'Estilo de trading', news: 'Noticias', weekend: 'Swing / fin de semana', dayTrading: 'Day trading',
    priority: 'Prioridad principal', lowPrice: 'Precio bajo', flexibleRules: 'Reglas flexibles', highSplit: 'Profit split alto', verifiablePayouts: 'Payouts comprobables', wideDrawdown: 'Drawdown amplio', noTimeLimit: 'Sin límite de tiempo',
    payoutPreference: 'Preferencia de payouts', fastPayout: 'Priorizar payout rápido', payoutHistory: 'Priorizar historial de payouts', notImportant: 'No es importante',
    previous: 'Anterior', continue: 'Continuar', transparentResults: 'Resultados transparentes', bestOptions: 'Tus mejores opciones', disclaimer: 'El porcentaje considera únicamente los datos disponibles. No es asesoría financiera.',
    matches: 'Coincidencias', incompatibilities: 'Incompatibilidades', missingInformation: 'Información faltante', none: 'Ninguna',
    matchesCount: 'Coincide con {matched} de {total}', preferences: 'preferencias indicadas', planFrom: 'Plan desde', priceUnavailable: 'precio no disponible', account: 'Cuenta', undefinedAccount: 'por definir',
    details: 'Ver detalles', visit: 'Visitar', activeOffer: 'Oferta activa', noResults: 'No encontramos firmas compatibles con los filtros obligatorios.',
    countries: { CO: 'Colombia', MX: 'México', AR: 'Argentina', CL: 'Chile', PE: 'Perú', BR: 'Brasil', EC: 'Ecuador', PA: 'Panamá', DO: 'República Dominicana' },
    reasonOperates: 'Opera {market}', reasonDoesNotOperate: 'No opera {market}', reasonSplit: 'Profit split de hasta {value}%', reasonUnavailable: '{label}: dato no disponible', reasonPayoutVia: 'Payout {label} mediante {option} · {challenge}', reasonPayout: 'Payout {label} · {challenge}',
  },
  en: {
    steps: ['What you want to trade', 'How much you want to invest', 'How you trade', 'What you prioritize'], step: 'Step', of: 'of',
    country: 'Country', selectCountry: 'Select country', market: 'Market', noPreference: 'No preference', futures: 'Futures', crypto: 'Crypto', other: 'Other',
    experience: 'Experience', select: 'Select', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
    maxBudget: 'Maximum budget', undefined: 'Not specified', under50: 'Under $50', over500: 'Over $500', accountSize: 'Desired account size', evaluation: 'Evaluation type', instantFunding: 'Instant Funding',
    tradingStyle: 'Trading style', news: 'News', weekend: 'Swing / weekend', dayTrading: 'Day trading',
    priority: 'Main priority', lowPrice: 'Low price', flexibleRules: 'Flexible rules', highSplit: 'High profit split', verifiablePayouts: 'Verifiable payouts', wideDrawdown: 'Wide drawdown', noTimeLimit: 'No time limit',
    payoutPreference: 'Payout preference', fastPayout: 'Prioritize fast payouts', payoutHistory: 'Prioritize payout history', notImportant: 'Not important',
    previous: 'Previous', continue: 'Continue', transparentResults: 'Transparent results', bestOptions: 'Your best options', disclaimer: 'The percentage considers available data only. It is not financial advice.',
    matches: 'Matches', incompatibilities: 'Incompatibilities', missingInformation: 'Missing information', none: 'None',
    matchesCount: 'Matches {matched} of {total}', preferences: 'selected preferences', planFrom: 'Plan from', priceUnavailable: 'price unavailable', account: 'Account', undefinedAccount: 'not specified',
    details: 'View details', visit: 'Visit', activeOffer: 'Active offer', noResults: 'No firms match the required filters.',
    countries: { CO: 'Colombia', MX: 'Mexico', AR: 'Argentina', CL: 'Chile', PE: 'Peru', BR: 'Brazil', EC: 'Ecuador', PA: 'Panama', DO: 'Dominican Republic' },
    reasonOperates: 'Trades {market}', reasonDoesNotOperate: 'Does not trade {market}', reasonSplit: 'Profit split up to {value}%', reasonUnavailable: '{label}: data unavailable', reasonPayoutVia: 'Payout {label} via {option} · {challenge}', reasonPayout: 'Payout {label} · {challenge}',
  },
  pt: {
    steps: ['O que você quer operar', 'Quanto você quer investir', 'Como você opera', 'O que você prioriza'], step: 'Etapa', of: 'de',
    country: 'País', selectCountry: 'Selecionar país', market: 'Mercado', noPreference: 'Sem preferência', futures: 'Futuros', crypto: 'Cripto', other: 'Outros',
    experience: 'Experiência', select: 'Selecionar', beginner: 'Iniciante', intermediate: 'Intermediário', advanced: 'Avançado',
    maxBudget: 'Orçamento máximo', undefined: 'Não definido', under50: 'Menos de $50', over500: 'Mais de $500', accountSize: 'Tamanho de conta desejado', evaluation: 'Tipo de avaliação', instantFunding: 'Instant Funding',
    tradingStyle: 'Estilo de trading', news: 'Notícias', weekend: 'Swing / fim de semana', dayTrading: 'Day trading',
    priority: 'Prioridade principal', lowPrice: 'Preço baixo', flexibleRules: 'Regras flexíveis', highSplit: 'Profit split alto', verifiablePayouts: 'Payouts verificáveis', wideDrawdown: 'Drawdown amplo', noTimeLimit: 'Sem limite de tempo',
    payoutPreference: 'Preferência de payouts', fastPayout: 'Priorizar payout rápido', payoutHistory: 'Priorizar histórico de payouts', notImportant: 'Não é importante',
    previous: 'Anterior', continue: 'Continuar', transparentResults: 'Resultados transparentes', bestOptions: 'Suas melhores opções', disclaimer: 'A porcentagem considera apenas os dados disponíveis. Não é aconselhamento financeiro.',
    matches: 'Correspondências', incompatibilities: 'Incompatibilidades', missingInformation: 'Informações ausentes', none: 'Nenhuma',
    matchesCount: 'Corresponde a {matched} de {total}', preferences: 'preferências indicadas', planFrom: 'Plano a partir de', priceUnavailable: 'preço indisponível', account: 'Conta', undefinedAccount: 'não definido',
    details: 'Ver detalhes', visit: 'Visitar', activeOffer: 'Oferta ativa', noResults: 'Não encontramos firmas compatíveis com os filtros obrigatórios.',
    countries: { CO: 'Colômbia', MX: 'México', AR: 'Argentina', CL: 'Chile', PE: 'Peru', BR: 'Brasil', EC: 'Equador', PA: 'Panamá', DO: 'República Dominicana' },
    reasonOperates: 'Opera {market}', reasonDoesNotOperate: 'Não opera {market}', reasonSplit: 'Profit split de até {value}%', reasonUnavailable: '{label}: dado indisponível', reasonPayoutVia: 'Payout {label} por {option} · {challenge}', reasonPayout: 'Payout {label} · {challenge}',
  },
} as const

function finderTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template)
}

export function localizeFinderReason(reason: string, language?: PublicLanguage | null) {
  const code = publicUiLanguage(language)
  const copy = publicFinderCopy[code]
  const exact = finderReasons[code] as Record<string, string>
  if (exact[reason]) return exact[reason]
  if (reason.startsWith('Opera ')) return finderTemplate(copy.reasonOperates, { market: reason.slice(6) })
  if (reason.startsWith('No opera ')) return finderTemplate(copy.reasonDoesNotOperate, { market: reason.slice(9) })
  const split = reason.match(/^Profit split de hasta (.+)%$/)
  if (split) return finderTemplate(copy.reasonSplit, { value: split[1] })
  const unavailable = reason.match(/^(.+): dato no disponible$/)
  if (unavailable) return finderTemplate(copy.reasonUnavailable, { label: exact[unavailable[1]] ?? unavailable[1] })
  const payout = reason.match(/^Payout (.+?)(?: mediante (.+?))? · (.+)$/)
  if (payout) return finderTemplate(payout[2] ? copy.reasonPayoutVia : copy.reasonPayout, { label: payout[1], option: payout[2] ?? '', challenge: payout[3] })
  return reason
}

export const publicTradingRuleCopy = {
  es: { automatedTrading: 'EA / bots', weekendHolding: 'Mantener posiciones el fin de semana', copyTrading: 'Copy trading', scalping: 'Scalping' },
  en: { automatedTrading: 'EA / bots', weekendHolding: 'Weekend holding', copyTrading: 'Copy trading', scalping: 'Scalping' },
  pt: { automatedTrading: 'EA / bots', weekendHolding: 'Manter posições no fim de semana', copyTrading: 'Copy trading', scalping: 'Scalping' },
} as const

export const publicComparatorCopy = {
  es: {
    priorities: { price: 'Precio bajo', payout: 'Payout rápido', drawdown: 'Drawdown documentado', split: 'Profit split', platform: 'Plataforma', rules: 'Reglas simples' },
    noData: 'Sin dato', currencyUnknown: 'Moneda sin dato', phase: 'F', available: 'Disponible', restricted: 'No disponible', unverified: 'Sin verificar',
    compareFirms: 'Comparar firmas', compareForMe: 'Comparar para mí', tellUs: '1. Cuéntanos qué buscas', requirementsHelp: 'El mercado y presupuesto son requisitos; el tamaño exacto se prioriza. El resto ayuda a ordenar opciones.',
    market: 'Mercado', any: 'Cualquiera', desiredSize: 'Tamaño buscado', maxBudget: 'Presupuesto máximo · USD', noLimit: 'Sin límite', platform: 'Plataforma', prioritiesQuestion: '¿Qué te importa más? Elige hasta 3.', maxPriorities: 'Máximo de 3 prioridades. Deselecciona una para elegir otra.', tradingQuestion: '¿Cómo operas?', useEa: 'Uso EA / bots', tradeNews: 'Opero noticias', holdWeekend: 'Mantengo posiciones el fin de semana',
    searching: 'Buscando coincidencias…', viewMatches: 'Ver mis coincidencias', analyzing: 'Analizando programas disponibles…', matchesAria: 'Tus coincidencias', matchesStep: '2. Tus coincidencias', exploreOptions: 'Opciones para explorar', basedOn: 'Basado en', anyMarket: 'cualquier mercado', upTo: 'hasta USD {value}',
    resultsHelp: 'Las opciones visibles cumplen los requisitos con los datos disponibles. Si algunas siguen arriba al cambiar prioridades, comparten los criterios conocidos o el conjunto elegible es reducido.', resultsDisclaimer: 'Las coincidencias se calculan con reglas y características disponibles en Tradagora. Los datos faltantes no se consideran automáticamente negativos.', editPreferences: 'Editar preferencias', noExact: 'No encontramos una coincidencia exacta; estas son las opciones más cercanas. Revisa sus diferencias antes de decidir.',
    noneCountry: 'No encontramos opciones sin una restricción explícita para {country}. Ajusta el país o compara firmas manualmente para revisar los datos.', nonePrograms: 'No hay programas activos con planes disponibles para estos criterios. Puedes ajustar tus preferencias o comparar firmas manualmente.', exactPlan: 'Plan exacto', closestPlan: 'Plan más cercano', availabilityIn: 'Disponibilidad en {country}: {status}', priceUnknown: 'Precio sin dato', matchesEvaluable: 'Coincide con {matched} de {evaluable} preferencias evaluables', missingCriteria: '{count} sin datos suficientes o criterio no comparable', consider: 'Ten en cuenta', compareOption: 'Comparar esta opción', viewSources: 'Ver ficha y fuentes', less: 'Ver menos', moreOptions: 'Ver más opciones', addFirm: 'Añadir otra firma manualmente', selectFirm: 'Seleccionar firma', add: 'Añadir', compareDetail: '3. Comparar en detalle · {count} de 3 opciones seleccionadas', compareThese: 'Comparar estas opciones',
    selectFirmsAria: 'Seleccionar firmas', chooseThree: 'Elige hasta tres firmas', change: 'Cambiar', choose: 'Elegir', firm: 'Firma', optional: 'opcional', searchCatalog: 'Busca en el catálogo', remove: 'Quitar', suggestedComparisons: 'Comparaciones sugeridas', suggestedHelp: 'Selección editorial para empezar; no representa popularidad ni un ranking.', updating: 'Actualizando comparación…', selectPropFirm: 'Seleccionar Prop Firm', chooseFirm: 'Elegir firma', closeSelector: 'Cerrar selector', close: 'Cerrar', searchFirm: 'Buscar Prop Firm', all: 'Todas', editorialSuggestions: 'Sugerencias editoriales', availableFirms: 'Firmas disponibles', marketUnknown: 'Mercado sin dato', alreadyChosen: 'Ya elegida', noFilterResults: 'No encontramos firmas con ese filtro.',
    startChoosing: 'Empieza por elegir una firma', startHelp: 'Después podrás añadir hasta dos más y comparar programas reales.', differencesOnly: 'Mostrar solo diferencias', copied: 'Enlace copiado', share: 'Compartir comparación', copyPrompt: 'Copia el enlace de la comparación:', noPlan: 'Sin plan', phases: 'fases', highlightedDifferences: 'Diferencias que destacan', differencesHelp: 'Hasta cinco campos distintos entre las opciones seleccionadas; diferente no significa mejor ni peor.', noDifferences: 'Sin diferencias registradas en los campos disponibles.', comparedPrograms: 'Programas comparados', programsHelp: 'Selecciona otro programa o tamaño si la propuesta automática no es equivalente.', manualSelection: 'selección manual', automaticSelection: 'selección automática', exactComparison: 'Comparación equivalente por mercado, tamaño, fases, tipo de programa y moneda conocidos.', approximateComparison: 'Comparación aproximada.', noEquivalent: 'No encontramos un plan equivalente exacto.', important: 'Lo que puede importarte', review: 'Revisar', accordingPriority: 'Según tu prioridad', meaning: '¿Qué significa?', noSectionDifferences: 'Sin diferencias conocidas en esta sección.',
    availabilityDecision: 'Disponibilidad y antes de decidir', originCountry: 'País de origen', availabilityFor: 'para', availabilityAt: 'en', chooseCountry: 'Selecciona tu país para revisar disponibilidad.', activeOffer: 'Oferta activa: {offer}. No influye en la comparación.', noActiveOffer: 'Sin oferta activa registrada.', visit: 'Visitar {name}', evidenceNotice: 'Las reglas del programa y la evidencia de payout son datos distintos. No mostramos métricas externas agregadas como si fueran pagos individuales ni inferimos términos no documentados.',
    sectionCost: 'Costo y cuenta', accountSize: 'Tamaño de cuenta', challengePrice: 'Precio del challenge', challengePriceHint: 'Solo precio conocido del challenge; no incluye cargos no documentados.', program: 'Programa', variant: 'Variante', sectionRisk: 'Objetivos y riesgo', targetPhase: 'Objetivo por fase', dailyLoss: 'Pérdida diaria', dailyLossHint: 'Límite de pérdida diario. Consulta también el periodo y la base de cálculo de la firma.', maxLoss: 'Pérdida máxima', maxLossHint: 'No basta con mirar el porcentaje: importa si el límite es estático o móvil y cómo se calcula.', drawdownType: 'Tipo de drawdown', drawdownBasis: 'Base de drawdown', minTradingDays: 'Días mínimos de trading', sectionRewards: 'Retiros y rewards del programa', rewardShown: 'Opción de reward mostrada', payoutFrequency: 'Frecuencia de payout', minPayoutDays: 'Mínimo de días de payout', rewardOptions: 'Opciones de reward', sectionFreedom: 'Libertad para operar', news: 'Noticias', allowed: 'Permitido', notAllowed: 'No permitido', sectionMarkets: 'Mercados y tecnología', markets: 'Mercados', platforms: 'Plataformas', instruments: 'Instrumentos', withdrawalMethods: 'Métodos de retiro', sectionEvidence: 'Evidencia disponible de la firma · Tradagora', verifiedPayouts: 'Payouts verificados', verifiedPayoutsHint: 'Agregado de payouts individuales verificados por Tradagora para la firma; no equivale a garantía para este programa.', verifiedAmount: 'Monto verificado (sin desglose de moneda)', lastEvidence: 'Última evidencia', noVerifiedData: 'Sin dato verificado',
  },
  en: {
    priorities: { price: 'Low price', payout: 'Fast payout', drawdown: 'Documented drawdown', split: 'Profit split', platform: 'Platform', rules: 'Simple rules' },
    noData: 'No data', currencyUnknown: 'Currency unavailable', phase: 'P', available: 'Available', restricted: 'Unavailable', unverified: 'Unverified',
    compareFirms: 'Compare firms', compareForMe: 'Compare for me', tellUs: '1. Tell us what you need', requirementsHelp: 'Market and budget are requirements; exact account size is prioritized. The rest helps rank the options.',
    market: 'Market', any: 'Any', desiredSize: 'Desired size', maxBudget: 'Maximum budget · USD', noLimit: 'No limit', platform: 'Platform', prioritiesQuestion: 'What matters most to you? Choose up to 3.', maxPriorities: 'Maximum of 3 priorities. Deselect one to choose another.', tradingQuestion: 'How do you trade?', useEa: 'I use EA / bots', tradeNews: 'I trade news', holdWeekend: 'I hold positions over the weekend',
    searching: 'Finding matches…', viewMatches: 'View my matches', analyzing: 'Analyzing available programs…', matchesAria: 'Your matches', matchesStep: '2. Your matches', exploreOptions: 'Options to explore', basedOn: 'Based on', anyMarket: 'any market', upTo: 'up to USD {value}',
    resultsHelp: 'Visible options meet the requirements using available data. If some remain on top after priorities change, they share known criteria or the eligible set is small.', resultsDisclaimer: 'Matches are calculated from rules and characteristics available in Tradagora. Missing data is not treated as automatically negative.', editPreferences: 'Edit preferences', noExact: 'No exact match was found; these are the closest options. Review their differences before deciding.',
    noneCountry: 'No options without an explicit restriction for {country} were found. Change the country or compare firms manually to review the data.', nonePrograms: 'There are no active programs with available plans for these criteria. Adjust your preferences or compare firms manually.', exactPlan: 'Exact plan', closestPlan: 'Closest plan', availabilityIn: 'Availability in {country}: {status}', priceUnknown: 'Price unavailable', matchesEvaluable: 'Matches {matched} of {evaluable} evaluable preferences', missingCriteria: '{count} with insufficient data or a non-comparable criterion', consider: 'Keep in mind', compareOption: 'Compare this option', viewSources: 'View profile and sources', less: 'Show less', moreOptions: 'Show more options', addFirm: 'Add another firm manually', selectFirm: 'Select firm', add: 'Add', compareDetail: '3. Compare in detail · {count} of 3 options selected', compareThese: 'Compare these options',
    selectFirmsAria: 'Select firms', chooseThree: 'Choose up to three firms', change: 'Change', choose: 'Choose', firm: 'Firm', optional: 'optional', searchCatalog: 'Search the catalog', remove: 'Remove', suggestedComparisons: 'Suggested comparisons', suggestedHelp: 'Editorial selection to get started; it does not represent popularity or a ranking.', updating: 'Updating comparison…', selectPropFirm: 'Select Prop Firm', chooseFirm: 'Choose firm', closeSelector: 'Close selector', close: 'Close', searchFirm: 'Search Prop Firm', all: 'All', editorialSuggestions: 'Editorial suggestions', availableFirms: 'Available firms', marketUnknown: 'Market unavailable', alreadyChosen: 'Already selected', noFilterResults: 'No firms match this filter.',
    startChoosing: 'Start by choosing a firm', startHelp: 'You can then add up to two more and compare real programs.', differencesOnly: 'Show differences only', copied: 'Link copied', share: 'Share comparison', copyPrompt: 'Copy the comparison link:', noPlan: 'No plan', phases: 'phases', highlightedDifferences: 'Notable differences', differencesHelp: 'Up to five fields that differ across the selected options; different does not mean better or worse.', noDifferences: 'No differences recorded in the available fields.', comparedPrograms: 'Compared programs', programsHelp: 'Select another program or size if the automatic proposal is not equivalent.', manualSelection: 'manual selection', automaticSelection: 'automatic selection', exactComparison: 'Equivalent comparison by known market, size, phases, program type, and currency.', approximateComparison: 'Approximate comparison.', noEquivalent: 'No exact equivalent plan was found.', important: 'What may matter to you', review: 'Review', accordingPriority: 'Based on your priority', meaning: 'What does this mean?', noSectionDifferences: 'No known differences in this section.',
    availabilityDecision: 'Availability and what to review before deciding', originCountry: 'Country of origin', availabilityFor: 'for', availabilityAt: 'in', chooseCountry: 'Select your country to review availability.', activeOffer: 'Active offer: {offer}. It does not affect the comparison.', noActiveOffer: 'No active offer recorded.', visit: 'Visit {name}', evidenceNotice: 'Program rules and payout evidence are separate data. We do not present aggregated external metrics as individual payouts or infer undocumented terms.',
    sectionCost: 'Cost and account', accountSize: 'Account size', challengePrice: 'Challenge price', challengePriceHint: 'Known challenge price only; it excludes undocumented fees.', program: 'Program', variant: 'Variant', sectionRisk: 'Targets and risk', targetPhase: 'Target by phase', dailyLoss: 'Daily loss', dailyLossHint: 'Daily loss limit. Also check the period and calculation basis used by the firm.', maxLoss: 'Maximum loss', maxLossHint: 'The percentage alone is not enough: whether the limit is static or trailing and how it is calculated also matter.', drawdownType: 'Drawdown type', drawdownBasis: 'Drawdown basis', minTradingDays: 'Minimum trading days', sectionRewards: 'Program payouts and rewards', rewardShown: 'Displayed reward option', payoutFrequency: 'Payout frequency', minPayoutDays: 'Minimum payout days', rewardOptions: 'Reward options', sectionFreedom: 'Trading freedom', news: 'News', allowed: 'Allowed', notAllowed: 'Not allowed', sectionMarkets: 'Markets and technology', markets: 'Markets', platforms: 'Platforms', instruments: 'Instruments', withdrawalMethods: 'Withdrawal methods', sectionEvidence: 'Available firm evidence · Tradagora', verifiedPayouts: 'Verified payouts', verifiedPayoutsHint: 'Aggregate of individual payouts verified by Tradagora for the firm; it is not a guarantee for this program.', verifiedAmount: 'Verified amount (without currency breakdown)', lastEvidence: 'Latest evidence', noVerifiedData: 'No verified data',
  },
  pt: {
    priorities: { price: 'Preço baixo', payout: 'Payout rápido', drawdown: 'Drawdown documentado', split: 'Profit split', platform: 'Plataforma', rules: 'Regras simples' },
    noData: 'Sem dados', currencyUnknown: 'Moeda indisponível', phase: 'F', available: 'Disponível', restricted: 'Indisponível', unverified: 'Sem verificação',
    compareFirms: 'Comparar firmas', compareForMe: 'Comparar para mim', tellUs: '1. Conte-nos o que você busca', requirementsHelp: 'Mercado e orçamento são requisitos; o tamanho exato é priorizado. O restante ajuda a ordenar as opções.',
    market: 'Mercado', any: 'Qualquer', desiredSize: 'Tamanho desejado', maxBudget: 'Orçamento máximo · USD', noLimit: 'Sem limite', platform: 'Plataforma', prioritiesQuestion: 'O que mais importa para você? Escolha até 3.', maxPriorities: 'Máximo de 3 prioridades. Desmarque uma para escolher outra.', tradingQuestion: 'Como você opera?', useEa: 'Uso EA / bots', tradeNews: 'Opero notícias', holdWeekend: 'Mantenho posições no fim de semana',
    searching: 'Buscando correspondências…', viewMatches: 'Ver minhas correspondências', analyzing: 'Analisando programas disponíveis…', matchesAria: 'Suas correspondências', matchesStep: '2. Suas correspondências', exploreOptions: 'Opções para explorar', basedOn: 'Com base em', anyMarket: 'qualquer mercado', upTo: 'até USD {value}',
    resultsHelp: 'As opções visíveis atendem aos requisitos com os dados disponíveis. Se algumas continuarem no topo ao mudar prioridades, elas compartilham critérios conhecidos ou o conjunto elegível é reduzido.', resultsDisclaimer: 'As correspondências são calculadas com regras e características disponíveis na Tradagora. Dados ausentes não são considerados automaticamente negativos.', editPreferences: 'Editar preferências', noExact: 'Não encontramos uma correspondência exata; estas são as opções mais próximas. Revise as diferenças antes de decidir.',
    noneCountry: 'Não encontramos opções sem uma restrição explícita para {country}. Ajuste o país ou compare firmas manualmente para revisar os dados.', nonePrograms: 'Não há programas ativos com planos disponíveis para estes critérios. Ajuste suas preferências ou compare firmas manualmente.', exactPlan: 'Plano exato', closestPlan: 'Plano mais próximo', availabilityIn: 'Disponibilidade em {country}: {status}', priceUnknown: 'Preço indisponível', matchesEvaluable: 'Corresponde a {matched} de {evaluable} preferências avaliáveis', missingCriteria: '{count} sem dados suficientes ou critério não comparável', consider: 'Leve em conta', compareOption: 'Comparar esta opção', viewSources: 'Ver perfil e fontes', less: 'Ver menos', moreOptions: 'Ver mais opções', addFirm: 'Adicionar outra firma manualmente', selectFirm: 'Selecionar firma', add: 'Adicionar', compareDetail: '3. Comparar em detalhe · {count} de 3 opções selecionadas', compareThese: 'Comparar estas opções',
    selectFirmsAria: 'Selecionar firmas', chooseThree: 'Escolha até três firmas', change: 'Alterar', choose: 'Escolher', firm: 'Firma', optional: 'opcional', searchCatalog: 'Buscar no catálogo', remove: 'Remover', suggestedComparisons: 'Comparações sugeridas', suggestedHelp: 'Seleção editorial para começar; não representa popularidade nem ranking.', updating: 'Atualizando comparação…', selectPropFirm: 'Selecionar Prop Firm', chooseFirm: 'Escolher firma', closeSelector: 'Fechar seletor', close: 'Fechar', searchFirm: 'Buscar Prop Firm', all: 'Todas', editorialSuggestions: 'Sugestões editoriais', availableFirms: 'Firmas disponíveis', marketUnknown: 'Mercado indisponível', alreadyChosen: 'Já selecionada', noFilterResults: 'Não encontramos firmas com esse filtro.',
    startChoosing: 'Comece escolhendo uma firma', startHelp: 'Depois você poderá adicionar até mais duas e comparar programas reais.', differencesOnly: 'Mostrar apenas diferenças', copied: 'Link copiado', share: 'Compartilhar comparação', copyPrompt: 'Copie o link da comparação:', noPlan: 'Sem plano', phases: 'fases', highlightedDifferences: 'Diferenças em destaque', differencesHelp: 'Até cinco campos diferentes entre as opções selecionadas; diferente não significa melhor nem pior.', noDifferences: 'Sem diferenças registradas nos campos disponíveis.', comparedPrograms: 'Programas comparados', programsHelp: 'Selecione outro programa ou tamanho se a proposta automática não for equivalente.', manualSelection: 'seleção manual', automaticSelection: 'seleção automática', exactComparison: 'Comparação equivalente por mercado, tamanho, fases, tipo de programa e moeda conhecidos.', approximateComparison: 'Comparação aproximada.', noEquivalent: 'Não encontramos um plano equivalente exato.', important: 'O que pode importar para você', review: 'Revisar', accordingPriority: 'Segundo sua prioridade', meaning: 'O que isso significa?', noSectionDifferences: 'Sem diferenças conhecidas nesta seção.',
    availabilityDecision: 'Disponibilidade e antes de decidir', originCountry: 'País de origem', availabilityFor: 'para', availabilityAt: 'em', chooseCountry: 'Selecione seu país para revisar a disponibilidade.', activeOffer: 'Oferta ativa: {offer}. Não influencia a comparação.', noActiveOffer: 'Sem oferta ativa registrada.', visit: 'Visitar {name}', evidenceNotice: 'As regras do programa e a evidência de payout são dados distintos. Não mostramos métricas externas agregadas como se fossem pagamentos individuais nem inferimos termos não documentados.',
    sectionCost: 'Custo e conta', accountSize: 'Tamanho da conta', challengePrice: 'Preço do challenge', challengePriceHint: 'Apenas o preço conhecido do challenge; não inclui taxas não documentadas.', program: 'Programa', variant: 'Variante', sectionRisk: 'Objetivos e risco', targetPhase: 'Objetivo por fase', dailyLoss: 'Perda diária', dailyLossHint: 'Limite de perda diária. Consulte também o período e a base de cálculo da firma.', maxLoss: 'Perda máxima', maxLossHint: 'Não basta olhar a porcentagem: importa se o limite é estático ou móvel e como é calculado.', drawdownType: 'Tipo de drawdown', drawdownBasis: 'Base de drawdown', minTradingDays: 'Dias mínimos de trading', sectionRewards: 'Saques e rewards do programa', rewardShown: 'Opção de reward exibida', payoutFrequency: 'Frequência de payout', minPayoutDays: 'Mínimo de dias de payout', rewardOptions: 'Opções de reward', sectionFreedom: 'Liberdade para operar', news: 'Notícias', allowed: 'Permitido', notAllowed: 'Não permitido', sectionMarkets: 'Mercados e tecnologia', markets: 'Mercados', platforms: 'Plataformas', instruments: 'Instrumentos', withdrawalMethods: 'Métodos de saque', sectionEvidence: 'Evidência disponível da firma · Tradagora', verifiedPayouts: 'Payouts verificados', verifiedPayoutsHint: 'Agregado de payouts individuais verificados pela Tradagora para a firma; não equivale a garantia para este programa.', verifiedAmount: 'Valor verificado (sem detalhamento de moeda)', lastEvidence: 'Última evidência', noVerifiedData: 'Sem dado verificado',
  },
} as const

export function comparatorText(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template)
}

export function localizeComparatorOutput(value: string, language?: PublicLanguage | null) {
  if (publicUiLanguage(language) === 'es') return value
  const pt = publicUiLanguage(language) === 'pt'
  const replacements: Array<[RegExp, string]> = pt ? [
    [/No encontramos planes activos para comparar\./g, 'Não encontramos planos ativos para comparar.'], [/no encontramos un plan comparable/g, 'não encontramos um plano comparável'], [/mercado sin dato completo/g, 'mercado sem dados completos'], [/estas firmas operan modelos\/mercados diferentes/g, 'estas firmas operam modelos/mercados diferentes'], [/tamaño sin dato completo/g, 'tamanho sem dados completos'], [/fases sin dato completo/g, 'fases sem dados completos'], [/tipo de programa sin dato completo/g, 'tipo de programa sem dados completos'], [/tipo de programa distinto/g, 'tipo de programa diferente'], [/moneda distinta o sin dato/g, 'moeda diferente ou sem dados'], [/ frente a /g, ' em comparação com '],
    [/Disponible en ([A-Z]+) según las restricciones publicadas por la firma\./g, 'Disponível em $1 segundo as restrições publicadas pela firma.'], [/No disponible en ([A-Z]+) según una restricción oficial aplicable\./g, 'Indisponível em $1 segundo uma restrição oficial aplicável.'], [/Sin dato verificado de disponibilidad para ([A-Z]+)\./g, 'Sem dado verificado de disponibilidade para $1.'], [/Mercado sin dato confirmado\./g, 'Mercado sem dado confirmado.'], [/Opera ([^.]+)\./g, 'Opera $1.'], [/Mercado diferente: (.+) en lugar de (.+)\./g, 'Mercado diferente: $1 em vez de $2.'], [/Tamaño de cuenta sin dato\./g, 'Tamanho da conta sem dados.'], [/Plan de (.+), exactamente el tamaño solicitado\./g, 'Plano de $1, exatamente o tamanho solicitado.'], [/El plan más cercano disponible aquí es (.+), no (.+)\./g, 'O plano mais próximo disponível aqui é $1, não $2.'], [/Precio o moneda sin dato: presupuesto no verificable\./g, 'Preço ou moeda sem dados: orçamento não verificável.'], [/El precio está en (.+); no convertimos monedas para evaluar tu presupuesto en USD\./g, 'O preço está em $1; não convertemos moedas para avaliar seu orçamento em USD.'], [/Precio USD (.+) dentro de tu presupuesto\./g, 'Preço USD $1 dentro do seu orçamento.'], [/Precio USD (.+) supera tu máximo de USD (.+)\./g, 'O preço USD $1 supera seu máximo de USD $2.'],
    [/Sin mínimo de días de payout documentado para la opción mostrada\./g, 'Sem mínimo de dias de payout documentado para a opção exibida.'], [/La opción (.+) registra mínimo de (\d+) días \(criterio rápido: hasta 7\)\./g, 'A opção $1 registra mínimo de $2 dias (critério rápido: até 7).'], [/La opción mostrada registra un mínimo de (\d+) días, superior a 7\./g, 'A opção exibida registra um mínimo de $1 dias, superior a 7.'], [/Sin dato de compatibilidad con (.+)\./g, 'Sem dado de compatibilidade com $1.'], [/(.+) figura entre sus plataformas registradas\./g, '$1 aparece entre suas plataformas registradas.'], [/(.+) no figura entre sus plataformas registradas\./g, '$1 não aparece entre suas plataformas registradas.'], [/Sin dato suficiente sobre (.+)\./g, 'Sem dados suficientes sobre $1.'], [/(.+) figura como permitido para la firma\./g, '$1 aparece como permitido para a firma.'], [/(.+) figura como no permitido para la firma\./g, '$1 aparece como não permitido para a firma.'],
    [/Drawdown documentado para revisar: (.+)\./g, 'Drawdown documentado para revisar: $1.'], [/No declaramos un drawdown mejor sin comparar la metodología de cálculo\./g, 'Não declaramos um drawdown melhor sem comparar a metodologia de cálculo.'], [/Drawdown sin datos estructurados suficientes; no se cuenta como coincidencia\./g, 'Drawdown sem dados estruturados suficientes; não conta como correspondência.'], [/La simplicidad de reglas no tiene un indicador estructurado seguro; no se cuenta como coincidencia\./g, 'A simplicidade das regras não tem um indicador estruturado seguro; não conta como correspondência.'], [/Precio bajo: faltan precios comparables en la misma moneda y tamaño\./g, 'Preço baixo: faltam preços comparáveis na mesma moeda e tamanho.'], [/Precio (.+): el menor entre planes comparables del catálogo\./g, 'Preço $1: o menor entre planos comparáveis do catálogo.'], [/Hay un plan comparable con menor precio conocido en (.+)\./g, 'Há um plano comparável com menor preço conhecido em $1.'], [/Profit split: faltan opciones comparables documentadas\./g, 'Profit split: faltam opções comparáveis documentadas.'], [/Split (.+)% de la opción (.+): el mayor conocido entre planes comparables\./g, 'Split de $1% da opção $2: o maior conhecido entre planos comparáveis.'], [/La opción mostrada registra split (.+)%; hay uno mayor entre planes comparables\./g, 'A opção exibida registra split de $1%; há um maior entre planos comparáveis.'],
    [/Según las restricciones publicadas por la firma\./g, 'Segundo as restrições publicadas pela firma.'], [/tamaño /g, 'tamanho '], [/Precio del challenge/g, 'Preço do challenge'], [/(.+) tiene el menor precio conocido entre estos planes\. No incluye cargos no documentados\./g, '$1 tem o menor preço conhecido entre estes planos. Não inclui taxas não documentadas.'], [/Plataforma solicitada/g, 'Plataforma solicitada'], [/(.+) incluye (.+) en los datos disponibles\./g, '$1 inclui $2 nos dados disponíveis.'], [/(.+) incluyen (.+) en los datos disponibles\./g, '$1 incluem $2 nos dados disponíveis.'], [/Cómo se calcula el drawdown/g, 'Como o drawdown é calculado'], [/Los tipos o bases de drawdown disponibles difieren\. Revisa las reglas originales antes de comparar solo el porcentaje\./g, 'Os tipos ou bases de drawdown disponíveis diferem. Revise as regras originais antes de comparar apenas a porcentagem.'], [/Mínimo de días registrado/g, 'Mínimo de dias registrado'], [/(.+) registra el menor mínimo de días para la opción mostrada; verifica las condiciones y la fecha real del retiro\./g, '$1 registra o menor mínimo de dias para a opção exibida; verifique as condições e a data real do saque.'], [/Plan no disponible/g, 'Plano indisponível'], [/Al menos una firma no tiene un plan comparable en los datos actuales\./g, 'Pelo menos uma firma não tem um plano comparável nos dados atuais.'], [/Precios incompletos/g, 'Preços incompletos'], [/No hay precio conocido para todos los planes; no interpretes un dato ausente como gratuito\./g, 'Não há preço conhecido para todos os planos; não interprete um dado ausente como gratuito.'], [/daily /g, 'diário '], [/tipo sin dato/g, 'tipo sem dados'], [/base sin dato/g, 'base sem dados'], [/sin dato/g, 'sem dados'], [/Noticias/g, 'Notícias'], [/del plan/g, 'do plano'], [/mostrada/g, 'exibida'],
  ] : [
    [/No encontramos planes activos para comparar\./g, 'No active plans were found to compare.'], [/no encontramos un plan comparable/g, 'no comparable plan was found'], [/mercado sin dato completo/g, 'market data incomplete'], [/estas firmas operan modelos\/mercados diferentes/g, 'these firms operate different models/markets'], [/tamaño sin dato completo/g, 'size data incomplete'], [/fases sin dato completo/g, 'phase data incomplete'], [/tipo de programa sin dato completo/g, 'program type data incomplete'], [/tipo de programa distinto/g, 'different program type'], [/moneda distinta o sin dato/g, 'different or unavailable currency'], [/ frente a /g, ' versus '],
    [/Disponible en ([A-Z]+) según las restricciones publicadas por la firma\./g, 'Available in $1 according to the restrictions published by the firm.'], [/No disponible en ([A-Z]+) según una restricción oficial aplicable\./g, 'Unavailable in $1 according to an applicable official restriction.'], [/Sin dato verificado de disponibilidad para ([A-Z]+)\./g, 'No verified availability data for $1.'], [/Mercado sin dato confirmado\./g, 'Market not confirmed.'], [/Opera ([^.]+)\./g, 'Trades $1.'], [/Mercado diferente: (.+) en lugar de (.+)\./g, 'Different market: $1 instead of $2.'], [/Tamaño de cuenta sin dato\./g, 'Account size unavailable.'], [/Plan de (.+), exactamente el tamaño solicitado\./g, '$1 plan, exactly the requested size.'], [/El plan más cercano disponible aquí es (.+), no (.+)\./g, 'The closest plan available here is $1, not $2.'], [/Precio o moneda sin dato: presupuesto no verificable\./g, 'Price or currency unavailable: budget cannot be verified.'], [/El precio está en (.+); no convertimos monedas para evaluar tu presupuesto en USD\./g, 'The price is in $1; currencies are not converted to evaluate your USD budget.'], [/Precio USD (.+) dentro de tu presupuesto\./g, 'USD $1 price within your budget.'], [/Precio USD (.+) supera tu máximo de USD (.+)\./g, 'USD $1 price exceeds your USD $2 maximum.'],
    [/Sin mínimo de días de payout documentado para la opción mostrada\./g, 'No documented minimum payout days for the displayed option.'], [/La opción (.+) registra mínimo de (\d+) días \(criterio rápido: hasta 7\)\./g, 'The $1 option records a minimum of $2 days (fast criterion: up to 7).'], [/La opción mostrada registra un mínimo de (\d+) días, superior a 7\./g, 'The displayed option records a minimum of $1 days, above 7.'], [/Sin dato de compatibilidad con (.+)\./g, 'No compatibility data for $1.'], [/(.+) figura entre sus plataformas registradas\./g, '$1 is listed among its registered platforms.'], [/(.+) no figura entre sus plataformas registradas\./g, '$1 is not listed among its registered platforms.'], [/Sin dato suficiente sobre (.+)\./g, 'Insufficient data about $1.'], [/(.+) figura como permitido para la firma\./g, '$1 is listed as allowed by the firm.'], [/(.+) figura como no permitido para la firma\./g, '$1 is listed as not allowed by the firm.'],
    [/Drawdown documentado para revisar: (.+)\./g, 'Documented drawdown to review: $1.'], [/No declaramos un drawdown mejor sin comparar la metodología de cálculo\./g, 'We do not declare a better drawdown without comparing the calculation methodology.'], [/Drawdown sin datos estructurados suficientes; no se cuenta como coincidencia\./g, 'Drawdown lacks sufficient structured data; it is not counted as a match.'], [/La simplicidad de reglas no tiene un indicador estructurado seguro; no se cuenta como coincidencia\./g, 'Rule simplicity has no reliable structured indicator; it is not counted as a match.'], [/Precio bajo: faltan precios comparables en la misma moneda y tamaño\./g, 'Low price: comparable prices in the same currency and size are missing.'], [/Precio (.+): el menor entre planes comparables del catálogo\./g, 'Price $1: the lowest among comparable catalog plans.'], [/Hay un plan comparable con menor precio conocido en (.+)\./g, 'A comparable plan has a lower known price in $1.'], [/Profit split: faltan opciones comparables documentadas\./g, 'Profit split: documented comparable options are missing.'], [/Split (.+)% de la opción (.+): el mayor conocido entre planes comparables\./g, '$1% split for the $2 option: the highest known among comparable plans.'], [/La opción mostrada registra split (.+)%; hay uno mayor entre planes comparables\./g, 'The displayed option records a $1% split; a higher one exists among comparable plans.'],
    [/Según las restricciones publicadas por la firma\./g, 'According to the restrictions published by the firm.'], [/tamaño /g, 'size '], [/ fases/g, ' phases'], [/Precio del challenge/g, 'Challenge price'], [/(.+) tiene el menor precio conocido entre estos planes\. No incluye cargos no documentados\./g, '$1 has the lowest known price among these plans. It excludes undocumented fees.'], [/Plataforma solicitada/g, 'Requested platform'], [/(.+) incluye (.+) en los datos disponibles\./g, '$1 includes $2 in the available data.'], [/(.+) incluyen (.+) en los datos disponibles\./g, '$1 include $2 in the available data.'], [/Cómo se calcula el drawdown/g, 'How drawdown is calculated'], [/Los tipos o bases de drawdown disponibles difieren\. Revisa las reglas originales antes de comparar solo el porcentaje\./g, 'The available drawdown types or bases differ. Review the original rules before comparing the percentage alone.'], [/Mínimo de días registrado/g, 'Recorded minimum days'], [/(.+) registra el menor mínimo de días para la opción mostrada; verifica las condiciones y la fecha real del retiro\./g, '$1 records the lowest minimum days for the displayed option; verify the conditions and actual withdrawal date.'], [/Plan no disponible/g, 'Plan unavailable'], [/Al menos una firma no tiene un plan comparable en los datos actuales\./g, 'At least one firm has no comparable plan in the current data.'], [/Precios incompletos/g, 'Incomplete prices'], [/No hay precio conocido para todos los planes; no interpretes un dato ausente como gratuito\./g, 'A known price is not available for every plan; do not interpret missing data as free.'], [/tipo sin dato/g, 'type unavailable'], [/base sin dato/g, 'basis unavailable'], [/sin dato/g, 'no data'], [/Noticias/g, 'News'], [/del plan/g, 'plan'], [/mostrada/g, 'displayed'],
  ]
  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
}
