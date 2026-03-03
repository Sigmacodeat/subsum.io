import { useI18n } from '@affine/i18n';
import type { FC } from 'react';

import { Button } from '../../ui/button';
import { AuthPageContainer } from './auth-page-container';

export const SignInSuccessPage: FC<{
  onOpenDashboard?: () => void;
  onOpenAffine?: () => void;
}> = ({ onOpenDashboard, onOpenAffine }) => {
  const t = useI18n();
  const onOpen = onOpenAffine ?? onOpenDashboard;
  return (
    <AuthPageContainer
      title={t['com.affine.auth.signed.success.title']()}
      subtitle={t['com.affine.auth.signed.success.subtitle']()}
    >
      <Button variant="primary" size="large" onClick={onOpen}>
        {t['com.affine.auth.open.affine']()}
      </Button>
    </AuthPageContainer>
  );
};
