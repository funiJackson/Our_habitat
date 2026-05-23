import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { getMoodSelfieSignedUrl, selfiePath, SELFIE_EMOJI } from '@/lib/mood-selfies';
import { useScrollLock } from '@/lib/hooks';
import { MoodIcon } from '@/components/MoodIcon';
import type { Mood } from '@/lib/moods';

interface Props {
  mood: Mood;
  coupleId: string | null;
  /** Who logged it — "我" or the partner's name. */
  authorLabel: string;
  onClose: () => void;
}

/**
 * Fullscreen viewer for a single day's mood. Tapped from the week strip, it
 * shows the selfie at a readable size (or a large emoji) plus the full text
 * note — long notes scroll within the card rather than being clipped.
 */
export function MoodDetail({ mood, coupleId, authorLabel, onClose }: Props) {
  useScrollLock();
  const isSelfie = mood.emoji === SELFIE_EMOJI;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-paper-rice/96 px-6"
      style={{
        backdropFilter: 'blur(6px)',
        paddingTop: 'calc(env(safe-area-inset-top) + 2.5rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 2.5rem)',
      }}
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-6 top-6 text-2xl leading-none text-ink-400 hover:text-ink-700"
        aria-label="关闭"
      >
        ×
      </button>

      <p className="mb-6 font-serif text-sm text-ink-500">
        {formatDate(mood.date)} · {authorLabel}
      </p>

      <div
        className="flex w-full max-w-xs flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isSelfie ? (
          <SelfieFull coupleId={coupleId} userId={mood.user_id} date={mood.date} />
        ) : (
          <MoodIcon emoji={mood.emoji} className="h-28 w-28" />
        )}

        {mood.note && (
          <p className="mt-6 max-h-[34vh] w-full overflow-y-auto overscroll-contain whitespace-pre-wrap text-center font-serif text-base leading-loose text-ink-900">
            {mood.note}
          </p>
        )}
      </div>

      <p className="mt-8 font-serif text-xs text-ink-400">点击空白处关闭</p>
    </motion.div>
  );
}

function SelfieFull({
  coupleId,
  userId,
  date,
}: {
  coupleId: string | null;
  userId: string;
  date: string;
}) {
  const path = coupleId ? selfiePath(coupleId, userId, date) : null;
  const urlQuery = useQuery({
    queryKey: ['mood-selfie-url', path],
    queryFn: () => getMoodSelfieSignedUrl(path!),
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    retry: false,
  });

  if (urlQuery.error) {
    return <p className="py-8 text-sm text-vermillion-500">图片加载失败</p>;
  }
  if (!urlQuery.data) {
    return <p className="animate-pulse py-8 text-sm text-ink-400">…</p>;
  }
  return (
    <img
      src={urlQuery.data}
      alt=""
      className="max-h-[48vh] w-full rounded-lg object-contain"
    />
  );
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(m)}月${Number(d)}日`;
}
