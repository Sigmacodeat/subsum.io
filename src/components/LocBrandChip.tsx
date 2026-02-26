import { clsx } from 'clsx';

type LocBrandChipProps = {
  label: string;
  title?: string;
  ariaLabel?: string;
  className?: string;
  theme?: 'light' | 'dark';
  focusable?: boolean;
};

export default function LocBrandChip({
  label,
  title,
  ariaLabel,
  className,
  theme = 'light',
  focusable = false,
}: LocBrandChipProps) {
  const isDark = theme === 'dark';
  const normalizedLabel = label.trim().toUpperCase();
  const showTextLabel = normalizedLabel !== 'SUB';

  return (
    <span
      title={title}
      aria-label={ariaLabel}
      tabIndex={focusable ? 0 : undefined}
      className={clsx(
        'relative isolate inline-flex items-center justify-center overflow-hidden whitespace-nowrap transition-all duration-300',
        showTextLabel ? 'rounded-2xl px-2.5 py-1.5' : 'rounded-[18px] p-1',
        isDark
          ? 'border border-cyan-300/30 bg-slate-900/72 text-slate-100 shadow-[0_8px_20px_rgba(7,20,38,0.34)]'
          : 'border border-sky-200/70 bg-white/92 text-slate-700 backdrop-blur-sm shadow-[0_6px_18px_rgba(7,20,38,0.08)]',
        'group-hover:-translate-y-px group-hover:border-cyan-300/70 group-hover:shadow-[0_12px_30px_rgba(14,165,164,0.24)]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/45 focus-visible:ring-offset-2',
        isDark
          ? 'focus-visible:ring-offset-slate-950'
          : 'focus-visible:ring-offset-white',
        className
      )}
    >
      <span
        className={clsx(
          'absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100',
          isDark
            ? 'bg-gradient-to-r from-cyan-300/0 via-cyan-300/20 to-cyan-300/0'
            : 'bg-gradient-to-r from-sky-400/0 via-cyan-400/18 to-sky-400/0'
        )}
      />
      <span
        aria-hidden="true"
        className={clsx(
          'relative inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[#0B3A88] via-[#1459C2] to-[#0EA5A4] shadow-[0_10px_20px_rgba(8,57,136,0.34)]',
          showTextLabel ? 'h-8 w-8' : 'h-9 w-9',
          showTextLabel && 'mr-1.5',
          isDark && 'shadow-[0_10px_22px_rgba(14,165,164,0.38)]'
        )}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-[20px] w-[20px] text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3v18" />
          <path d="m19 8 3 8a5 5 0 0 1-6 0zV7" />
          <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" />
          <path d="m5 8 3 8a5 5 0 0 1-6 0zV7" />
          <path d="M7 21h10" />
        </svg>
      </span>
      {showTextLabel ? (
        <span
          className={clsx(
            'relative text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors duration-300',
            isDark
              ? 'text-slate-100 group-hover:text-cyan-200'
              : 'text-slate-700 group-hover:text-cyan-700'
          )}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
