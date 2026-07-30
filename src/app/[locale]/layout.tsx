import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Inter } from "next/font/google";
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
import ThirdPartyScripts from "@/components/ThirdPartyScripts";
import { routing } from "@/i18n/routing";
import { getTextDirection } from "@/lib/direction";
import { getThemeBlockingScript } from "@/lib/preferences";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// #138 — Pre-render locale shells at build time so /en and /es appear in the
// static-pages section of the build output instead of being dynamic routes.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export { siteMetadata as metadata } from "@/lib/siteMetadata";

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
  const t = await getTranslations("Common");

  return (
    <html
      lang={locale}
      dir={getTextDirection(locale)}
      className={inter.variable}
      suppressHydrationWarning
    >
      <head>
        {/*
          The only script that legitimately belongs in <head>. It is inline (no
          network round-trip) and must run before first paint to apply the stored
          theme without a flash of the wrong colours. Every third-party script is
          loaded from <ThirdPartyScripts /> at the end of <body> instead (#657).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: getThemeBlockingScript(),
          }}
        />
      </head>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[100] focus:bg-white focus:px-3 focus:py-1 focus:text-sm focus:shadow"
          >
            {t("skipToMainContent")}
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
                      <DevMockPanel />
                      <OnboardingTour />
                      <MaintenanceBypass />
                    </div>
                  </WalletProvider>
                </ToastProvider>
              </ErrorBoundary>
            </ThemeProvider>
          </QueryProvider>
          <ThirdPartyScripts />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
