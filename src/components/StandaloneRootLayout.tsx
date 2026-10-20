import type { ReactNode } from "react";
import "@/app/globals.css";

/** Root shell for routes outside the locale layout. */
export default function StandaloneRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
