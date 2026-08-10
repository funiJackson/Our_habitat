import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { AnimatePresence } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  NOTE_EMOJI,
  fetchPartner,
  fetchRecentMoods,
  recentDates,
  todayISO,
  upsertMyMood,
  type Mood,
} from '@/lib/moods';
import { SELFIE_EMOJI, selfiePath, uploadMoodSelfie } from '@/lib/mood-selfies';
import { useSessionStore } from '@/stores/session';
import { Button } from '@/components/ui/Button';
import { InkTextarea } from '@/components/ui/InkTextarea';
import { MoodIcon } from '@/components/MoodIcon';
import { SelfieAvatar } from '@/components/SelfieAvatar';
import { MoodDetail } from '@/components/MoodDetail';
import { SelfieCamera } from '@/components/SelfieCamera';
import { BrushLine } from '@/components/ink/BrushLine';

const moodsQueryKey = ['moods', 'recent'] as const;
const partnerQueryKey = ['couple', 'partner'] as const;

export function Moods() {
  const queryClient = useQueryClient();
  const myUserId = useSessionStore((s) => s.user?.id) ?? null;

  const moodsQuery = useQuery({
    queryKey: moodsQueryKey,
    queryFn: () => fetchRecentMoods(7),
  });
  const partnerQuery = useQuery({ queryKey: partnerQueryKey, queryFn: fetchPartner });

  const upsertMut = useMutation({
    mutationFn: upsertMyMood,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: moodsQueryKey }),
  });

  const today = todayISO();
  const dates = useMemo(() => recentDates(7), []);

  const moodsByKey = useMemo(() => {
    const map = new Map<string, Mood>();
    for (const m of moodsQuery.data ?? []) {
      map.set(`${m.user_id}|${m.date}`, m);
    }
    return map;
  }, [moodsQuery.data]);

  /** Couple id derived from existing mood rows; null only when nothing's been logged yet. */
  const coupleId = (moodsQuery.data ?? [])[0]?.couple_id ?? null;

  const myToday = myUserId ? moodsByKey.get(`${myUserId}|${today}`) : undefined;
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Seed the diary field from today's saved entry — once. After that the
  // textarea is the source of truth, so clearing it to empty actually sticks
  // (a `??` fallback would keep resurrecting the saved text).
  const noteSeeded = useRef(false);
  useEffect(() => {
    if (noteSeeded.current || !moodsQuery.isSuccess) return;
    noteSeeded.current = true;
    if (myToday?.note) setNote(myToday.note);
  }, [moodsQuery.isSuccess, myToday?.note]);

  // Tapped day in the week strip → fullscreen mood viewer (full photo + note).
  const [detail, setDetail] = useState<{ mood: Mood; label: string } | null>(null);
  const myLabel = '我';
  const partnerLabel = partnerQuery.data?.display_name ?? 'TA';

  // Photo state — `selfieFile` holds a freshly shot photo until save;
  // `previewUrl` is its object URL, shown in the polaroid slot. `photoCleared`
  // lets you drop a photo that's already saved: the entry falls back to
  // text-only on the next save (the storage object is simply left orphaned).
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoCleared, setPhotoCleared] = useState(false);

  useEffect(() => {
    if (!selfieFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selfieFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selfieFile]);

  /** A photo already saved for today, still wanted. */
  const hasSavedPhoto = myToday?.emoji === SELFIE_EMOJI && !photoCleared;
  const hasPhoto = !!selfieFile || hasSavedPhoto;
  const canSave = note.trim().length > 0 || hasPhoto;

  /** Camera unavailable (permission denied / unsupported) → OS picker instead.
   *  The input has no `capture` attribute on purpose, so the sheet offers the
   *  photo library rather than forcing the flash-happy system camera. */
  const onCameraFallback = useCallback(() => {
    setCameraOpen(false);
    selfieInputRef.current?.click();
  }, []);

  const onCameraCapture = useCallback((f: File) => {
    setSelfieFile(f);
    setPhotoCleared(false);
    setCameraOpen(false);
  }, []);

  function onSelfieFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setSelfieFile(f);
    setPhotoCleared(false);
    if (selfieInputRef.current) selfieInputRef.current.value = '';
  }

  async function save() {
    const text = note.trim();
    if (!text && !hasPhoto) {
      setErrorMsg('写点什么，或者拍一张');
      return;
    }
    setErrorMsg(null);
    try {
      if (selfieFile) {
        await uploadMoodSelfie(selfieFile, today);
        // Path is the same each time (one photo per user/date), so the cached
        // signed URL still works — but the bytes behind it changed. Invalidate
        // so SelfieAvatar refetches a new signed URL (different JWT) and the
        // browser image cache misses, picking up the new photo.
        if (coupleId && myUserId) {
          queryClient.invalidateQueries({
            queryKey: ['mood-selfie-url', selfiePath(coupleId, myUserId, today)],
          });
        }
      }
      await upsertMut.mutateAsync({
        date: today,
        emoji: hasPhoto ? SELFIE_EMOJI : NOTE_EMOJI,
        note: text ? text : undefined,
      });
      // Deliberately keep the text and the photo on screen — it's a diary page,
      // not a form; you should still see what you just wrote.
      setPhotoCleared(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '保存失败');
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link to="/" className="text-sm text-ink-500 hover:text-ink-700">←</Link>
        <h1 className="font-brush text-4xl leading-none text-ink-800">绪</h1>
        <span className="w-12" aria-hidden />
      </header>

      <input
        ref={selfieInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onSelfieFile}
      />

      <section className="mb-10">
        <div className="flex items-baseline gap-3">
          <h2 className="font-brush text-3xl leading-none text-ink-800">{dayLabel(today)}</h2>
          <span className="font-serif text-sm text-ink-400">{weekdayLabel(today)}</span>
        </div>
        <div className="mt-3 opacity-70">
          <BrushLine orientation="h" length="100%" color="var(--color-ink-wash-2)" />
        </div>

        <div className="mt-4">
          <InkTextarea
            placeholder="今天…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={7}
          />
        </div>

        <div className="mt-7 flex items-center gap-4">
          <PhotoSlot
            previewUrl={previewUrl}
            savedPhoto={
              hasSavedPhoto && !selfieFile && coupleId && myUserId
                ? { coupleId, userId: myUserId, date: today }
                : null
            }
            onShoot={() => setCameraOpen(true)}
            onClear={() => {
              setSelfieFile(null);
              setPhotoCleared(true);
            }}
          />
          <p className="font-serif text-xs leading-relaxed text-ink-400">
            {hasPhoto ? '点照片可以重拍' : '也可以拍一张'}
          </p>
        </div>

        {errorMsg && <p className="mt-4 text-sm text-vermillion-500">{errorMsg}</p>}

        <Button
          className="mt-6 w-full"
          size="lg"
          onClick={save}
          isLoading={upsertMut.isPending}
          disabled={!canSave}
        >
          {myToday ? '改一改' : '记下来'}
        </Button>
      </section>

      <section>
        <h2 className="mb-4 font-brush text-xl text-ink-700">这一周</h2>
        {moodsQuery.isLoading ? (
          <p className="text-center text-ink-400 animate-pulse">…</p>
        ) : moodsQuery.error ? (
          <p className="text-center text-sm text-vermillion-500">
            {moodsQuery.error instanceof Error ? moodsQuery.error.message : '加载失败'}
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            <Row
              label={myLabel}
              dates={dates}
              today={today}
              moodsByKey={moodsByKey}
              userId={myUserId}
              coupleId={coupleId}
              onOpen={(mood) => setDetail({ mood, label: myLabel })}
            />
            <Row
              label={partnerLabel}
              dates={dates}
              today={today}
              moodsByKey={moodsByKey}
              userId={partnerQuery.data?.id ?? null}
              coupleId={coupleId}
              onOpen={(mood) => setDetail({ mood, label: partnerLabel })}
            />
          </div>
        )}
      </section>

      <AnimatePresence>
        {cameraOpen && (
          <SelfieCamera
            onCapture={onCameraCapture}
            onClose={() => setCameraOpen(false)}
            onFallback={onCameraFallback}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detail && (
          <MoodDetail
            key={`${detail.mood.user_id}|${detail.mood.date}`}
            mood={detail.mood}
            coupleId={coupleId}
            authorLabel={detail.label}
            onClose={() => setDetail(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Photo slot — camera button that becomes a polaroid once there's a photo
// ---------------------------------------------------------------------------

interface PhotoSlotProps {
  /** Object URL of a photo shot this session, not yet saved. */
  previewUrl: string | null;
  /** Today's already-saved photo, when there's no fresher one to show. */
  savedPhoto: { coupleId: string; userId: string; date: string } | null;
  onShoot: () => void;
  onClear: () => void;
}

/**
 * Empty, it's a quiet ink camera on a paper tile. With a photo, it turns into a
 * little polaroid taped into the page — white border, bottom margin, tilted a
 * few degrees, with a vermillion 印 pressed into the corner. Tapping it retakes;
 * the × peels it off. The tilt straightens on hover/press so it feels physical.
 */
function PhotoSlot({ previewUrl, savedPhoto, onShoot, onClear }: PhotoSlotProps) {
  if (!previewUrl && !savedPhoto) {
    return (
      <button
        type="button"
        onClick={onShoot}
        aria-label="拍一张"
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-paper transition-colors hover:bg-paper-mist"
      >
        <CameraIcon className="h-8 w-8 text-ink-600" />
      </button>
    );
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onShoot}
        aria-label="重拍"
        className="block -rotate-3 rounded-[3px] bg-paper-rice p-1.5 pb-5 shadow-[0_6px_16px_rgba(42,38,34,0.16)] transition-transform duration-200 hover:-rotate-1 active:rotate-0"
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="h-16 w-16 object-cover" />
        ) : savedPhoto ? (
          <SelfieAvatar
            coupleId={savedPhoto.coupleId}
            userId={savedPhoto.userId}
            date={savedPhoto.date}
            className="h-16 w-16"
          />
        ) : null}
        <span
          className="absolute -right-2 -top-2 inline-flex h-5 w-5 rotate-6 items-center justify-center rounded-sm bg-vermillion-500 text-[10px] font-brush leading-none text-paper-rice shadow-sm"
          aria-hidden
        >
          印
        </span>
      </button>
      <button
        type="button"
        onClick={onClear}
        aria-label="不要这张了"
        className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink-700/85 text-[11px] leading-none text-paper-rice"
      >
        ×
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

function dayLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(m)}月${Number(d)}日`;
}

function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

// ---------------------------------------------------------------------------
// Camera icon
// ---------------------------------------------------------------------------

function CameraIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden
      focusable="false"
    >
      <rect
        x="3"
        y="7"
        width="18"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        filter="url(#ink-edge)"
      />
      <circle
        cx="12"
        cy="13.5"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        filter="url(#ink-edge)"
      />
      <path
        d="M 8 7 L 9 5 L 15 5 L 16 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        filter="url(#ink-edge)"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Week strip
// ---------------------------------------------------------------------------

interface RowProps {
  label: string;
  dates: string[];
  today: string;
  moodsByKey: Map<string, Mood>;
  userId: string | null;
  coupleId: string | null;
  onOpen: (mood: Mood) => void;
}

function Row({ label, dates, today, moodsByKey, userId, coupleId, onOpen }: RowProps) {
  return (
    <div>
      <span className="block font-serif text-sm text-ink-500">{label}</span>
      <div className="relative mt-2">
        <div className="flex justify-between gap-1">
          {dates.map((date) => {
            const mood = userId ? moodsByKey.get(`${userId}|${date}`) : undefined;
            const isToday = date === today;
            return (
              <Cell
                key={date}
                mood={mood}
                isToday={isToday}
                dateLabel={date.slice(8)}
                coupleId={coupleId}
                onOpen={onOpen}
              />
            );
          })}
        </div>
        <div className="absolute inset-x-1 top-1/2 -z-10 -translate-y-1/2 opacity-60">
          <BrushLine orientation="h" length="100%" color="var(--color-ink-wash-2)" />
        </div>
      </div>
    </div>
  );
}

function Cell({
  mood,
  isToday,
  dateLabel,
  coupleId,
  onOpen,
}: {
  mood: Mood | undefined;
  isToday: boolean;
  dateLabel: string;
  coupleId: string | null;
  onOpen: (mood: Mood) => void;
}) {
  const className = [
    'flex h-12 w-12 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-full',
    mood ? 'bg-paper-mist' : 'bg-paper',
    isToday ? 'ring-2 ring-vermillion-500/60 ring-offset-2 ring-offset-paper-rice' : '',
  ].join(' ');

  const face =
    mood && mood.emoji === SELFIE_EMOJI && coupleId ? (
      <SelfieAvatar
        coupleId={coupleId}
        userId={mood.user_id}
        date={mood.date}
        className="h-9 w-9 rounded-full"
      />
    ) : mood ? (
      <MoodIcon emoji={mood.emoji} className="h-6 w-6" />
    ) : (
      <span className="text-ink-300">·</span>
    );

  // A note (text) lives behind a tap, so flag days that have one with a small
  // dot beside the date — otherwise there's no sign there's anything to open.
  const dateRow = (
    <span className="flex items-center gap-0.5 text-[10px] leading-none text-ink-400">
      {mood?.note && (
        <span className="h-1 w-1 rounded-full bg-vermillion-500/70" aria-hidden />
      )}
      {dateLabel}
    </span>
  );

  if (!mood) {
    return (
      <div className={className}>
        {face}
        {dateRow}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`${className} transition-transform active:scale-95`}
      onClick={() => onOpen(mood)}
      aria-label={`查看${dateLabel}日的心情`}
    >
      {face}
      {dateRow}
    </button>
  );
}
