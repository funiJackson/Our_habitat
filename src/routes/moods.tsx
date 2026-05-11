import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MOOD_PRESETS,
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
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selfie capture state — `selfieFile` holds the captured photo until save.
  // `previewUrl` is an object URL for the captured file, rendered as the tile
  // face while the user is reviewing the shot. Cleared on save / cancel so the
  // camera icon comes back.
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selfieFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selfieFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selfieFile]);

  const effectiveEmoji = selectedEmoji ?? myToday?.emoji ?? null;
  const effectiveNote = selectedEmoji === null && note === '' ? (myToday?.note ?? '') : note;

  function onSelfieTile() {
    setSelectedEmoji(SELFIE_EMOJI);
    selfieInputRef.current?.click();
  }

  async function onSelfieFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setSelfieFile(f);
    setSelectedEmoji(SELFIE_EMOJI);
    if (selfieInputRef.current) selfieInputRef.current.value = '';
  }

  async function save() {
    if (!effectiveEmoji) {
      setErrorMsg('选一个心情吧');
      return;
    }
    setErrorMsg(null);
    try {
      // For selfie mood: upload the captured file first (if any) before saving.
      // If user re-selected selfie without retaking and one already exists, we
      // skip the upload and just (re)save the mood row.
      if (effectiveEmoji === SELFIE_EMOJI && selfieFile) {
        await uploadMoodSelfie(selfieFile, today);
        // Path is the same each time (one selfie per user/date), so the cached
        // signed URL still works — but the bytes behind it changed. Invalidate
        // so SelfieAvatar refetches a new signed URL (different JWT) and the
        // browser image cache misses, picking up the new photo.
        if (coupleId && myUserId) {
          queryClient.invalidateQueries({
            queryKey: ['mood-selfie-url', selfiePath(coupleId, myUserId, today)],
          });
        }
      }
      if (effectiveEmoji === SELFIE_EMOJI && !selfieFile && myToday?.emoji !== SELFIE_EMOJI) {
        setErrorMsg('请先自拍一张');
        return;
      }
      await upsertMut.mutateAsync({
        date: today,
        emoji: effectiveEmoji,
        note: effectiveNote.trim() ? effectiveNote.trim() : undefined,
      });
      setSelectedEmoji(null);
      setNote('');
      setSelfieFile(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '保存失败');
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link to="/" className="text-sm text-ink-500 hover:text-ink-700">←</Link>
        <h1 className="font-brush text-3xl text-ink-800">心情打卡</h1>
        <span className="w-12" aria-hidden />
      </header>

      <input
        ref={selfieInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={onSelfieFile}
      />

      <section className="mb-10">
        <p className="text-xs uppercase tracking-widest text-ink-400">今天</p>
        <p className="mt-2 font-serif text-xl leading-relaxed text-ink-800">
          {myToday ? '换个心情？' : '你今天心情怎么样？'}
        </p>

        <div className="mt-6 grid grid-cols-4 gap-3">
          {MOOD_PRESETS.map((p) => {
            const isActive = effectiveEmoji === p.id;
            const isSelfie = p.id === SELFIE_EMOJI;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (isSelfie) onSelfieTile();
                  else setSelectedEmoji(p.id);
                }}
                className={[
                  'relative flex aspect-square items-center justify-center rounded-2xl transition-all',
                  isActive
                    ? 'bg-paper-mist scale-[1.04] shadow-sm'
                    : 'bg-paper hover:bg-paper-mist/60',
                ].join(' ')}
                aria-pressed={isActive}
              >
                {isSelfie && previewUrl ? (
                  <img
                    src={previewUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full rounded-2xl object-cover"
                  />
                ) : isSelfie ? (
                  <CameraIcon className="h-9 w-9 text-ink-700" />
                ) : (
                  <MoodIcon emoji={p.id} className="h-10 w-10" />
                )}
                {isActive && (
                  <span
                    className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-sm bg-vermillion-500 text-[8px] font-brush leading-none text-paper-rice"
                    aria-hidden
                  >
                    印
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          <InkTextarea
            placeholder="想说点什么…"
            value={effectiveNote}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
          />
        </div>

        {errorMsg && <p className="mt-2 text-sm text-vermillion-500">{errorMsg}</p>}

        <Button
          className="mt-6 w-full"
          size="lg"
          onClick={save}
          isLoading={upsertMut.isPending}
          disabled={!effectiveEmoji}
        >
          {myToday ? '更新心情' : '记下来'}
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
              label="我"
              dates={dates}
              today={today}
              moodsByKey={moodsByKey}
              userId={myUserId}
              coupleId={coupleId}
            />
            <Row
              label={partnerQuery.data?.display_name ?? 'TA'}
              dates={dates}
              today={today}
              moodsByKey={moodsByKey}
              userId={partnerQuery.data?.id ?? null}
              coupleId={coupleId}
            />
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Camera icon — sits on the selfie tile permanently
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
}

function Row({ label, dates, today, moodsByKey, userId, coupleId }: RowProps) {
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
}: {
  mood: Mood | undefined;
  isToday: boolean;
  dateLabel: string;
  coupleId: string | null;
}) {
  return (
    <div
      className={[
        'flex h-12 w-12 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-full',
        mood ? 'bg-paper-mist' : 'bg-paper',
        isToday ? 'ring-2 ring-vermillion-500/60 ring-offset-2 ring-offset-paper-rice' : '',
      ].join(' ')}
      title={mood?.note ?? ''}
    >
      {mood && mood.emoji === SELFIE_EMOJI && coupleId ? (
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
      )}
      <span className="text-[10px] leading-none text-ink-400">{dateLabel}</span>
    </div>
  );
}
