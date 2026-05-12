import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(
    <div
      style={{
        width: 192,
        height: 192,
        borderRadius: 48,
        background: "linear-gradient(135deg, #ef4444 0%, #ec4899 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontSize: 120,
        fontWeight: 700,
      }}
    >
      ♥
    </div>,
    { width: 192, height: 192 },
  );
}
