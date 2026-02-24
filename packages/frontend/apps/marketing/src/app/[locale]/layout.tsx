import '../globals.css';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';

import { BRAND_NAME, BRAND_SITE_URL } from '@/brand';
import Footer from '@/components/Footer';
import GlobalChatbotProvider from '@/components/global-chatbot-provider';
import Header from '@/components/Header';
import { isRtl, type Locale, resolveLocaleMarket } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import {
  buildLanguageAlternates,
  buildLocaleUrl,
  normalizeLocale,
} from '@/utils/seo';

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const normalizedLocale = normalizeLocale(locale);
  const market = resolveLocaleMarket(normalizedLocale);
  const canonical = buildLocaleUrl(normalizedLocale);
  const openGraphLocale = `${market.language}_${market.country}`;

  return {
    title: {
      default: t('title'),
      template: `%s | ${BRAND_NAME}`,
    },
    description: t('description'),
    keywords: t('keywords'),
    metadataBase: new URL(BRAND_SITE_URL),
    alternates: {
      canonical,
      languages: buildLanguageAlternates(),
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      siteName: BRAND_NAME,
      type: 'website',
      locale: openGraphLocale,
      url: canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} dir={isRtl(locale as Locale) ? 'rtl' : 'ltr'}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="https://app.subsum.io/favicon.ico" />
      </head>
      <body className="min-h-screen flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <Header />
          <main className="flex-1 pt-16 sm:pt-[4.5rem] lg:pt-[4.75rem] xl:pt-20">
            {children}
          </main>
          <Footer />
          <GlobalChatbotProvider />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
