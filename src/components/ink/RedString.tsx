import { motion } from 'motion/react';

interface RedStringProps {
  width?: number;
  height?: number;
  /** When false, the strands fade and untie. When true, they're freshly drawn. */
  tied?: boolean;
  className?: string;
}

/**
 * Two crossed brushy strands meeting at a knot in the center — the 红线
 * binding a sealed letter. Animates an untie when `tied` flips to false.
 */
export function RedString({ width = 280, height = 200, tied = true, className = '' }: RedStringProps) {
  const w = width;
  const h = height;
  const cx = w * 0.5;
  const cy = h * 0.5;

  // Strand 1: enters top-left, crosses center, exits bottom-right
  const strand1 = `M -10 ${h * 0.18} Q ${w * 0.32} ${h * 0.55} ${cx} ${cy} T ${w + 10} ${h * 0.82}`;
  // Strand 2: enters top-right, crosses center, exits bottom-left
  const strand2 = `M ${w + 10} ${h * 0.18} Q ${w * 0.68} ${h * 0.55} ${cx} ${cy} T -10 ${h * 0.82}`;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      aria-hidden
      focusable="false"
    >
      <motion.path
        d={strand1}
        stroke="var(--color-vermillion-500)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        filter="url(#ink-edge)"
        initial={{ pathLength: 0, opacity: 0.3 }}
        animate={{
          pathLength: tied ? 1 : 0,
          opacity: tied ? 1 : 0,
        }}
        transition={{ duration: tied ? 0.9 : 0.7, ease: 'easeInOut' }}
      />
      <motion.path
        d={strand2}
        stroke="var(--color-vermillion-700)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        filter="url(#ink-edge)"
        initial={{ pathLength: 0, opacity: 0.3 }}
        animate={{
          pathLength: tied ? 1 : 0,
          opacity: tied ? 1 : 0,
        }}
        transition={{ duration: tied ? 0.9 : 0.7, ease: 'easeInOut', delay: 0.08 }}
      />
      {/* knot dot at center */}
      <motion.circle
        cx={cx}
        cy={cy}
        r={4}
        fill="var(--color-vermillion-500)"
        filter="url(#ink-edge)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: tied ? 1 : 0.4,
          opacity: tied ? 1 : 0,
        }}
        transition={{ duration: 0.4, delay: tied ? 0.6 : 0 }}
      />
    </svg>
  );
}
