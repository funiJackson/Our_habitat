import { Outlet } from 'react-router';
import { InkFilters } from './ink/InkFilters';

/**
 * Shared layout for authenticated routes. We deliberately don't wrap <Outlet>
 * in <AnimatePresence> — the page-fade transition extended #root's scroll
 * height during exit (popLayout absolute child contributed to scrollHeight),
 * causing a "scrollable blank" right after navigation. Static swap is rock
 * solid; per-page entrance animations (e.g. summary's whileInView) still play.
 */
export function AppShell() {
  return (
    <div className="flex min-h-full flex-col">
      <InkFilters />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
