'use client';

import {
  ArrowRight,
  CheckCircle,
  Crown,
  Shield,
  Users,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

import { type ChatbotLang, getChatbotStrings } from '@/components/chatbot-i18n';

interface SubscriptionFlowProps {
  lang?: ChatbotLang;
  onComplete?: () => void;
  onSkip?: () => void;
}

type PlanKey = 'starter' | 'professional' | 'enterprise';

export default function SubscriptionFlow({
  lang = 'de',
  onComplete,
  onSkip,
}: SubscriptionFlowProps) {
  const t = getChatbotStrings(lang);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('professional');
  const [isAnnual, setIsAnnual] = useState(true);

  const plans: Record<
    PlanKey,
    {
      name: string;
      price: number | null;
      features: string[];
      cta: string;
      popular: boolean;
    }
  > = {
    starter: {
      name: t.subStarterName,
      price: isAnnual ? 119 : 149,
      features: t.subStarterFeatures,
      cta: t.subStarterCta,
      popular: false,
    },
    professional: {
      name: t.subProName,
      price: isAnnual ? 319 : 399,
      features: t.subProFeatures,
      cta: t.subProCta,
      popular: true,
    },
    enterprise: {
      name: t.subEnterpriseName,
      price: null,
      features: t.subEnterpriseFeatures,
      cta: t.subEnterpriseCta,
      popular: false,
    },
  };

  const handleSubscribe = () => {
    setTimeout(() => onComplete?.(), 800);
  };

  return (
    <div
      className="w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6"
      style={{ maxHeight: '85vh' }}
    >
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600">
          <Crown className="h-7 w-7 text-white" />
        </div>
        <h2 className="mb-1 text-xl font-bold text-slate-900 sm:text-2xl">
          {t.subTitle}
        </h2>
        <p className="text-sm text-slate-500">{t.subSubtitle}</p>
      </div>

      <div className="mb-6 flex items-center justify-center">
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setIsAnnual(false)}
            className={`rounded-lg px-3.5 py-1.5 text-sm transition-all ${
              !isAnnual ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            {t.subMonthly}
          </button>
          <button
            onClick={() => setIsAnnual(true)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm transition-all ${
              isAnnual ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            {t.subAnnual}
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {t.subSave}
            </span>
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {(Object.entries(plans) as [PlanKey, (typeof plans)[PlanKey]][]).map(
          ([key, plan]) => (
            <div
              key={key}
              className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all ${
                selectedPlan === key
                  ? 'border-primary-500 bg-primary-50 shadow-lg'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => setSelectedPlan(key)}
            >
              {plan.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="whitespace-nowrap rounded-full bg-gradient-to-r from-primary-600 to-cyan-600 px-2.5 py-0.5 text-xs font-medium text-white">
                    {t.subPopular}
                  </span>
                </div>
              )}

              <div className="mb-4 text-center">
                <h3 className="mb-1 text-sm font-semibold text-slate-900">
                  {plan.name}
                </h3>
                {plan.price != null ? (
                  <div className="flex items-baseline justify-center gap-0.5">
                    <span className="text-2xl font-bold text-slate-900">
                      €{plan.price}
                    </span>
                    <span className="text-xs text-slate-500">
                      {t.subPerMonth}
                    </span>
                  </div>
                ) : (
                  <div className="text-base font-semibold text-slate-900">
                    {t.subCustom}
                  </div>
                )}
              </div>

              <ul className="mb-4 space-y-2">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                    <span className="text-xs text-slate-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={e => {
                  e.stopPropagation();
                  if (key === 'enterprise') {
                    window.open('/contact', '_blank');
                  } else {
                    handleSubscribe();
                  }
                }}
                className={`w-full rounded-lg py-2 text-sm font-medium transition-all ${
                  selectedPlan === key
                    ? 'bg-gradient-to-r from-primary-600 to-cyan-600 text-white shadow hover:shadow-lg'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          )
        )}
      </div>

      <div className="mb-5 rounded-xl bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            {t.subTrustRefund}
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            {t.subTrustInstant}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {t.subTrustFirms}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onSkip}
          className="px-3 py-2 text-sm text-slate-500 transition-colors hover:text-slate-800"
        >
          {t.subDecideLater}
        </button>
        <button
          onClick={handleSubscribe}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:shadow-lg"
        >
          {selectedPlan === 'enterprise' ? t.subContactUs : t.subStartNow}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
