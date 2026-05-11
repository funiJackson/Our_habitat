import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'soft' | 'ghost';
type Size = 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  leftIcon?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-blush-500 text-paper hover:bg-blush-600 active:bg-blush-700 disabled:bg-ink-200',
  soft:
    'bg-blush-100 text-blush-700 hover:bg-blush-200 active:bg-blush-300 disabled:bg-ink-100 disabled:text-ink-400',
  ghost:
    'bg-transparent text-ink-700 hover:bg-ink-100 active:bg-ink-200 disabled:text-ink-300',
};

const sizeClasses: Record<Size, string> = {
  md: 'h-11 px-5 text-base',
  lg: 'h-14 px-6 text-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  className = '',
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || isLoading}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-full font-medium',
        'transition-colors active:scale-[0.98] transition-transform',
        'disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {isLoading ? <span className="animate-pulse">…</span> : leftIcon}
      <span>{children}</span>
    </button>
  );
}
