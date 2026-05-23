import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { LetterEnvelope } from '@/components/ink/LetterEnvelope';
import type { TimeCapsule } from '@/lib/time-capsules';

interface Props {
  capsules: TimeCapsule[];
  onOpen: (capsule: TimeCapsule) => void;
}

const ENVELOPE_W = 108;
const PILE_LAYERS = 5; // how many envelopes to actually draw in the heap

/**
 * Sealed time capsules shown as a heap of letters rather than a tidy grid.
 *
 *   collapsed → envelopes piled on top of each other, gently askew
 *   tap       → they scatter apart, each one individually openable
 *   tap blank → the pile gathers back up
 *
 * Offsets/rotations are derived deterministically from each capsule id so the
 * heap looks hand-stacked but never reshuffles between renders.
 */
export function CapsuleStack({ capsules, onOpen }: Props) {
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion();

  if (capsules.length === 0) return null;

  if (!expanded) {
    // Draw at most the top few; the section header already states the count.
    const layers = capsules.slice(-PILE_LAYERS);
    return (
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="relative h-28 w-full transition-transform active:scale-[0.98]"
          aria-label={`展开 ${capsules.length} 封待启的信`}
        >
          {layers.map((c, i) => {
            const top = i === layers.length - 1;
            return (
              <span
                key={c.id}
                className="absolute left-1/2 top-3"
                style={{
                  transform: `translateX(-50%) translate(${noise(c.id, 1) * 11}px, ${noise(c.id, 2) * 5 - i * 2}px) rotate(${noise(c.id, 3) * 8}deg)`,
                  zIndex: i,
                }}
              >
                <LetterEnvelope state="sealed" width={ENVELOPE_W}>
                  {top ? <EnvelopeLabel capsule={c} /> : null}
                </LetterEnvelope>
              </span>
            );
          })}
        </button>
        <span className="mt-1 font-serif text-xs text-ink-400">轻点展开</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Tapping the surrounding blank space gathers the pile back up. */}
      <div
        className="flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-3"
        onClick={() => setExpanded(false)}
      >
        {capsules.map((c, i) => (
          <motion.button
            key={c.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(c);
            }}
            initial={reduced ? false : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1, rotate: noise(c.id, 4) * 6 }}
            transition={
              reduced
                ? { duration: 0.15 }
                : { type: 'spring', stiffness: 320, damping: 22, delay: i * 0.04 }
            }
            className="origin-center"
            aria-label={c.opened_at ? '查看这封已开启的信' : '查看这封待启的信'}
          >
            <LetterEnvelope state="sealed" width={ENVELOPE_W}>
              <EnvelopeLabel capsule={c} />
            </LetterEnvelope>
          </motion.button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="mt-3 font-serif text-xs text-ink-400 hover:text-ink-600"
      >
        收起
      </button>
    </div>
  );
}

/**
 * Stamp on the envelope face: "待启" while the letter is still unopened,
 * blank once it has been opened.
 */
function EnvelopeLabel({ capsule }: { capsule: TimeCapsule }) {
  if (capsule.opened_at) return null;
  return <span className="font-brush text-base text-ink-700">待启</span>;
}

/**
 * Deterministic pseudo-random value in [-1, 1] from a string seed + salt.
 * FNV-1a hash so the same capsule always lands at the same jaunty angle.
 */
function noise(seed: string, salt: number): number {
  let h = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 2000) / 1000 - 1;
}
