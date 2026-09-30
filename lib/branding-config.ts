export const BRANDING_SLOTS = [
  { key: 'logo_on_dark', label: 'Logo principal para fondo oscuro', description: 'Logo global de alto contraste para superficies navy u oscuras.', fallback: '/brand/tradagora-logo-light.png' },
  { key: 'logo_on_light', label: 'Logo principal para fondo claro', description: 'Logo global para superficies blancas o claras.', fallback: '/brand/tradagora-logo-dark.png' },
  { key: 'logo_symbol', label: 'Isotipo principal', description: 'Símbolo compacto de Tradagora sin wordmark.', fallback: '/brand/tradagora-icon.png' },
  { key: 'favicon', label: 'Favicon', description: 'Icono utilizado por pestañas y favoritos del navegador.', fallback: '/brand/tradagora-app-icon.png' },
  { key: 'apple_touch_icon', label: 'Apple Touch Icon', description: 'Icono al guardar Tradagora en dispositivos Apple.', fallback: '/brand/tradagora-app-icon.png' },
  { key: 'organization_logo', label: 'Logo de Organization / buscadores', description: 'Logo horizontal oficial para datos estructurados y buscadores sobre fondo claro.', fallback: 'logo_on_light' },
  { key: 'login_logo', label: 'Logo de Login', description: 'Identidad mostrada en la pantalla administrativa de acceso.', fallback: 'logo_on_light' },
  { key: 'admin_logo', label: 'Logo del Admin', description: 'Wordmark de la barra lateral del panel administrativo.', fallback: 'logo_on_light' },
  { key: 'navbar_desktop_logo', label: 'Navbar público — desktop', description: 'Logo horizontal del navbar sobre fondo oscuro.', fallback: 'logo_on_dark' },
  { key: 'navbar_mobile_logo', label: 'Navbar público — móvil', description: 'Marca compacta usada en pantallas pequeñas.', fallback: 'logo_symbol' },
  { key: 'footer_logo', label: 'Footer público', description: 'Logo utilizado sobre el fondo oscuro del footer.', fallback: 'logo_on_dark' },
  { key: 'og_image', label: 'Open Graph / redes', description: 'Imagen predeterminada al compartir Tradagora.', fallback: 'logo_on_dark' },
  { key: 'pwa_icon', label: 'Icono PWA', description: 'Reservado para el manifest cuando la aplicación lo incorpore.', fallback: 'logo_symbol' },
] as const

export const BRANDING_CACHE_TAG = 'global-branding'

export type BrandingSlotKey = (typeof BRANDING_SLOTS)[number]['key']
export type BrandingAsset = {
  key: BrandingSlotKey
  mediaId: string | null
  fileName: string
  url: string
  alt: string
  fileType: string | null
  configured: boolean
}
export type BrandingConfig = Record<BrandingSlotKey, BrandingAsset>

export const BRANDING_KEYS = new Set<string>(BRANDING_SLOTS.map((slot) => slot.key))
