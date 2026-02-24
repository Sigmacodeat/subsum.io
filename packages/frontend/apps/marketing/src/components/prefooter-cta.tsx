'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import {
  FloatingParticles,
  GradientBlob,
  ScrollLightSweep,
  ScrollReveal,
} from '@/components/animations';
import { Link } from '@/i18n/routing';

type PrefooterAction = {
  href: string;
  label: string;
  ariaLabel?: string;
};

type PrefooterActionVariant = PrefooterAction & {
  variant: 'primary' | 'secondary';
};

type PrefooterCtaProps = {
  title: ReactNode;
  subtitle: ReactNode;
  icon?: ReactNode;
  primaryAction: PrefooterAction;
  secondaryAction?: PrefooterAction;
  meta?: ReactNode;
  children?: ReactNode;
  contentMaxWidthClassName?: string;
  titleClassName?: string;
};

function renderAction(action: PrefooterActionVariant) {
  const className =
    action.variant === 'primary'
      ? 'btn-primary inline-flex items-center gap-2 text-base sm:text-lg !px-8 sm:!px-10 !py-4 sm:!py-5 !min-w-[220px] justify-center'
      : 'inline-flex items-center justify-center gap-2 text-base sm:text-lg font-semibold !px-8 sm:!px-10 !py-4 sm:!py-5 !min-w-[220px] rounded-xl border-2 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/45 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/80 focus:ring-offset-2 focus:ring-offset-slate-900';

  const isInternal = action.href.startsWith('/');
  const content = (
    <>
      {action.label}
      {action.variant === 'primary' ? (
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      ) : null}
    </>
  );

  if (isInternal) {
    return (
      <Link
        href={action.href}
        className={className}
        aria-label={action.ariaLabel ?? action.label}
      >
        {content}
      </Link>
    );
  }

  return (
    <a
      href={action.href}
      className={className}
      aria-label={action.ariaLabel ?? action.label}
    >
      {content}
    </a>
  );
}

export function PrefooterCta({
  title,
  subtitle,
  icon,
  primaryAction,
  secondaryAction,
  meta,
  children,
  contentMaxWidthClassName = 'max-w-3xl',
  titleClassName = '',
}: PrefooterCtaProps) {
  const tFooter = useTranslations('footer');
  const resolvedSecondaryAction = secondaryAction ?? {
    href: '/contact',
    label: tFooter('contact'),
  };

  return (
    <section className="prefooter-cta">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_18%,rgba(56,189,248,0.16),transparent_32%),radial-gradient(circle_at_92%_12%,rgba(59,130,246,0.2),transparent_34%)]" />
      <ScrollLightSweep className="absolute inset-0" intensity={0.2} />
      <FloatingParticles
        count={4}
        colors={['bg-white/6', 'bg-primary-300/10', 'bg-cyan-300/10']}
      />
      <GradientBlob
        className="-top-40 -right-40 opacity-70"
        size={500}
        colors={['#0E7490', '#1E40AF', '#3b82f6']}
      />

      <div
        className={`container-wide text-center relative z-10 ${contentMaxWidthClassName}`}
      >
        <ScrollReveal direction="up" distance={20} duration={640}>
          {icon ? <div className="mb-4 flex justify-center">{icon}</div> : null}
          <h2 className={`prefooter-cta-title ${titleClassName}`.trim()}>
            {title}
          </h2>
          <p className="prefooter-cta-subtitle">{subtitle}</p>
        </ScrollReveal>

        <ScrollReveal delay={120} direction="up" distance={14} duration={560}>
          {children}
          <div className="prefooter-cta-actions">
            {renderAction({ ...primaryAction, variant: 'primary' })}
            {renderAction({ ...resolvedSecondaryAction, variant: 'secondary' })}
          </div>
          {meta ? <p className="prefooter-cta-meta">{meta}</p> : null}
        </ScrollReveal>
      </div>
    </section>
  );
}
