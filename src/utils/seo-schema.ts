import {
  BRAND_AGGREGATE_RATING,
  BRAND_COMPANY_NAME,
  BRAND_LOGO_URL,
  BRAND_NAME,
  BRAND_SITE_URL,
  BRAND_SOCIAL_LINKS,
  BRAND_SUPPORT_EMAIL,
  BRAND_SUPPORT_LANGUAGES,
} from '@/brand';
import { resolveLocaleMarket } from '@/i18n/config';
import { buildLocaleUrl } from '@/utils/seo';

export type HomepageSchemaInput = {
  locale: string;
  title: string;
  description: string;
};

export function buildHomepageJsonLd({
  locale,
  title,
  description,
}: HomepageSchemaInput) {
  const market = resolveLocaleMarket(locale);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: BRAND_NAME,
        legalName: BRAND_COMPANY_NAME,
        url: BRAND_SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: BRAND_LOGO_URL,
          width: 512,
          height: 512,
        },
        sameAs: BRAND_SOCIAL_LINKS,
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: BRAND_SUPPORT_EMAIL,
          availableLanguage: BRAND_SUPPORT_LANGUAGES,
        },
        areaServed: market.country,
      },
      {
        '@type': 'WebSite',
        name: BRAND_NAME,
        url: BRAND_SITE_URL,
        inLanguage: market.language,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${BRAND_SITE_URL}/{search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'SoftwareApplication',
        name: title,
        description,
        inLanguage: market.language,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, macOS, Windows, iOS, Android',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: market.currency,
          availability: 'https://schema.org/InStock',
          priceValidUntil: new Date(
            new Date().setFullYear(new Date().getFullYear() + 1)
          )
            .toISOString()
            .split('T')[0],
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ...BRAND_AGGREGATE_RATING,
        },
      },
    ],
  };
}

export function buildDownloadCenterPageJsonLd({
  locale,
  pageTitle,
  description,
  path,
  platforms,
}: DownloadCenterPageSchemaInput) {
  const market = resolveLocaleMarket(locale);
  const url = buildLocaleUrl(locale, path);
  const combinedOperatingSystems = Array.from(
    new Set(platforms.map(platform => platform.operatingSystem))
  ).join(', ');

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: pageTitle,
        description,
        url,
        inLanguage: market.language,
      },
      {
        '@type': 'SoftwareApplication',
        name: BRAND_NAME,
        description,
        applicationCategory: 'BusinessApplication',
        operatingSystem: combinedOperatingSystems,
        inLanguage: market.language,
        areaServed: market.country,
        url,
      },
      {
        '@type': 'ItemList',
        name: `${BRAND_NAME} download platforms`,
        itemListElement: platforms.map((platform, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'SoftwareApplication',
            name: platform.name,
            applicationCategory:
              platform.applicationCategory ?? 'BusinessApplication',
            operatingSystem: platform.operatingSystem,
            downloadUrl: platform.downloadUrl,
            offers: {
              '@type': 'Offer',
              availability: 'https://schema.org/InStock',
              price: '0',
              priceCurrency: market.currency,
              url: platform.downloadUrl,
            },
            potentialAction: {
              '@type': 'DownloadAction',
              target: platform.downloadUrl,
            },
          },
        })),
      },
    ],
  };
}

export type BreadcrumbItem = {
  name: string;
  url: string;
};

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export type FaqItem = {
  question: string;
  answer: string;
};

export function buildFaqPageJsonLd(faqs: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export type BlogPostingSchemaInput = {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  authorName: string;
  locale: string;
  imageUrl?: string;
};

export function buildBlogPostingJsonLd({
  title,
  description,
  url,
  datePublished,
  dateModified,
  authorName,
  locale,
  imageUrl,
}: BlogPostingSchemaInput) {
  const market = resolveLocaleMarket(locale);

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    url,
    datePublished,
    dateModified: dateModified ?? datePublished,
    inLanguage: market.language,
    author: {
      '@type': 'Person',
      name: authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: BRAND_NAME,
      legalName: BRAND_COMPANY_NAME,
      url: BRAND_SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: BRAND_LOGO_URL,
      },
    },
    ...(imageUrl
      ? {
          image: {
            '@type': 'ImageObject',
            url: imageUrl,
          },
        }
      : {}),
  };
}

export type PricingTier = {
  name: string;
  price: string;
  priceCurrency: string;
  billingPeriod: 'P1M' | 'P1Y' | 'P0Y';
  description?: string;
};

export type PricingPageSchemaInput = {
  locale: string;
  pageTitle: string;
  description: string;
  path: string;
  tiers: PricingTier[];
};

export function buildPricingPageJsonLd({
  locale,
  pageTitle,
  description,
  path,
  tiers,
}: PricingPageSchemaInput) {
  const market = resolveLocaleMarket(locale);
  const url = buildLocaleUrl(locale, path);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: pageTitle,
        description,
        url,
        inLanguage: market.language,
      },
      {
        '@type': 'SoftwareApplication',
        name: BRAND_NAME,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, macOS, Windows, iOS, Android',
        offers: tiers.map(tier => ({
          '@type': 'Offer',
          name: tier.name,
          price: tier.price,
          priceCurrency: tier.priceCurrency,
          availability: 'https://schema.org/InStock',
          description: tier.description,
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: tier.price,
            priceCurrency: tier.priceCurrency,
            billingDuration: tier.billingPeriod,
          },
        })),
      },
    ],
  };
}

export type ServicePageSchemaInput = {
  locale: string;
  name: string;
  description: string;
  path: string;
};

export type DownloadCenterPlatformSchemaInput = {
  name: string;
  operatingSystem: string;
  downloadUrl: string;
  applicationCategory?: string;
};

export type DownloadCenterPageSchemaInput = {
  locale: string;
  pageTitle: string;
  description: string;
  path: string;
  platforms: DownloadCenterPlatformSchemaInput[];
};

export function buildServicePageJsonLd({
  locale,
  name,
  description,
  path,
}: ServicePageSchemaInput) {
  const market = resolveLocaleMarket(locale);
  const url = buildLocaleUrl(locale, path);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name,
        description,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        inLanguage: market.language,
        areaServed: market.country,
        url,
      },
      {
        '@type': 'Service',
        serviceType: name,
        provider: {
          '@type': 'Organization',
          name: BRAND_NAME,
          url: BRAND_SITE_URL,
        },
        areaServed: market.country,
        availableLanguage: market.language,
      },
    ],
  };
}

export type ContactPageSchemaInput = {
  locale: string;
  pageTitle: string;
  description: string;
  email?: string;
  phone?: string;
};

export function buildContactPageJsonLd({
  locale,
  pageTitle,
  description,
  email,
  phone,
}: ContactPageSchemaInput) {
  const market = resolveLocaleMarket(locale);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ContactPage',
        name: pageTitle,
        description,
        inLanguage: market.language,
        url: buildLocaleUrl(locale, '/contact'),
      },
      {
        '@type': 'Organization',
        name: BRAND_NAME,
        legalName: BRAND_COMPANY_NAME,
        url: BRAND_SITE_URL,
        email,
        telephone: phone,
        areaServed: market.country,
      },
    ],
  };
}
