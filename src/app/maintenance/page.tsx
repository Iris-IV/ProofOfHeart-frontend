import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maintenance | ProofOfHeart",
  robots: "noindex",
};

export default function MaintenancePage() {
  const eta = process.env.NEXT_PUBLIC_MAINTENANCE_ETA ?? "";

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#0f0f10",
          color: "#f4f4f5",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <main>
          <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🔧</div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Down for maintenance
          </h1>
          <p style={{ color: "#a1a1aa", maxWidth: "32rem", margin: "0 auto 1.5rem" }}>
            ProofOfHeart is temporarily offline while we perform an upgrade. All on-chain funds are
            safe. We&apos;ll be back shortly.
          </p>
          {eta && (
            <p
              style={{
                display: "inline-block",
                backgroundColor: "#27272a",
                borderRadius: "0.5rem",
                padding: "0.4rem 1rem",
                fontSize: "0.875rem",
                color: "#d4d4d8",
              }}
            >
              Estimated return: <strong>{eta}</strong>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
