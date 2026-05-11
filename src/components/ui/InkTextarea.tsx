import { forwardRef, useState } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { BrushLine } from '@/components/ink/BrushLine';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  errorText?: string;
}

/**
 * Borderless textarea with a single calligraphic baseline. Replaces the
 * rectangular bordered input for diary-style typing — increased line-height
 * gives prose a poetry-page feel.
 *
 * Place inside an <InkFilters/>-mounted tree so the BrushLine filter resolves.
 */
export const InkTextarea = forwardRef<HTMLTextAreaElement, Props>(function InkTextarea(
  { label, hint, errorText, className = '', id, onFocus, onBlur, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  const [focused, setFocused] = useState(false);

  const lineColor = errorText
    ? 'var(--color-vermillion-500)'
    : focused
      ? 'var(--color-ink-wash-5)'
      : 'var(--color-ink-wash-3)';

  return (
    <label htmlFor={inputId} className="flex flex-col gap-2">
      {label && (
        <span className="text-xs uppercase tracking-widest text-ink-400">{label}</span>
      )}
      <div className="relative">
        <textarea
          ref={ref}
          id={inputId}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className={[
            'w-full bg-transparent font-serif text-base leading-loose text-ink-800',
            'placeholder:text-ink-400 placeholder:font-serif',
            'resize-none px-1 py-2 focus:outline-none',
            className,
          ].join(' ')}
        />
        <div
          className="pointer-events-none absolute inset-x-0 -bottom-1 transition-opacity duration-200"
          style={{ opacity: focused ? 1 : 0.75 }}
        >
          <BrushLine orientation="h" length="100%" color={lineColor} />
        </div>
      </div>
      {errorText ? (
        <span className="text-xs text-vermillion-500">{errorText}</span>
      ) : hint ? (
        <span className="text-xs text-ink-400">{hint}</span>
      ) : null}
    </label>
  );
});
