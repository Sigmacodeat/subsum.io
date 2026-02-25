import { OverlayModal } from '@affine/component';
import { useI18n } from '@affine/i18n';

export const StarAFFiNEModal = ({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) => {
  const t = useI18n();

  return (
    <OverlayModal
      open={open}
      topImage={undefined}
      title={t['com.affine.star-affine.title']()}
      onOpenChange={setOpen}
      description={t['com.affine.star-affine.description']()}
      cancelText={t['com.affine.star-affine.cancel']()}
      to={BUILD_CONFIG.githubUrl}
      confirmButtonOptions={{
        variant: 'primary',
      }}
      confirmText={t['com.affine.star-affine.confirm']()}
      external
    />
  );
};
