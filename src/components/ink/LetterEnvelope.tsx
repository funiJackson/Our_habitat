import type { ReactNode } from 'react';
import { motion } from 'motion/react';

interface LetterEnvelopeProps {
  state?: 'sealed' | 'open';
  /** Width controls overall scale; height is derived to keep aspect ratio. */
  width?: number;
  /** Body content (countdown when sealed, text/image when open). */
  children?: ReactNode;
  className?: string;
}

/**
 * A folded paper letter with a triangular flap. When `state` is 'sealed', the
 * flap covers the upper half (paired with `<RedString>` for the binding).
 * When 'open', the flap fades out so the body content reads through cleanly.
 */
export function LetterEnvelope({
  state = 'sealed',
  width = 280,
  children,
  className = '',
}: LetterEnvelopeProps) {
  const w = width;
  const h = Math.round(w * 0.72);
  const flapH = h * 0.55;

  return (
    <div
      className={`relative ${className}`}
      style={{ width: w, height: h }}
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="absolute inset-0"
        aria-hidden
      >
        <rect
          x="1"
          y="1"
          width={w - 2}
          height={h - 2}
          fill="var(--color-paper-mist)"
          stroke="var(--color-ink-wash-3)"
          strokeWidth="1.4"
          filter="url(#ink-bleed-soft)"
        />
        {/* horizontal seam where the front flap would meet the body */}
        <line
          x1={w * 0.08}
          y1={flapH}
          x2={w * 0.92}
          y2={flapH}
          stroke="var(--color-ink-wash-2)"
          strokeWidth="0.8"
          filter="url(#ink-edge)"
        />

        <motion.path
          d={`M 1 1 L ${w / 2} ${flapH} L ${w - 1} 1 Z`}
          fill="var(--color-paper-edge)"
          stroke="var(--color-ink-wash-3)"
          strokeWidth="1.2"
          filter="url(#ink-bleed-soft)"
          initial={false}
          animate={{
            opacity: state === 'sealed' ? 1 : 0,
            translateY: state === 'sealed' ? 0 : -flapH * 0.5,
          }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          style={{ transformOrigin: 'top center' }}
        />
      </svg>

      <div
        className="absolute inset-x-0 flex items-center justify-center px-5"
        style={{
          top: state === 'sealed' ? flapH : 0,
          bottom: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
