'use client';

import { ArrowRight, Shield, Sparkles, Star, Users, Zap } from 'lucide-react';
import React, { useState } from 'react';

import { type ChatbotLang, getChatbotStrings } from '@/components/chatbot-i18n';

interface RegistrationFlowProps {
  lang?: ChatbotLang;
  onComplete?: () => void;
  onSkip?: () => void;
}

export default function RegistrationFlow({
  lang = 'de',
  onComplete,
  onSkip,
}: RegistrationFlowProps) {
  const t = getChatbotStrings(lang);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    company: '',
    useCase: '',
  });

  const steps = [
    {
      title: t.regWelcomeTitle,
      subtitle: t.regWelcomeSub,
      icon: Sparkles,
      content: 'email' as const,
    },
    {
      title: t.regPersonalTitle,
      subtitle: t.regPersonalSub,
      icon: Users,
      content: 'personal' as const,
    },
    {
      title: t.regCompanyTitle,
      subtitle: t.regCompanySub,
      icon: Shield,
      content: 'company' as const,
    },
    {
      title: t.regUseCaseTitle,
      subtitle: t.regUseCaseSub,
      icon: Zap,
      content: 'usecase' as const,
    },
  ];

  const featureIcons = [Star, Zap, Shield, Users];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setTimeout(() => onComplete?.(), 800);
    }
  };

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);

  const canContinue = (() => {
    if (currentStep === 0) return isEmailValid;
    if (currentStep === 1) return formData.firstName.trim().length > 0;
    return true;
  })();

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6">
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {t.regStep} {currentStep + 1} / {steps.length}
          </span>
          <span className="text-xs font-medium text-primary-600">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-100">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-primary-600 to-cyan-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-primary-600 to-cyan-600">
            {React.createElement(steps[currentStep].icon, {
              className: 'h-5 w-5 text-white',
            })}
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
              {steps[currentStep].title}
            </h3>
            <p className="text-xs text-slate-500 sm:text-sm">
              {steps[currentStep].subtitle}
            </p>
          </div>
        </div>

        {steps[currentStep].content === 'email' && (
          <div className="space-y-3">
            <input
              type="email"
              autoFocus
              placeholder={t.regEmail}
              value={formData.email}
              onChange={e =>
                setFormData({ ...formData, email: e.target.value })
              }
              onKeyDown={e => e.key === 'Enter' && canContinue && handleNext()}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
            <div className="rounded-xl bg-primary-50 p-3">
              <p className="text-xs font-medium text-primary-700 sm:text-sm">
                {t.regTrialBadge}
              </p>
            </div>
          </div>
        )}

        {steps[currentStep].content === 'personal' && (
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              autoFocus
              placeholder={t.regFirstName}
              value={formData.firstName}
              onChange={e =>
                setFormData({ ...formData, firstName: e.target.value })
              }
              onKeyDown={e => e.key === 'Enter' && canContinue && handleNext()}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
            <input
              type="text"
              placeholder={t.regLastName}
              value={formData.lastName}
              onChange={e =>
                setFormData({ ...formData, lastName: e.target.value })
              }
              onKeyDown={e => e.key === 'Enter' && canContinue && handleNext()}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
          </div>
        )}

        {steps[currentStep].content === 'company' && (
          <div className="space-y-3">
            <input
              type="text"
              autoFocus
              placeholder={t.regCompany}
              value={formData.company}
              onChange={e =>
                setFormData({ ...formData, company: e.target.value })
              }
              onKeyDown={e => e.key === 'Enter' && handleNext()}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
            <div className="grid grid-cols-2 gap-2">
              {t.regFeatures.map((feat, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5"
                >
                  {React.createElement(featureIcons[i] ?? Star, {
                    className: 'h-3.5 w-3.5 text-primary-600 flex-shrink-0',
                  })}
                  <span className="text-xs text-slate-600">{feat}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {steps[currentStep].content === 'usecase' && (
          <div className="space-y-2">
            {t.regUseCases.map(uc => (
              <button
                key={uc}
                onClick={() => setFormData({ ...formData, useCase: uc })}
                className={`w-full rounded-xl border p-3 text-left text-sm transition-all ${
                  formData.useCase === uc
                    ? 'border-primary-500 bg-primary-50 font-medium text-primary-700'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {uc}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onSkip}
          className="px-3 py-2 text-sm text-slate-500 transition-colors hover:text-slate-800"
        >
          {t.regSkip}
        </button>
        <button
          onClick={handleNext}
          disabled={!canContinue}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {currentStep === steps.length - 1 ? t.regStart : t.regNext}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
