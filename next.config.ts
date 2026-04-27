import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  outputFileTracingRoot: path.join(__dirname),
  async redirects() {
    return [
      {
        source: '/explore',
        destination: '/causes',
        permanent: true,
      },
      {
        source: '/:locale/explore',
        destination: '/:locale/causes',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
