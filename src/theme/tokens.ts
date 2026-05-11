/**
 * Design tokens — single source of truth in CSS (see src/index.css @theme block).
 * This file exposes a TS-friendly mirror for cases where Tailwind classes are
 * not enough (e.g. dynamic styles, framer-motion animations, canvas drawing).
 *
 * Do NOT add new tokens here without first adding them to index.css.
 */

export const colors = {
  paper: {
    base: 'var(--color-paper)',
    rice: 'var(--color-paper-rice)',
    mist: 'var(--color-paper-mist)',
    edge: 'var(--color-paper-edge)',
  },
  blush: {
    50: 'var(--color-blush-50)',
    100: 'var(--color-blush-100)',
    200: 'var(--color-blush-200)',
    300: 'var(--color-blush-300)',
    400: 'var(--color-blush-400)',
    500: 'var(--color-blush-500)',
    600: 'var(--color-blush-600)',
    700: 'var(--color-blush-700)',
  },
  cream: {
    50: 'var(--color-cream-50)',
    100: 'var(--color-cream-100)',
    200: 'var(--color-cream-200)',
    500: 'var(--color-cream-500)',
  },
  sky: {
    50: 'var(--color-sky-50)',
    100: 'var(--color-sky-100)',
    200: 'var(--color-sky-200)',
    500: 'var(--color-sky-500)',
  },
  ink: {
    100: 'var(--color-ink-100)',
    200: 'var(--color-ink-200)',
    300: 'var(--color-ink-300)',
    400: 'var(--color-ink-400)',
    500: 'var(--color-ink-500)',
    600: 'var(--color-ink-600)',
    700: 'var(--color-ink-700)',
    900: 'var(--color-ink-900)',
  },
  vermillion: {
    300: 'var(--color-vermillion-300)',
    500: 'var(--color-vermillion-500)',
    700: 'var(--color-vermillion-700)',
  },
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
} as const;

export const motionPresets = {
  /** Soft spring used for page transitions and card entrances. */
  softSpring: { type: 'spring' as const, stiffness: 240, damping: 26 },
  /** Quick reveal for tap feedback. */
  tap: { type: 'spring' as const, stiffness: 400, damping: 30 },
} as const;

/**
 * Ink-wash motion presets. Pair with `motion` from `motion/react`:
 *   <motion.div {...inkMotion.bleedIn}>...</motion.div>
 *
 * Heavy presets (unfurl, strokeDraw) should be gated by useReducedMotion()
 * at the call site to fall back to instant transitions.
 */
export const inkMotion = {
  /** Card / element entrance — slight scale + de-blur, soft custom ease. */
  bleedIn: {
    initial: { opacity: 0, scale: 0.96, filter: 'blur(6px)' },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
    transition: { duration: 0.55, ease: [0.22, 0.61, 0.36, 1] as const },
  },
  /** Brush stroke draw (BrushCheck, RedString untie, BrushLine init). */
  strokeDraw: {
    initial: { pathLength: 0, opacity: 0.4 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 0.6, ease: 'easeInOut' as const },
  },
  /** Scroll-style unfurl — capsule reveal, top-down 画卷 effect. */
  unfurl: {
    initial: { scaleY: 0, opacity: 0 },
    animate: { scaleY: 1, opacity: 1 },
    transition: { duration: 0.9, ease: [0.34, 1.2, 0.5, 1] as const },
    style: { transformOrigin: 'top' as const },
  },
  /** Page transition — used by AppShell with AnimatePresence keyed on pathname. */
  pageFade: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.35 },
  },
} as const;
