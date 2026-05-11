import type { ReactNode, CSSProperties } from 'react';

interface BleedFrameProps {
  children: ReactNode;
  /** Bleed strength — 'soft' for cards, 'strong' for hero frames. */
  intensity?: 'soft' | 'strong';
  /** Border color — defaults to ink-wash-3. */
  color?: string;
  /** Border thickness in px. */
  thickness?: number;
  /** Inherits the parent's border-radius by default; override with this. */
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Wraps children with a brush-bleed border overlay. The wrapper does not paint
 * a fill — set background on the children container directly. The border is
 * rendered via a sibling absolutely-positioned div with displacement filter
 * applied, so it bleeds without distorting children.
 *
 * Place inside a node that contains <InkFilters/> in the React tree.
 */
export function BleedFrame({
  children,
  intensity = 'soft',
  color = 'var(--color-ink-wash-3)',
  thickness = 1.5,
  radius,
  className = '',
  style,
}: BleedFrameProps) {
  const filterId = intensity === 'strong' ? 'url(#ink-bleed-strong)' : 'url(#ink-bleed-soft)';
  const borderRadius = radius !== undefined ? radius : 'inherit';

  return (
    <div className={`relative ${className}`} style={style}>
      {children}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          border: `${thickness}px solid ${color}`,
          borderRadius,
          filter: filterId,
        }}
      />
    </div>
  );
}
