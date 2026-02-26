import type { MetadataRoute } from 'next';

import { BRAND_SITE_URL } from '@/brand';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: [`${BRAND_SITE_URL}/sitemap.xml`],
    host: BRAND_SITE_URL,
  };
}
