import createMdx from '@next/mdx';
import createNextIntlPlugin from 'next-intl/plugin';
import remarkGfm from 'remark-gfm';

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
      {
        source: '/tax',
        destination: '/features',
        permanent: true,
      },
      {
        source: '/:locale/tax',
        destination: '/:locale/features',
        permanent: true,
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default withNextIntl(withMdx(nextConfig));
