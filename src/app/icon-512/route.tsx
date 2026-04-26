import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          borderRadius: 112,
          background: 'linear-gradient(135deg, #ef4444 0%, #ec4899 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 320,
          fontWeight: 700,
        }}
      >
        ♥
      </div>
    ),
    { width: 512, height: 512 },
  );
}
