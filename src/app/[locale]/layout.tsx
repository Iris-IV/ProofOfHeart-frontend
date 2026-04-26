import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { WalletProvider } from "@/components/WalletContext";
import { ToastProvider } from "@/components/ToastProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import "../globals.css";

export const metadata: Metadata = {
  title: "ProofOfHeart",
  description:
    "A decentralized launchpad where the community validates causes and contributions are accounted for on-chain.",
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
