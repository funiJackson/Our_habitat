/**
 * Shared date helpers — month names, boundary computation, gating logic.
 * Single source of truth so home.tsx, summary.tsx, etc. stay in sync.
 */

export const MONTH_NAMES_CN = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
] as const;

export function monthLabelOf(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return MONTH_NAMES_CN[date.getMonth()];
}

/** "YYYY-MM" for the current local date. */
export function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Last calendar day-of-month for the given (year, 1-indexed month). */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export interface MonthBoundaries {
  year: number;
  /** 1-indexed month number. */
  month: number;
  daysInMonth: number;
  /** ISO timestamp at start of month (inclusive). */
  monthStart: string;
  /** ISO timestamp at start of *next* month (exclusive). */
  monthEnd: string;
  /** "YYYY-MM-01" for date-typed columns. */
  monthStartDate: string;
  /** "YYYY-MM-DD" of the last day for date-typed columns (inclusive). */
  monthEndDate: string;
}

/** Compute month boundaries from a "YYYY-MM" string. Local time. */
export function monthBoundaries(yearMonth: string): MonthBoundaries {
  const [y, m] = yearMonth.split('-').map(Number);
  const days = lastDayOfMonth(y, m);
  return {
    year: y,
    month: m,
    daysInMonth: days,
    monthStart: new Date(y, m - 1, 1).toISOString(),
    monthEnd: new Date(y, m, 1).toISOString(),
    monthStartDate: `${yearMonth}-01`,
    monthEndDate: `${yearMonth}-${String(days).padStart(2, '0')}`,
  };
}

/** 0 = today is the last day; positive = days remaining (exclusive). */
export function daysLeftInCurrentMonth(now = new Date()): number {
  const last = lastDayOfMonth(now.getFullYear(), now.getMonth() + 1);
  return last - now.getDate();
}
