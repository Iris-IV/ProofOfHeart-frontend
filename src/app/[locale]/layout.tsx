import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import ErrorBoundary from "@/components/ErrorBoundary";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { QueryProvider } from "@/components/QueryProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { WalletProvider } from "@/components/WalletContext";
import { routing } from '@/i18n/routing';
import type { Metadata } from "next";
import "../globals.css";

// #138 — Pre-render locale shells at build time so /en and /es appear in the
// static-pages section of the build output instead of being dynamic routes.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://proofofheart.xyz"),
  title: "ProofOfHeart",
  description:
    "A decentralized launchpad where the community validates causes and contributions are accounted for on-chain.",
  openGraph: {
    type: "website",
    siteName: "ProofOfHeart",
    title: "ProofOfHeart",
    description: "A decentralized launchpad where the community validates causes and contributions are accounted for on-chain.",
    images: ["/proof-of-heart-logo.svg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "ProofOfHeart",
    description: "A decentralized launchpad where the community validates causes and contributions are accounted for on-chain.",
    images: ["/proof-of-heart-logo.svg"],
  },
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();
  const t = await getTranslations('Common');

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('theme');
                  const isDark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {
                  console.warn('Failed to apply theme before hydration:', e);
                }
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <a 
            href="#main" 
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:px-3 focus:py-1 focus:text-sm focus:shadow"
          >
            {t('skipToMainContent')}
          </a>
          <QueryProvider>
            <ThemeProvider>
              <ErrorBoundary>
                <ToastProvider>
                  <WalletProvider>
                    <div className="flex min-h-screen flex-col">
                      <Navbar />
                      <main id="main" className="flex-1">
                        {children}
                      </main>
                      <Footer />
                    </div>
                  </WalletProvider>
                </ToastProvider>
              </ErrorBoundary>
            </ThemeProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
