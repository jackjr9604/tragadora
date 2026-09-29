import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: 'Tradagora',
  title: {
    default: 'Tradagora | Datos para traders',
    template: '%s | Tradagora',
  },
  description:
    'Compara Prop Firms, ofertas y payouts verificados con datos para traders de Latinoamérica.',
  icons: {
    icon: [{ url: '/brand/tradagora-app-icon.png', type: 'image/png', sizes: '1536x1536' }],
    shortcut: '/brand/tradagora-app-icon.png',
    apple: [{ url: '/brand/tradagora-app-icon.png', type: 'image/png', sizes: '1536x1536' }],
  },
  openGraph: {
    type: 'website',
    siteName: 'Tradagora',
    title: 'Tradagora | Datos para traders',
    description: 'Compara Prop Firms, ofertas y payouts verificados con datos para traders de Latinoamérica.',
    locale: 'es_CO',
  },
  twitter: {
    card: 'summary',
    title: 'Tradagora | Datos para traders',
    description: 'Compara Prop Firms, ofertas y payouts verificados con datos para traders de Latinoamérica.',
  },
};

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
