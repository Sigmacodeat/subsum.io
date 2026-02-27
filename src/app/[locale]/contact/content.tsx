'use client';

import { Sparkles } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';

import {
  FloatingParticles,
  GradientBlob,
  Parallax,
  ScrollLightSweep,
  ScrollProgressBar,
  ScrollReveal,
  TextRevealByWord,
} from '@/components/animations';
import { PrefooterCta } from '@/components/prefooter-cta';

export default function ContactContent() {
  const t = useTranslations('contact');
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subjects = [
    'subjectGeneral',
    'subjectDemo',
    'subjectSupport',
    'subjectEnterprise',
    'subjectPartnership',
  ];
  const preselectedSubject = String(searchParams.get('subject') ?? '').trim();
  const defaultSubject = subjects.includes(preselectedSubject)
    ? preselectedSubject
    : '';

  const inputClasses =
    'w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-300 transition-all duration-300 hover:border-slate-300';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const fullName = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const company = String(formData.get('company') ?? '').trim();
    const subjectKey = String(formData.get('subject') ?? '').trim();
    const message = String(formData.get('message') ?? '').trim();

    const subjectLabel = subjects.includes(subjectKey)
      ? t(subjectKey)
      : subjectKey;
    const mailSubject = `${t('subjectLabel')}: ${subjectLabel}`;
    const mailBody = [
      `${t('nameLabel')}: ${fullName}`,
      `${t('emailLabel')}: ${email}`,
      `${t('companyLabel')}: ${company || '-'}`,
      '',
      message,
    ].join('\n');

    setIsSubmitting(true);
    window.location.href = `mailto:${t('emailDirect')}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
    setTimeout(() => setIsSubmitting(false), 500);
  };

  return (
    <>
      <ScrollProgressBar />

      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-primary-50/30" />
        <Parallax speed={0.05} className="absolute inset-0">
          <div className="absolute inset-0 grid-pattern" />
        </Parallax>
        <ScrollLightSweep className="absolute inset-0" intensity={0.18} />
        <FloatingParticles
          count={3}
          colors={['bg-primary-400/8', 'bg-cyan-400/8', 'bg-sky-300/6']}
        />
        <Parallax speed={0.03} className="absolute inset-0">
          <GradientBlob
            className="-top-40 -right-40 animate-breathe"
            size={500}
            colors={['#1E40AF', '#0E7490', '#dbeafe']}
          />
        </Parallax>
        <Parallax speed={0.06} className="absolute inset-0">
          <GradientBlob
            className="-bottom-60 -left-40"
            size={380}
            colors={['#0E7490', '#1E40AF', '#ecfeff']}
          />
        </Parallax>
        <div className="container-wide text-center relative">
          <ScrollReveal delay={100} direction="up" distance={18}>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-sm border border-primary-100/80 text-primary-700 text-sm font-medium mb-8 shadow-sm">
              <Sparkles className="w-4 h-4 animate-pulse-slow" />
              {t('formTitle')}
            </div>
          </ScrollReveal>
          <ScrollReveal delay={200} direction="up" distance={26}>
            <TextRevealByWord
              text={t('pageTitle')}
              tag="h1"
              staggerMs={44}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 mb-6 text-balance"
            />
          </ScrollReveal>
          <ScrollReveal delay={320} direction="up" distance={16}>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              {t('pageSubtitle')}
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-white relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern" />
        <div className="container-wide relative">
          <div className="max-w-2xl mx-auto">
            <ScrollReveal direction="up" distance={30}>
              <h2 className="text-2xl font-bold text-slate-900 mb-8">
                {t('formTitle')}
              </h2>
              <form
                id="contact-form"
                className="space-y-6"
                onSubmit={handleSubmit}
              >
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      {t('nameLabel')}
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      placeholder={t('namePlaceholder')}
                      required
                      className={inputClasses}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      {t('emailLabel')}
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder={t('emailPlaceholder')}
                      required
                      className={inputClasses}
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="company"
                    className="block text-sm font-medium text-slate-700 mb-2"
                  >
                    {t('companyLabel')}
                  </label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    placeholder={t('companyPlaceholder')}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label
                    htmlFor="subject"
                    className="block text-sm font-medium text-slate-700 mb-2"
                  >
                    {t('subjectLabel')}
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    required
                    className={inputClasses}
                    defaultValue={defaultSubject}
                  >
                    <option value="">{t('subjectPlaceholder')}</option>
                    {subjects.map(s => (
                      <option key={s} value={s}>
                        {t(s)}
                      </option>
                    ))}{' '}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium text-slate-700 mb-2"
                  >
                    {t('messageLabel')}
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    placeholder={t('messagePlaceholder')}
                    required
                    className={`${inputClasses} resize-none`}
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                >
                  {t('submitButton')}
                </button>
              </form>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <PrefooterCta
        title={t('directTitle')}
        subtitle={t('chatSupportSubtitle')}
        primaryAction={{ href: '#chat-support', label: t('chatSupportButton') }}
      />
    </>
  );
}
