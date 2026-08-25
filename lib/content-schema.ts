export type ContentFieldSchema = {
  name: string
  label: string
  type?: 'text' | 'textarea'
  fallback: string
}

export type ContentSectionSchema = {
  name: string
  label: string
  description: string
  fields: ContentFieldSchema[]
}

export type ContentPageSchema = {
  slug: string
  label: string
  publicPath: string
  description: string
  sections: ContentSectionSchema[]
}

const standardHero = (title: string, subtitle: string): ContentSectionSchema => ({
  name: 'hero', label: 'Hero', description: 'Encabezado principal de la página.',
  fields: [
    { name: 'badge', label: 'Badge', fallback: 'Tragadora' },
    { name: 'title', label: 'Título', fallback: title },
    { name: 'subtitle', label: 'Subtítulo', type: 'textarea', fallback: subtitle },
    { name: 'primary_cta', label: 'Texto botón principal', fallback: 'Explorar' },
    { name: 'secondary_cta', label: 'Texto botón secundario', fallback: 'Ver metodología' },
  ],
})

const previewSection = (name: string, label: string, description: string, badge: string, title: string, subtitle: string, cta?: string): ContentSectionSchema => ({
  name, label, description,
  fields: [
    { name: 'badge', label: 'Badge', fallback: badge },
    { name: 'title', label: 'Título', fallback: title },
    { name: 'subtitle', label: 'Subtítulo', type: 'textarea', fallback: subtitle },
    ...(cta ? [{ name: 'cta', label: 'Texto del botón', fallback: cta }] : []),
  ],
})

export const contentPages: ContentPageSchema[] = [
  {
    slug: 'home', label: 'Home', publicPath: '/', description: 'Portada y accesos principales.',
    sections: [
      standardHero('Compara antes de poner tu capital en juego.', 'Prop firms, ofertas y pagos verificados en un mismo lugar.'),
      previewSection('payouts_preview', 'Resumen de payouts', 'Vista breve de actividad verificada.', 'Payout tracker', 'Pagos reales. Evidencia rastreable.', 'Una lectura rápida de la actividad registrada.', 'Ver Payout Tracker'),
      previewSection('featured_firms', 'Prop Firms destacadas', 'Preview del directorio de firmas.', 'Directorio', 'Prop Firms destacadas', 'Firmas con datos disponibles para comparar.', 'Ver todas las firmas'),
      previewSection('featured_offers', 'Ofertas destacadas', 'Preview de promociones vigentes.', 'Ofertas vigentes', 'Beneficios activos ahora.', 'Promociones configuradas y dentro de su vigencia.', 'Ver todas las ofertas'),
      previewSection('methodology', 'Metodología', 'Explicación sobre la trazabilidad.', 'Metodología', 'La confianza necesita trazabilidad.', 'Separamos datos observados, información declarada y enlaces comerciales.'),
      previewSection('finder', 'Buscador de Prop Firms', 'Experiencia principal de recomendación.', 'Recomendador', 'Encuentra la Prop Firm adecuada para ti', 'Cuéntanos cómo operas y Tragadora compara las firmas por ti.', 'Encontrar mis mejores opciones'),
      { name: 'final_cta', label: 'CTA final', description: 'Cierre de la portada.', fields: [
        { name: 'badge', label: 'Badge', fallback: 'Decide con contexto' },
        { name: 'title', label: 'Título', fallback: 'Menos promesas. Más datos para comparar.' },
        { name: 'cta', label: 'Texto del botón', fallback: 'Explorar firmas' },
      ]},
    ],
  },
  { slug: 'payouts', label: 'Payouts', publicPath: '/payouts', description: 'Tracker público de pagos.', sections: [standardHero('Pagos verificados, en un solo lugar.', 'Explora actividad, rankings y evidencia de pagos rastreables.'), previewSection('methodology', 'Metodología', 'Cómo se verifican los pagos.', 'Verificación', 'Cómo verificamos los payouts', 'Contrastamos fuentes y registros on-chain.')] },
  { slug: 'prop-firms', label: 'Prop Firms', publicPath: '/prop-firms', description: 'Directorio público de firmas.', sections: [standardHero('Prop Firms para comparar con criterio.', 'Revisa datos, condiciones y actividad antes de elegir.')] },
  { slug: 'comparador', label: 'Comparador', publicPath: '/comparador', description: 'Comparador de firmas.', sections: [standardHero('Compara firmas lado a lado.', 'Elige las variables que importan para tu operativa.')] },
  { slug: 'ofertas', label: 'Ofertas', publicPath: '/ofertas', description: 'Promociones vigentes.', sections: [standardHero('Ofertas activas para traders.', 'Consulta descuentos configurados y su vigencia.')] },
  { slug: 'brokers', label: 'Brokers', publicPath: '/brokers', description: 'Exploración de brokers.', sections: [standardHero('Brokers para operar tu capital.', 'Una sección preparada para comparar opciones disponibles.')] },
  { slug: 'herramientas', label: 'Herramientas', publicPath: '/herramientas', description: 'Herramientas para traders.', sections: [standardHero('Herramientas para tomar mejores decisiones.', 'Recursos prácticos para organizar tu operativa.')] },
  { slug: 'comunidades', label: 'Comunidades', publicPath: '/comunidades', description: 'Comunidades de trading.', sections: [standardHero('Comunidades para aprender y compartir.', 'Encuentra espacios relevantes para traders.')] },
  { slug: 'exchanges', label: 'Exchanges', publicPath: '/exchanges', description: 'Exploración de exchanges.', sections: [standardHero('Exchanges y mercados cripto.', 'Compara alternativas desde una vista clara.')] },
  { slug: 'blog', label: 'Blog', publicPath: '/blog', description: 'Contenido editorial.', sections: [standardHero('Ideas, análisis y guías.', 'Contenido para entender mejor el ecosistema de trading.')] },
  { slug: 'giveaway', label: 'Giveaway', publicPath: '/giveaway', description: 'Sorteos y campañas.', sections: [standardHero('Giveaways para la comunidad.', 'Consulta campañas activas y sus condiciones.')] },
]

export function getContentPage(slug: string) {
  return contentPages.find((page) => page.slug === slug)
}
