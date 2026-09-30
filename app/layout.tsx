import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getBranding } from '@/lib/branding';
import { SITE_URL } from '@/lib/site-url';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  const description = 'Compara Prop Firms, ofertas y payouts verificados con datos para traders de Latinoamérica.';
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: 'Tradagora',
    title: { default: 'Tradagora | Datos para traders', template: '%s | Tradagora' },
    description,
    icons: {
      icon: [{ url: '/brand/favicon', type: branding.favicon.fileType ?? 'image/png' }],
      shortcut: '/brand/favicon',
      apple: [{ url: '/brand/apple-touch-icon', type: branding.apple_touch_icon.fileType ?? 'image/png' }],
    },
    openGraph: { type: 'website', siteName: 'Tradagora', title: 'Tradagora | Datos para traders', description, locale: 'es_CO', images: [branding.og_image.url] },
    twitter: { card: 'summary_large_image', title: 'Tradagora | Datos para traders', description, images: [branding.og_image.url] },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
