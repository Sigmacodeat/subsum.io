'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { type FormEvent, useState } from 'react';

import { BRAND_COMPANY_NAME, BRAND_SUPPORT_EMAIL } from '@/brand';
import { Link } from '@/i18n/routing';

import { ScrollReveal } from './animations';
import BrandWordmark from './BrandWordmark';
import LocBrandChip from './LocBrandChip';

export default function Footer() {
  const t = useTranslations('footer');
  const tb = useTranslations('brand');
  const locale = useLocale();
  const year = new Date().getFullYear();
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);

  const semanticDbLabel = locale.toLowerCase().startsWith('de')
    ? 'KI Wissensbasis'
    : 'AI Knowledge Base';

  const onNewsletterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('newsletterEmail') ?? '').trim();
    if (!email) return;

    const subject = 'Newsletter subscription request';
    const body = `Please subscribe this email to product updates:\n\n${email}`;

    setNewsletterSubmitting(true);
    window.location.href = `mailto:${BRAND_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setTimeout(() => setNewsletterSubmitting(false), 500);
  };

  const productLinks = [
    { href: '/features', label: t('features') },
    { href: '/semantic-database', label: semanticDbLabel },
    { href: '/pricing', label: t('pricing') },
    { href: '/systems', label: t('download') },
    { href: '/security', label: t('security') },
  ];

  const companyLinks = [
    { href: '/about', label: t('about') },
    { href: '/contact', label: t('contact') },
  ];

  const developerLinks = [
    { href: '/developers/api', label: t('apiReference') },
    { href: '/docs', label: t('documentation') },
  ];

  const legalLinks = [
    { href: '/legal/privacy', label: t('privacy') },
    { href: '/legal/terms', label: t('terms') },
    { href: '/legal/imprint', label: t('imprint') },
  ];

  const supportLinks = [
    { href: '/contact', label: t('helpCenter') },
    { href: '/systems', label: t('status') },
  ];

  return (
    <footer className="bg-slate-950 text-slate-300 relative overflow-hidden">
      {/* Subtle top gradient line */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent" />

      <div className="container-wide section-padding !pb-8 relative">
        {/* Top grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-12 pb-12 border-b border-slate-800/60">
          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <ScrollReveal direction="up" distance={20}>
              <Link href="/" className="flex items-center gap-2.5 mb-4 group">
                <LocBrandChip
                  className="shrink-0"
                  label={tb('locBadge')}
                  title={tb('locTooltip')}
                  ariaLabel={tb('locAriaLabel')}
                  theme="dark"
                />
                <div className="flex flex-col">
                  <BrandWordmark
                    className="text-lg font-bold text-white leading-tight"
                    theme="dark"
                  />
                  <span className="text-[10px] font-medium text-primary-400 tracking-wider uppercase -mt-0.5">
                    by Sigmacode
                  </span>
                </div>
              </Link>
              <p className="text-sm text-slate-400 mb-6 max-w-xs leading-relaxed">
                {t('description')}
              </p>

              {/* Newsletter */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-2">
                  {t('newsletter')}
                </h4>
                <p className="text-xs text-slate-400 mb-3">
                  {t('newsletterDesc')}
                </p>
                <form className="flex gap-2" onSubmit={onNewsletterSubmit}>
                  <input
                    name="newsletterEmail"
                    type="email"
                    placeholder={t('emailPlaceholder')}
                    className="flex-1 px-3.5 py-2.5 text-sm bg-slate-900/80 border border-slate-700/60 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/30 transition-all duration-300"
                    required
                  />
                  <button
                    type="submit"
                    disabled={newsletterSubmitting}
                    className="px-4 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-500 rounded-xl transition-all duration-300 flex items-center gap-1 hover:shadow-lg hover:shadow-primary-600/20"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </ScrollReveal>
          </div>

          {/* Product */}
          <ScrollReveal delay={100} direction="up" distance={15}>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">
                {t('product')}
              </h4>
              <ul className="space-y-2.5">
                {productLinks.map(link => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-white hover:translate-x-0.5 inline-block transition-all duration-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* Company */}
          <ScrollReveal delay={150} direction="up" distance={15}>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">
                {t('company')}
              </h4>
              <ul className="space-y-2.5">
                {companyLinks.map(link => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-white hover:translate-x-0.5 inline-block transition-all duration-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* Developer */}
          <ScrollReveal delay={200} direction="up" distance={15}>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">
                {locale.toLowerCase().startsWith('de')
                  ? 'Entwickler'
                  : 'Developer'}
              </h4>
              <ul className="space-y-2.5">
                {developerLinks.map(link => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-white hover:translate-x-0.5 inline-block transition-all duration-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* Legal */}
          <ScrollReveal delay={250} direction="up" distance={15}>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">
                {t('legal')}
              </h4>
              <ul className="space-y-2.5">
                {legalLinks.map(link => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-white hover:translate-x-0.5 inline-block transition-all duration-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* Support */}
          <ScrollReveal delay={300} direction="up" distance={15}>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">
                {t('support')}
              </h4>
              <ul className="space-y-2.5">
                {supportLinks.map(link => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-white hover:translate-x-0.5 inline-block transition-all duration-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8">
          <p className="text-xs text-slate-500">
            © {year} {BRAND_COMPANY_NAME}. All rights reserved.
          </p>
          <p className="text-xs text-slate-500">{t('madeWith')}</p>
        </div>
      </div>
    </footer>
  );
}
