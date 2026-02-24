import { clsx } from 'clsx';

type BrandWordmarkProps = {
  className?: string;
  dotClassName?: string;
  ariaLabel?: string;
  theme?: 'light' | 'dark';
};

export default function BrandWordmark({
  className,
  dotClassName,
  ariaLabel = 'Subsum.io',
  theme = 'light',
}: BrandWordmarkProps) {
  const isDark = theme === 'dark';

  return (
    <span
      className={clsx('whitespace-nowrap inline-flex items-center', className)}
      aria-label={ariaLabel}
    >
      <span aria-hidden="true">Subsum</span>
      <span
        aria-hidden="true"
        className={clsx(
          'mx-1 inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-br from-[#1459C2] to-[#0EA5A4]',
          isDark
            ? 'shadow-[0_0_0_1px_rgba(14,165,164,0.25),0_1px_5px_rgba(14,165,164,0.42)]'
            : 'shadow-[0_0_0_1px_rgba(14,165,164,0.15),0_1px_4px_rgba(20,89,194,0.35)]',
          dotClassName
        )}
      />
      <span aria-hidden="true">io</span>
    </span>
  );
}
