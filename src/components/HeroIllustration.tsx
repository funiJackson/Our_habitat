/**
 * Hero cover illustration slot. When `src` is provided, fills with the user's
 * uploaded photo. Otherwise renders a brushy 烟火 placeholder so the layout
 * doesn't collapse before a cover is set.
 */
export function HeroIllustration({ src }: { src?: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover"
        decoding="async"
      />
    );
  }
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-[#1F2A44] via-[#2B3556] to-[#1A1F35]">
      <div className="absolute right-7 top-6 h-12 w-12 rounded-full bg-cream-50/85 blur-[0.5px]" />
      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <g stroke="#C73E2E" strokeWidth="1.7" strokeLinecap="round" filter="url(#ink-edge)">
          <line x1="120" y1="130" x2="80" y2="90" />
          <line x1="120" y1="130" x2="160" y2="90" />
          <line x1="120" y1="130" x2="120" y2="70" />
          <line x1="120" y1="130" x2="100" y2="170" />
          <line x1="120" y1="130" x2="140" y2="170" />
        </g>
        <g stroke="#E8DEC4" strokeWidth="1.5" strokeLinecap="round" filter="url(#ink-edge)" opacity="0.85">
          <line x1="285" y1="115" x2="245" y2="75" />
          <line x1="285" y1="115" x2="325" y2="75" />
          <line x1="285" y1="115" x2="285" y2="55" />
          <line x1="285" y1="115" x2="265" y2="155" />
        </g>
        <g fill="#0A0F1A">
          <path d="M 145 300 L 145 240 Q 160 200 180 200 Q 200 200 215 240 L 215 300 Z" />
          <path d="M 195 300 L 195 235 Q 210 195 230 195 Q 250 195 265 235 L 265 300 Z" />
        </g>
      </svg>
    </div>
  );
}
