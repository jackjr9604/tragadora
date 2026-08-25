import type { HomePlatform } from '@/lib/home-data'

export function PlatformLogo({ platform, small = false }: { platform: HomePlatform; small?: boolean }) {
  const classes = small ? 'size-8 rounded-lg' : 'size-12 rounded-xl'
  return platform.logoUrl ? (
    // Storage domains are configured from Supabase and intentionally remain unoptimized.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={platform.logoUrl} alt={platform.logoAlt || platform.name} className={`${classes} bg-white/5 object-contain p-1`} />
  ) : <span className={`${classes} flex items-center justify-center bg-white/5 font-bold text-slate-400`}>{platform.name.slice(0, 1)}</span>
}
