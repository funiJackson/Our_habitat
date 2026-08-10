import { NOTE_EMOJI } from '@/lib/moods';
import blessed from '@/assets/mood/blessed.svg';
import blush from '@/assets/mood/blush.svg';
import cheeky from '@/assets/mood/cheeky.svg';
import crazy from '@/assets/mood/crazy.svg';
import crying from '@/assets/mood/crying.svg';
import eyesOnly from '@/assets/mood/eyes-only.svg';
import grumpy from '@/assets/mood/grumpy.svg';
import kissHeart from '@/assets/mood/kiss-heart.svg';
import lol from '@/assets/mood/lol.svg';
import petrified from '@/assets/mood/petrified.svg';
import smile from '@/assets/mood/smile.svg';
import wink from '@/assets/mood/wink.svg';

/**
 * Map a stored mood key → SVG asset URL.
 *
 * - New writes use the kebab-case Figma names (lol, kiss-heart, …).
 * - The six emoji-char keys are kept so historical rows (from M2's first
 *   iteration) still render correctly without a backfill.
 */
const iconByKey: Record<string, string> = {
  blessed,
  blush,
  cheeky,
  crazy,
  crying,
  'eyes-only': eyesOnly,
  grumpy,
  'kiss-heart': kissHeart,
  lol,
  petrified,
  smile,
  wink,
  // legacy emoji-char keys
  '😊': lol,
  '🥰': kissHeart,
  '😴': wink,
  '😢': crying,
  '😤': grumpy,
  '🤗': smile,
};

export function MoodIcon({ emoji, className = '' }: { emoji: string; className?: string }) {
  if (emoji === NOTE_EMOJI) return <NoteGlyph className={className} />;
  const src = iconByKey[emoji];
  if (src) {
    return <img src={src} alt="" className={className} aria-hidden />;
  }
  return <span className={className}>{emoji}</span>;
}

/**
 * Text-only day: three uneven brush strokes standing in for handwriting. Reads
 * as "wrote something" at 24px in the week strip, where a face used to be.
 */
function NoteGlyph({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`text-ink-600 ${className}`}
      fill="none"
      aria-hidden
      focusable="false"
    >
      <path
        d="M 5 8.6 C 9 8, 15 8.6, 19 8.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        filter="url(#ink-edge)"
      />
      <path
        d="M 5 12.4 C 10 11.8, 15 12.4, 19 11.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        filter="url(#ink-edge)"
      />
      <path
        d="M 5 16.2 C 8 15.7, 11.5 16.2, 13.5 15.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        filter="url(#ink-edge)"
      />
    </svg>
  );
}
