import type { AbstractIntlMessages } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { defaultLocale, resolveBaseMessagesLocale } from './config';
import { routing } from './routing';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeMessages(
  base: AbstractIntlMessages,
  override: AbstractIntlMessages
): AbstractIntlMessages {
  const out: AbstractIntlMessages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      out[key] = mergeMessages(
        existing as AbstractIntlMessages,
        value as AbstractIntlMessages
      );
      continue;
    }
    out[key] = value as any;
  }
  return out;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  const baseLocale = resolveBaseMessagesLocale(locale);
  const defaultMessages = (await import(`../messages/${defaultLocale}.json`))
    .default as AbstractIntlMessages;
  const localeBaseMessages = (await import(`../messages/${baseLocale}.json`))
    .default as AbstractIntlMessages;

  const baseMessages =
    baseLocale === defaultLocale
      ? defaultMessages
      : mergeMessages(defaultMessages, localeBaseMessages);

  let overrideMessages: AbstractIntlMessages | null = null;
  try {
    overrideMessages = (await import(`../messages/${locale}.override.json`))
      .default as AbstractIntlMessages;
  } catch {
    overrideMessages = null;
  }

  return {
    locale,
    messages: overrideMessages
      ? mergeMessages(baseMessages, overrideMessages)
      : baseMessages,
  };
});
