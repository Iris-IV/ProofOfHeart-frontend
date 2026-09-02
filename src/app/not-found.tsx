import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getTextDirection } from "@/lib/direction";
import ErrorBoundary from "@/components/ErrorBoundary";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { QueryProvider } from "@/components/QueryProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { WalletProvider } from "@/components/WalletContext";
import { DevMockPanel } from "@/components/DevMockPanel";
import OnboardingTour from "@/components/OnboardingTour";
import MaintenanceBypass from "@/components/MaintenanceBypass";
import { getThemeBlockingScript } from "@/lib/preferences";
import Link from "next/link";
import "./globals.css";

// This is the global not-found boundary
export default async function GlobalNotFound() {
  // Since locale isn't available in global not-found, we fall back to default
  const locale = routing.defaultLocale;
  const messages = await getMessages({ locale });

  return (
    <html lang={locale} dir={getTextDirection(locale)} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: getThemeBlockingScript(),
          }}
        />
      </head>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <QueryProvider>
            <ThemeProvider>
              <ErrorBoundary>
                <ToastProvider>
                  <WalletProvider>
                    <div className="flex min-h-screen flex-col">
                      <Navbar />
                      <main
                        id="main"
                        className="flex-1 flex items-center justify-center bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800"
                      >
                        <div className="container mx-auto px-4 py-24 text-center">
                          <div className="max-w-md mx-auto space-y-6">
                            <div className="text-6xl">🔍</div>
                            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                              Page not found
                            </h1>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                              This page does not exist or may have been removed.
                            </p>
                            <Link
                              href="/"
                              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors"
                            >
                              ← Back to Home
                            </Link>
                          </div>
                        </div>
                      </main>
                      <Footer />
                      <DevMockPanel />
                      <OnboardingTour />
                      <MaintenanceBypass />
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
