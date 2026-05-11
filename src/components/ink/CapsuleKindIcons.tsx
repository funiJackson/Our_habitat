/**
 * Brush-style icons for the two capsule kinds, matching the rest of the
 * ink-wash icon set in this folder. Both ride the shared `ink-edge` filter
 * for the hand-touched look.
 */

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

const baseProps = (size: number, className: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  className,
  'aria-hidden': true,
  focusable: false as const,
});

const stroke = (color: string) => ({
  stroke: color,
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  filter: 'url(#ink-edge)',
});

/** Folded letter — for `kind="text"` capsules. */
export function LetterCapsuleIcon({ size = 22, color = 'currentColor', className = '' }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <rect x="3" y="6.5" width="18" height="13" rx="1.5" {...stroke(color)} />
      <path d="M 3.5 7.5 L 12 14 L 20.5 7.5" {...stroke(color)} />
    </svg>
  );
}

/** Framed mountain scene — for `kind="image"` capsules. */
export function PictureCapsuleIcon({ size = 22, color = 'currentColor', className = '' }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <rect x="3" y="5" width="18" height="14" rx="1.5" {...stroke(color)} />
      <path d="M 5.5 17 L 10 11 L 13 14 L 17 9 L 18.5 17" {...stroke(color)} />
      <circle cx="16.5" cy="8.5" r="1.3" {...stroke(color)} />
    </svg>
  );
}
