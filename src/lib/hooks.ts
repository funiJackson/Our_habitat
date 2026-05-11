import { useEffect, useState } from 'react';

/**
 * Lock the #root scroll container while a fullscreen overlay is open. iOS
 * Safari can still bubble touch-scroll through fixed-position children, so we
 * temporarily set overflow: hidden on the actual scroll container.
 */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    const root = document.getElementById('root');
    if (!root) return;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = prev;
    };
  }, [active]);
}

/**
 * Force a re-render every `intervalMs` milliseconds. Use sparingly — it's a
 * blunt tool, but ideal for keeping live "X minutes ago" / countdown labels
 * fresh without a per-element timer.
 */
export function useNowTick(intervalMs = 60_000): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
}
