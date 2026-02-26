import { clsx } from 'clsx';

export default function BrandMark({
  className,
  letterClassName,
}: {
  className?: string;
  letterClassName?: string;
}) {
  return (
    <div
      className={clsx(
        'relative w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary-600/20',
        className
      )}
    >
      <svg
        viewBox="0 0 64 64"
        aria-hidden="true"
        className={clsx('w-6 h-6 text-white relative z-10', letterClassName)}
      >
        <path
          fill="currentColor"
          d="M22 14c0-1.1.9-2 2-2h7c9.1 0 15 5.5 15 14.3 0 8.8-5.9 14.3-15 14.3h-5.2v8.4c0 1.1-.9 2-2 2h-1.8c-1.1 0-2-.9-2-2V14zm9 20.9c6 0 9.6-3.2 9.6-8.6 0-5.4-3.6-8.6-9.6-8.6h-3.2v17.2H31z"
        />
        <path
          fill="currentColor"
          opacity="0.85"
          d="M41 41.4c0-1.1.9-2 2-2h1.7c1.1 0 2 .9 2 2v7.7c0 1.1-.9 2-2 2H43c-1.1 0-2-.9-2-2v-7.7z"
        />
      </svg>
      <div className="absolute inset-0 rounded-xl gradient-primary opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-500" />
    </div>
  );
}
