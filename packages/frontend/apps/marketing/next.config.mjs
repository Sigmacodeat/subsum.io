import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import createMdx from '@next/mdx';
import createNextIntlPlugin from 'next-intl/plugin';
import remarkGfm from 'remark-gfm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(__dirname, '../../../..');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const withMdx = createMdx({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
  outputFileTracingRoot: monorepoRoot,
  serverExternalPackages: [
    '@opentelemetry/api',
    '@opentelemetry/core',
    '@opentelemetry/sdk-node',
    '@opentelemetry/sdk-trace-node',
    '@opentelemetry/exporter-prometheus',
    '@opentelemetry/exporter-zipkin',
    '@opentelemetry/resources',
    '@opentelemetry/sdk-metrics',
    '@opentelemetry/semantic-conventions',
    '@prisma/client',
    'prisma',
  ],
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: '/download',
        destination: '/systems',
        permanent: true,
      },
      {
        source: '/:locale/download',
        destination: '/:locale/systems',
        permanent: true,
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default withNextIntl(withMdx(nextConfig));
