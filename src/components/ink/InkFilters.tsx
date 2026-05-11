/**
 * Hidden SVG sprite mounting shared filter <defs> referenced by ink primitives.
 * Mount once in <AppShell>; child components reference filters by URL fragment.
 *
 * Filters cost more if redeclared per-element. Sharing one filter graph across
 * many BleedFrame / BrushDot instances keeps repaint cheap.
 */
export function InkFilters() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden
      focusable="false"
      style={{ position: 'absolute', overflow: 'hidden' }}
    >
      <defs>
        {/* Soft brush bleed — gentle wobble for card borders, list separators. */}
        <filter id="ink-bleed-soft" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.025"
            numOctaves="2"
            seed="2"
            result="noise"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" />
        </filter>

        {/* Strong bleed — hero card frame, statement borders. */}
        <filter id="ink-bleed-strong" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04"
            numOctaves="2"
            seed="5"
            result="noise"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" />
        </filter>

        {/* Tight high-frequency edge — brush dots, fine lines, calligraphic glyphs. */}
        <filter id="ink-edge" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.6"
            numOctaves="2"
            seed="3"
            result="noise"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" />
        </filter>

        {/* Washi/rice-paper tint for letter envelope interior. */}
        <filter id="ink-washi" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" />
          <feColorMatrix values="0 0 0 0 0.55  0 0 0 0 0.50  0 0 0 0 0.42  0 0 0 0.18 0" />
          <feComposite in="SourceGraphic" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
}
