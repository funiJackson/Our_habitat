import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  fetchMonthlySummary,
  getBatchSignedUrls,
  type MonthlySummary,
} from '@/lib/summaries';
import { useSessionStore } from '@/stores/session';
import {
  MONTH_NAMES_CN,
  currentYearMonth,
  prevYearMonth,
  nextYearMonth,
  SUMMARY_FLOOR_YEAR_MONTH,
} from '@/lib/dates';
import { SELFIE_EMOJI } from '@/lib/mood-selfies';
import type { Mood } from '@/lib/moods';
import type { Wish } from '@/lib/wishes';
import type { TimeCapsule } from '@/lib/time-capsules';
import { BleedFrame } from '@/components/ink/BleedFrame';
import { BrushDot } from '@/components/ink/BrushDot';
import { LetterEnvelope } from '@/components/ink/LetterEnvelope';
import { PictureCapsuleIcon } from '@/components/ink/CapsuleKindIcons';
import { HeroIllustration } from '@/components/HeroIllustration';
import { SelfieAvatar } from '@/components/SelfieAvatar';
import { MoodIcon } from '@/components/MoodIcon';
import { MoodDetail } from '@/components/MoodDetail';
import { CapsuleReveal } from '@/components/CapsuleReveal';
import { CapsuleStack } from '@/components/CapsuleStack';

const YEAR_MONTH_RE = /^\d{4}-\d{2}$/;
const PHOTO_WALL_CAP = 24;

export function Summary() {
  const { yearMonth } = useParams<{ yearMonth: string }>();
  const myUserId = useSessionStore((s) => s.user?.id) ?? null;
  const queryClient = useQueryClient();

  const validYM = !!yearMonth && YEAR_MONTH_RE.test(yearMonth);
  const summaryQuery = useQuery({
    queryKey: ['monthly-summary', yearMonth, myUserId],
    queryFn: () => fetchMonthlySummary(yearMonth!, myUserId!),
    enabled: validYM && !!myUserId,
    staleTime: 5 * 60 * 1000,
  });

  // Tapping a mood tile or a capsule opens its fullscreen viewer.
  const [moodDetail, setMoodDetail] = useState<{ mood: Mood; label: string } | null>(null);
  const [revealing, setRevealing] = useState<TimeCapsule | null>(null);

  if (!validYM) return <Navigate to="/" replace />;
  if (!myUserId) return null;

  if (summaryQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-400">
        <span className="animate-pulse">…</span>
      </div>
    );
  }

  if (summaryQuery.error || !summaryQuery.data) {
    return (
      <div className="mx-auto max-w-md px-6 py-10">
        <Link to="/" className="text-sm text-ink-500 hover:text-ink-700">←</Link>
        <p className="mt-12 text-center text-sm text-vermillion-500">
          {summaryQuery.error instanceof Error
            ? summaryQuery.error.message
            : '加载失败'}
        </p>
      </div>
    );
  }

  const s = summaryQuery.data;
  const isWholeMonthEmpty =
    s.stats.wishesDoneCount === 0 &&
    s.stats.myCheckIns === 0 &&
    s.stats.partnerCheckIns === 0 &&
    s.stats.photoCount === 0 &&
    s.stats.capsulesBuriedCount === 0 &&
    s.stats.capsulesOpenedCount === 0;

  return (
    <>
      <div className="mx-auto max-w-md px-6 pb-20 pt-10">
        <Link to="/" className="text-sm text-ink-500 hover:text-ink-700">←</Link>

        <TitleSection summary={s} />

        {isWholeMonthEmpty ? (
          <p className="mt-12 text-center font-serif text-ink-500">
            这个月安静地过去了。
          </p>
        ) : (
          <>
            <StatsPoem summary={s} />
            <WishesSection wishes={s.wishes} />
            <MoodMosaic
              summary={s}
              onOpenMood={(mood, label) => setMoodDetail({ mood, label })}
            />
            <PhotoWall summary={s} />
            <CapsulesSection summary={s} onOpenCapsule={setRevealing} />
            <ClosingFlourish summary={s} />
          </>
        )}
      </div>

      <AnimatePresence>
        {moodDetail && (
          <MoodDetail
            key={`${moodDetail.mood.user_id}|${moodDetail.mood.date}`}
            mood={moodDetail.mood}
            coupleId={s.coupleId}
            authorLabel={moodDetail.label}
            onClose={() => setMoodDetail(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {revealing && (
          <CapsuleReveal
            key={revealing.id}
            capsule={revealing}
            myId={s.myUserId}
            partnerName={s.partnerName ?? 'TA'}
            onClose={() => {
              setRevealing(null);
              // Opening a capsule may have marked it read — refresh the summary
              // so its stamp flips 待启 → 已启 without a manual reload.
              queryClient.invalidateQueries({
                queryKey: ['monthly-summary', yearMonth, myUserId],
              });
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ===========================================================================
// Sections
// ===========================================================================

function Section({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      className={className}
      initial={reduced ? false : { opacity: 0, scaleY: 0.85, y: 12 }}
      whileInView={{ opacity: 1, scaleY: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
      style={{ transformOrigin: 'top' }}
    >
      {children}
    </motion.section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 font-brush text-2xl text-ink-900">{children}</h2>;
}

// ---- 1. Title -------------------------------------------------------------

/** Chevron that links to an adjacent month, or renders disabled when `to` is null. */
function MonthNavArrow({
  to,
  label,
  children,
}: {
  to: string | null;
  label: string;
  children: React.ReactNode;
}) {
  const base =
    'flex h-9 w-9 items-center justify-center rounded-full font-brush text-3xl leading-none transition-colors';
  if (!to) {
    return (
      <span className={`${base} text-ink-200`} aria-hidden>
        {children}
      </span>
    );
  }
  return (
    <Link
      to={to}
      aria-label={label}
      className={`${base} text-ink-400 hover:bg-blush-50 hover:text-ink-700`}
    >
      {children}
    </Link>
  );
}

function TitleSection({ summary }: { summary: MonthlySummary }) {
  const monthLabel = MONTH_NAMES_CN[summary.monthIndex];
  const isCurrentMonth = summary.yearMonth === currentYearMonth();
  const canGoPrev = summary.yearMonth > SUMMARY_FLOOR_YEAR_MONTH;
  const canGoNext = !isCurrentMonth;
  return (
    <Section className="mt-6">
      <BleedFrame intensity="strong" radius={24} className="rounded-3xl">
        <div className="overflow-hidden rounded-3xl bg-paper">
          <div className="aspect-[4/3] w-full">
            <HeroIllustration src={summary.coverSignedUrl ?? undefined} />
          </div>
          <div className="px-6 py-6 text-center">
            <p className="text-xs uppercase tracking-widest text-ink-400">
              {isCurrentMonth ? '本月总结' : '月度总结'} · {summary.year}
            </p>
            <div className="mt-2 flex items-center justify-center gap-4">
              <MonthNavArrow
                to={canGoPrev ? `/summary/${prevYearMonth(summary.yearMonth)}` : null}
                label="上个月"
              >
                ‹
              </MonthNavArrow>
              <p className="font-brush text-6xl leading-none text-ink-900">
                {monthLabel}
              </p>
              <MonthNavArrow
                to={canGoNext ? `/summary/${nextYearMonth(summary.yearMonth)}` : null}
                label="下个月"
              >
                ›
              </MonthNavArrow>
            </div>
            {summary.theme && (
              <p className="mt-3 font-brush text-2xl text-vermillion-500">
                「{summary.theme.title}」
              </p>
            )}
            {summary.theme?.description && (
              <p className="mt-2 font-serif text-sm leading-relaxed text-ink-600">
                {summary.theme.description}
              </p>
            )}
          </div>
        </div>
      </BleedFrame>
    </Section>
  );
}

// ---- 2. Stats poem --------------------------------------------------------

function StatsPoem({ summary }: { summary: MonthlySummary }) {
  const days = daysPassedInMonth(summary);
  const wishes = summary.stats.wishesDoneCount;

  return (
    <Section className="mt-6">
      <BleedFrame intensity="soft" radius={24} className="rounded-3xl">
        <div className="rounded-3xl bg-blush-50 px-6 py-6">
          <p className="font-serif text-base leading-loose text-ink-800">
            这一个月过了{' '}
            <span className="font-brush text-2xl text-vermillion-500 align-baseline">
              {days}
            </span>{' '}
            天，完成了{' '}
            <span className="font-brush text-2xl text-vermillion-500 align-baseline">
              {wishes}
            </span>{' '}
            个心愿。
          </p>
        </div>
      </BleedFrame>
    </Section>
  );
}

/**
 * Days elapsed this month: today's date for the current month, full month
 * length for past months. Future months read as 0 (shouldn't really happen).
 */
function daysPassedInMonth(summary: MonthlySummary): number {
  const now = new Date();
  const isCurrent =
    now.getFullYear() === summary.year && now.getMonth() === summary.monthIndex;
  if (isCurrent) return now.getDate();
  const refMs = new Date(summary.year, summary.monthIndex, 1).getTime();
  if (refMs > now.getTime()) return 0;
  return summary.daysInMonth;
}

// ---- 3. Wishes ------------------------------------------------------------

function WishesSection({ wishes }: { wishes: Wish[] }) {
  if (wishes.length === 0) {
    return (
      <Section className="mt-10">
        <SectionTitle>完成的愿望</SectionTitle>
        <p className="font-serif text-sm text-ink-400">
          这个月还没有完成的愿望。
        </p>
      </Section>
    );
  }

  return (
    <Section className="mt-10">
      <SectionTitle>完成的愿望</SectionTitle>
      <ul className="flex flex-col">
        {wishes.map((w) => (
          <li
            key={w.id}
            className="flex items-start gap-3 border-b border-[var(--color-ink-wash-2)] py-3 last:border-b-0"
          >
            <BrushDot done size={18} className="mt-1" />
            <div className="flex-1 min-w-0">
              <p className="font-serif text-base text-ink-900">{w.title}</p>
              {w.note && (
                <p className="mt-1 font-serif text-sm text-ink-500 line-clamp-1">
                  {w.note}
                </p>
              )}
            </div>
            <span className="text-xs text-ink-400">
              {w.completed_at
                ? new Date(w.completed_at).toLocaleDateString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                  })
                : ''}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ---- 4. Mood mosaic -------------------------------------------------------

function MoodMosaic({
  summary,
  onOpenMood,
}: {
  summary: MonthlySummary;
  onOpenMood: (mood: Mood, label: string) => void;
}) {
  const days = useMemo(() => {
    const out: string[] = [];
    for (let d = 1; d <= summary.daysInMonth; d++) {
      out.push(
        `${summary.year}-${String(summary.monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      );
    }
    return out;
  }, [summary.year, summary.monthIndex, summary.daysInMonth]);

  const lookup = useMemo(() => {
    const map = new Map<string, Mood>();
    for (const m of summary.moods) {
      map.set(`${m.user_id}|${m.date}`, m);
    }
    return map;
  }, [summary.moods]);

  if (summary.stats.myCheckIns === 0 && summary.stats.partnerCheckIns === 0) {
    return (
      <Section className="mt-10">
        <SectionTitle>心情潮汐</SectionTitle>
        <p className="font-serif text-sm text-ink-400">这个月没有心情记录。</p>
      </Section>
    );
  }

  return (
    <Section className="mt-10">
      <SectionTitle>心情潮汐</SectionTitle>
      <MoodRow
        label="我"
        userId={summary.myUserId}
        days={days}
        lookup={lookup}
        coupleId={summary.coupleId}
        onOpen={onOpenMood}
      />
      {summary.partnerId && (
        <div className="mt-4">
          <MoodRow
            label={summary.partnerName ?? 'TA'}
            userId={summary.partnerId}
            days={days}
            lookup={lookup}
            coupleId={summary.coupleId}
            onOpen={onOpenMood}
          />
        </div>
      )}
      {summary.stats.daysWithBothCheckedIn > 0 && (
        <p className="mt-4 font-serif text-xs text-ink-500">
          两个人都打卡的日子：{summary.stats.daysWithBothCheckedIn} 天
        </p>
      )}
    </Section>
  );
}

function MoodRow({
  label,
  userId,
  days,
  lookup,
  coupleId,
  onOpen,
}: {
  label: string;
  userId: string;
  days: string[];
  lookup: Map<string, Mood>;
  coupleId: string | null;
  onOpen: (mood: Mood, label: string) => void;
}) {
  return (
    <div>
      <span className="block font-serif text-sm text-ink-500">{label}</span>
      <div className="mt-2 -mx-2 overflow-x-auto px-2 pb-1">
        <div className="flex gap-1">
          {days.map((date) => {
            const mood = lookup.get(`${userId}|${date}`);
            const cellClass = [
              'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full',
              mood ? 'bg-paper-mist' : 'bg-paper',
            ].join(' ');
            const face =
              mood && mood.emoji === SELFIE_EMOJI && coupleId ? (
                <SelfieAvatar
                  coupleId={coupleId}
                  userId={mood.user_id}
                  date={mood.date}
                  className="h-full w-full rounded-full"
                />
              ) : mood ? (
                <MoodIcon emoji={mood.emoji} className="h-5 w-5" />
              ) : (
                <span className="text-ink-200">·</span>
              );

            if (!mood) {
              return (
                <div key={date} className={cellClass}>
                  {face}
                </div>
              );
            }
            return (
              <button
                key={date}
                type="button"
                className={`${cellClass} transition-transform active:scale-95`}
                onClick={() => onOpen(mood, label)}
                aria-label={`查看${label} ${date.slice(8)}日的心情`}
              >
                {face}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- 5. Photo wall --------------------------------------------------------

function PhotoWall({ summary }: { summary: MonthlySummary }) {
  const items = summary.mediaItems.slice(0, PHOTO_WALL_CAP);
  const total = summary.mediaItems.length;

  // Prefer thumb when available — much faster for the masonry wall.
  const paths = useMemo(
    () => items.map((m) => m.thumb_path ?? m.storage_path),
    [items],
  );
  const urlsQuery = useQuery({
    queryKey: ['summary-photo-urls', summary.yearMonth, paths],
    queryFn: () => getBatchSignedUrls('memories', paths),
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
  });

  if (total === 0) {
    return (
      <Section className="mt-10">
        <SectionTitle>这月的照片</SectionTitle>
        <p className="font-serif text-sm text-ink-400">
          <Link to="/memories" className="underline">
            还没有照片，去添加 →
          </Link>
        </p>
      </Section>
    );
  }

  return (
    <Section className="mt-10">
      <SectionTitle>这月的照片</SectionTitle>
      <div className="columns-2 gap-2">
        {items.map((m) => {
          const url = urlsQuery.data?.get(m.thumb_path ?? m.storage_path);
          return (
            <div key={m.id} className="mb-2 break-inside-avoid">
              <div className="overflow-hidden rounded-lg bg-paper-mist">
                {url ? (
                  <img
                    src={url}
                    alt=""
                    className="h-auto w-full"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center text-ink-300">
                    …
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {total > PHOTO_WALL_CAP && (
        <p className="mt-3 text-center text-xs text-ink-500">
          <Link to="/memories" className="underline decoration-ink-wash-3">
            查看全部 {total} 张 →
          </Link>
        </p>
      )}
    </Section>
  );
}

// ---- 6. Capsules ----------------------------------------------------------

function CapsulesSection({
  summary,
  onOpenCapsule,
}: {
  summary: MonthlySummary;
  onOpenCapsule: (capsule: TimeCapsule) => void;
}) {
  const startMs = new Date(summary.yearMonth + '-01').getTime();
  const endMs = new Date(summary.year, summary.monthIndex + 1, 1).getTime();

  const buried = summary.capsules.filter((c) => {
    const ts = new Date(c.created_at).getTime();
    return ts >= startMs && ts < endMs;
  });
  const opened = summary.capsules.filter((c) => {
    if (!c.opened_at) return false;
    const ts = new Date(c.opened_at).getTime();
    return ts >= startMs && ts < endMs;
  });

  if (buried.length === 0 && opened.length === 0) {
    return (
      <Section className="mt-10">
        <SectionTitle>时光胶囊</SectionTitle>
        <p className="font-serif text-sm text-ink-400">这个月没有胶囊往来。</p>
      </Section>
    );
  }

  return (
    <Section className="mt-10">
      <SectionTitle>时光胶囊</SectionTitle>
      {buried.length > 0 && (
        <div className="mb-5">
          <p className="mb-3 text-xs uppercase tracking-widest text-ink-400">
            这月埋下 · {buried.length}
          </p>
          <CapsuleStack capsules={buried} onOpen={onOpenCapsule} />
        </div>
      )}
      {opened.length > 0 && (
        <div>
          <p className="mb-3 text-xs uppercase tracking-widest text-ink-400">
            这月开启 · {opened.length}
          </p>
          <CapsuleGrid capsules={opened} state="open" onOpen={onOpenCapsule} />
        </div>
      )}
    </Section>
  );
}

function CapsuleGrid({
  capsules,
  state,
  onOpen,
}: {
  capsules: TimeCapsule[];
  state: 'sealed' | 'open';
  onOpen: (capsule: TimeCapsule) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {capsules.map((c) => (
        <li key={c.id} className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(c)}
            className="transition-transform active:scale-95"
            aria-label="查看时光胶囊"
          >
            <LetterEnvelope state={state} width={140}>
              {state === 'sealed' ? (
                <p className="font-brush text-lg text-ink-700">待启</p>
              ) : c.kind === 'text' && c.content_text ? (
                <p className="line-clamp-3 px-1 font-serif text-xs leading-relaxed text-ink-800">
                  {c.content_text}
                </p>
              ) : c.kind === 'image' ? (
                <PictureCapsuleIcon size={28} color="var(--color-ink-700)" />
              ) : (
                <p className="font-brush text-base text-ink-700">启</p>
              )}
            </LetterEnvelope>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---- 7. Closing flourish --------------------------------------------------

function ClosingFlourish({ summary }: { summary: MonthlySummary }) {
  return (
    <Section className="mt-12 flex flex-col items-center">
      <span
        className="inline-flex h-12 w-12 -rotate-3 items-center justify-center rounded-sm bg-vermillion-500 font-brush text-xl text-paper-rice shadow-sm"
        aria-hidden
      >
        栖
      </span>
      <p className="mt-4 font-serif text-sm text-ink-500">
        栖 · {summary.yearMonth}
      </p>
      <Link
        to="/"
        className="mt-6 font-serif text-sm text-ink-500 hover:text-ink-700"
      >
        ← 返回
      </Link>
    </Section>
  );
}
