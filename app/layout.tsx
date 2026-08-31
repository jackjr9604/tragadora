import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { resolvePublicLanguage } from '@/lib/language'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: 'Tradagora | Datos para traders',
    template: '%s | Tradagora',
  },
  description:
    'Compara Prop Firms, ofertas y payouts verificados con datos para traders de Latinoamérica.',
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const language = await resolvePublicLanguage()

  return (
    <html
      lang={language}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
