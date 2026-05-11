/**
 * Single-stroke brushy icons for the home tile grid.
 * 24×24 viewBox, all share the ink-edge displacement filter for that
 * hand-touched feel. Pass `className` or `size` to override defaults.
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
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  filter: 'url(#ink-edge)',
});

/** A budding sprig — wishes / 想做的事. */
export function SprigIcon({ size = 22, color = 'currentColor', className = '' }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path {...stroke(color)} d="M 12 21 Q 12 14 12 6" />
      <path {...stroke(color)} d="M 12 13 Q 8 12 5.5 9" />
      <path {...stroke(color)} d="M 12 9.5 Q 16 8.5 18.5 5.5" />
    </svg>
  );
}

/** Ink droplet — moods / 心情. */
export function DropletIcon({ size = 22, color = 'currentColor', className = '' }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path
        {...stroke(color)}
        d="M 12 3 C 8 8 6 12 6 15 A 6 6 0 0 0 18 15 C 18 12 16 8 12 3 Z"
      />
    </svg>
  );
}

/** Two flowing ripples — memories / 共同回忆. */
export function RippleIcon({ size = 22, color = 'currentColor', className = '' }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path {...stroke(color)} d="M 3 10 Q 6 7 9 10 T 15 10 T 21 10" />
      <path {...stroke(color)} d="M 3 15 Q 6 12 9 15 T 15 15 T 21 15" />
    </svg>
  );
}

/** A simple knot — capsules / 时光胶囊（红线打结）. */
export function KnotIcon({ size = 22, color = 'currentColor', className = '' }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path
        {...stroke(color)}
        d="M 8 4 C 8 8 16 8 16 12 C 16 16 8 16 8 20"
      />
      <path
        {...stroke(color)}
        d="M 16 4 C 16 8 8 8 8 12 C 8 16 16 16 16 20"
      />
    </svg>
  );
}
