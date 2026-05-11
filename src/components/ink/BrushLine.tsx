interface BrushLineProps {
  orientation?: 'h' | 'v';
  /** CSS length for the dimension along the line; the perpendicular dimension is fixed at 8px. */
  length?: number | string;
  /** Stroke color — accepts CSS color or theme var. Defaults to ink-wash-3. */
  color?: string;
  /** When true, applies a subtle 6s breathing animation (for timeline spines). */
  wobble?: boolean;
  className?: string;
}

/**
 * A single calligraphic stroke. Tapered ends via stroke-linecap=round and a
 * shared ink-edge displacement filter give it brushy character without a
 * hand-drawn asset. Use for input baselines (h) and timeline spines (v).
 */
export function BrushLine({
  orientation = 'h',
  length = '100%',
  color = 'rgba(42, 38, 34, 0.32)',
  wobble = false,
  className = '',
}: BrushLineProps) {
  const animClass = wobble ? 'ink-brush-wobble' : '';

  if (orientation === 'h') {
    return (
      <svg
        viewBox="0 0 200 8"
        preserveAspectRatio="none"
        width={length}
        height="8"
        className={`${className} ${animClass}`}
        aria-hidden
        focusable="false"
      >
        <path
          d="M 4 4 Q 50 3.5, 100 4 T 196 4"
          stroke={color}
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
          filter="url(#ink-edge)"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 8 200"
      preserveAspectRatio="none"
      width="8"
      height={length}
      className={`${className} ${animClass}`}
      aria-hidden
      focusable="false"
    >
      <path
        d="M 4 4 Q 3.5 50, 4 100 T 4 196"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        filter="url(#ink-edge)"
      />
    </svg>
  );
}
