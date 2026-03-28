import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { WalletProvider } from "@/components/WalletContext";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "ProofOfHeart",
  description:
    "A decentralized launchpad where the community validates causes and contributions are accounted for on-chain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ToastProvider>
          <WalletProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </WalletProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
