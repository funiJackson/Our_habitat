import { motion } from 'motion/react';

interface BrushDotProps {
  done?: boolean;
  size?: number;
  className?: string;
}

/**
 * Wishlist bullet: a brushy circle that turns into a vermillion ink-check
 * when toggled. The check stroke draws on (pathLength 0 → 1) to feel like
 * the brush touching paper.
 */
export function BrushDot({ done = false, size = 22, className = '' }: BrushDotProps) {
  const r = size / 2 - 2;
  const c = size / 2;
  const u = size / 22;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={c}
          cy={c}
          r={r}
          fill={done ? 'var(--color-vermillion-500)' : 'transparent'}
          stroke={done ? 'var(--color-vermillion-700)' : 'var(--color-ink-wash-4)'}
          strokeWidth={done ? 1 : 1.4}
          filter="url(#ink-edge)"
        />
        {done && (
          <motion.path
            initial={{ pathLength: 0, opacity: 0.4 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            d={`M ${5.5 * u} ${11 * u} L ${9.5 * u} ${15 * u} L ${16 * u} ${7.5 * u}`}
            stroke="var(--color-paper-rice)"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
      </svg>
    </span>
  );
}
