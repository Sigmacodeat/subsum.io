import { notify } from '@affine/component';
import { AffineOtherPageLayout } from '@affine/component/affine-other-page-layout';
import { SignInPageContainer } from '@affine/component/auth-components';
import type { AuthIntent, SignInStep } from '@affine/core/components/sign-in';
import { SignInPanel } from '@affine/core/components/sign-in';
import { SignInBackgroundArts } from '@affine/core/components/sign-in/background-arts';
import type { AuthSessionStatus } from '@affine/core/modules/cloud/entities/session';
import { useI18n } from '@affine/i18n';
import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  RouteLogic,
  useNavigateHelper,
} from '../../../components/hooks/use-navigate-helper';

export const SignIn = ({
  redirectUrl: redirectUrlFromProps,
}: {
  redirectUrl?: string;
}) => {
  const t = useI18n();
  const navigate = useNavigate();
  const { jumpToIndex } = useNavigateHelper();
  const [searchParams] = useSearchParams();
  const redirectUrl = redirectUrlFromProps ?? searchParams.get('redirect_uri');

  const server = searchParams.get('server') ?? undefined;
  const error = searchParams.get('error');
  const intent = (searchParams.get('intent')?.toLowerCase() ?? 'signin') as
    | AuthIntent
    | string;

  useEffect(() => {
    if (error) {
      notify.error({
        title: t['com.affine.auth.toast.title.failed'](),
        message: error,
      });
    }
  }, [error, t]);

  const handleClose = useCallback(() => {
    jumpToIndex(RouteLogic.REPLACE, {
      search: searchParams.toString(),
    });
  }, [jumpToIndex, searchParams]);

  const handleAuthenticated = useCallback(
    (status: AuthSessionStatus) => {
      if (status === 'authenticated') {
        if (redirectUrl) {
          if (redirectUrl.toUpperCase() === 'CLOSE_POPUP') {
            window.close();
          }
          navigate(redirectUrl, {
            replace: true,
          });
        } else {
          handleClose();
        }
      }
    },
    [handleClose, navigate, redirectUrl]
  );

  const authIntent: AuthIntent = intent === 'signup' ? 'signup' : 'signin';
  const initStep: SignInStep = server ? 'addSelfhosted' : 'signIn';

  return (
    <SignInPageContainer>
      <div
        style={{
          maxWidth: '420px',
          width: '100%',
          zIndex: 1,
          padding: '28px 24px',
          borderRadius: 20,
          border:
            '1px solid color-mix(in srgb, var(--affine-primary-color) 16%, var(--affine-border-color))',
          background:
            'color-mix(in srgb, var(--affine-background-overlay-panel-color) 86%, transparent)',
          boxShadow:
            '0 24px 60px color-mix(in srgb, var(--affine-primary-color) 18%, transparent)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <SignInPanel
          onSkip={handleClose}
          onAuthenticated={handleAuthenticated}
          initStep={initStep}
          server={server}
          redirectUrl={redirectUrl ?? undefined}
          intent={authIntent}
        />
      </div>
    </SignInPageContainer>
  );
};

export const Component = () => {
  return (
    <AffineOtherPageLayout>
      <SignInBackgroundArts />
      <SignIn />
    </AffineOtherPageLayout>
  );
};
