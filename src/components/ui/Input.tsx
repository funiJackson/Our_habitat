import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  errorText?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, errorText, className = '', id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <label htmlFor={inputId} className="flex flex-col gap-2">
      {label && <span className="text-sm font-medium text-ink-700">{label}</span>}
      <input
        ref={ref}
        id={inputId}
        {...rest}
        className={[
          'h-12 rounded-2xl border bg-paper px-4 text-base text-ink-900 placeholder:text-ink-400',
          errorText ? 'border-blush-500' : 'border-ink-200 focus:border-blush-400',
          'focus:outline-none focus:ring-4 focus:ring-blush-100',
          'transition-colors',
          className,
        ].join(' ')}
      />
      {errorText
        ? <span className="text-xs text-blush-600">{errorText}</span>
        : hint
          ? <span className="text-xs text-ink-400">{hint}</span>
          : null}
    </label>
  );
});
