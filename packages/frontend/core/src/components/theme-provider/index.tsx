import { AppThemeService } from '@affine/core/modules/theme';
import { useService } from '@toeverything/infra';
import { ThemeProvider as NextThemeProvider, useTheme } from 'next-themes';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';

import { applyThemeVariantVariables } from './theme-variants';

const themes = ['dark', 'light'];

function ThemeObserver() {
  const { resolvedTheme } = useTheme();
  const service = useService(AppThemeService);
  const resolvedMode = resolvedTheme === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    service.appTheme.theme$.next(resolvedMode);
    document.documentElement.dataset.theme = resolvedMode;
    document.documentElement.style.colorScheme = resolvedMode;
  }, [resolvedMode, service.appTheme.theme$]);

  useEffect(() => {
    applyThemeVariantVariables('default', resolvedMode);
  }, [resolvedMode]);

  return null;
}

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  return (
    <NextThemeProvider
      themes={themes}
      enableSystem={true}
      defaultTheme="system"
    >
      {children}
      <ThemeObserver />
    </NextThemeProvider>
  );
};
