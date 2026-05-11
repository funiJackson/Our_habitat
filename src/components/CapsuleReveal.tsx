import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCapsuleSignedUrl,
  markCapsuleOpened,
  type TimeCapsule,
} from '@/lib/time-capsules';
import { useScrollLock } from '@/lib/hooks';
import { LetterEnvelope } from '@/components/ink/LetterEnvelope';
import { RedString } from '@/components/ink/RedString';

const queryKey = ['time-capsules'] as const;

type Phase = 'sealed' | 'untying' | 'unfurled';

interface Props {
  capsule: TimeCapsule;
  myId: string;
  partnerName: string;
  onClose: () => void;
}

/**
 * Fullscreen ceremony overlay for opening a time capsule.
 *
 *   sealed   → letter visible with red string tied + 待启
 *   untying  → red string fades and unties (700ms)
 *   unfurled → flap retracts, content scrolls down into view
 *
 * For already-opened items or sender previews, skip directly to unfurled.
 * For still-locked items, stay sealed and show countdown.
 */
export function CapsuleReveal({ capsule, myId, partnerName, onClose }: Props) {
  const queryClient = useQueryClient();
  const reduced = useReducedMotion();
  useScrollLock();

  const isLocked = new Date(capsule.unlock_at).getTime() > Date.now();
  const isMine = capsule.sender_id === myId;
  const isForMe = capsule.recipient_id === myId;
  const needsCeremony = !isLocked && isForMe && !capsule.opened_at;

  const [phase, setPhase] = useState<Phase>(() => {
    if (isLocked) return 'sealed';
    if (needsCeremony) return 'sealed';
    return 'unfurled';
  });

  const openMut = useMutation({
    mutationFn: () => markCapsuleOpened(capsule.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  // Drive the ceremony timeline for unlocked-unread recipient
  const ranRef = useRef(false);
  useEffect(() => {
    if (!needsCeremony || ranRef.current) return;
    ranRef.current = true;

    if (reduced) {
      setPhase('unfurled');
      return;
    }
    const t1 = setTimeout(() => setPhase('untying'), 800);
    const t2 = setTimeout(() => setPhase('unfurled'), 1700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [needsCeremony, reduced]);

  // Mark as opened once unfurled (recipient only)
  const markedRef = useRef(false);
  useEffect(() => {
    if (phase === 'unfurled' && needsCeremony && !markedRef.current) {
      markedRef.current = true;
      openMut.mutate();
    }
  }, [phase, needsCeremony, openMut]);

  const recipientLabel =
    capsule.sender_id === capsule.recipient_id
      ? '给自己'
      : isMine
        ? `给 ${partnerName}`
        : `${partnerName} 写给你`;

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

      <p className="mb-6 font-serif text-sm text-ink-500">{recipientLabel}</p>

      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <LetterEnvelope
          state={phase === 'unfurled' ? 'open' : 'sealed'}
          width={300}
        >
          {phase === 'unfurled' ? (
            <motion.div
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{
                duration: reduced ? 0.2 : 0.85,
                ease: [0.34, 1.2, 0.5, 1],
              }}
              style={{ transformOrigin: 'top center' }}
              className="w-full overflow-hidden"
            >
              <CapsuleContent capsule={capsule} />
            </motion.div>
          ) : (
            <div className="text-center">
              <p className="font-brush text-3xl text-ink-700">待启</p>
              {isLocked && (
                <p className="mt-2 font-brush text-2xl text-ink-900">
                  {formatRemaining(capsule.unlock_at)}
                </p>
              )}
            </div>
          )}
        </LetterEnvelope>

        {phase !== 'unfurled' && (
          <div className="pointer-events-none absolute inset-0">
            <RedString tied={phase === 'sealed'} width={300} height={216} />
          </div>
        )}
      </div>

      <p className="mt-8 font-serif text-xs text-ink-400">
        {phase === 'unfurled'
          ? '点击空白处关闭'
          : isLocked
            ? '时间未到，敬请等候'
            : phase === 'sealed'
              ? '准备开启…'
              : '红线松开…'}
      </p>
    </motion.div>
  );
}

function CapsuleContent({ capsule }: { capsule: TimeCapsule }) {
  const imageQuery = useQuery({
    queryKey: ['capsule-url', capsule.id],
    queryFn: () => getCapsuleSignedUrl(capsule.storage_path!),
    enabled: capsule.kind === 'image' && !!capsule.storage_path,
    staleTime: 50 * 60 * 1000,
  });

  if (capsule.kind === 'text') {
    return (
      <p className="whitespace-pre-wrap px-2 py-4 font-serif text-base leading-loose text-ink-900">
        {capsule.content_text}
      </p>
    );
  }
  if (capsule.kind === 'image') {
    if (imageQuery.error) {
      return <p className="py-4 text-sm text-vermillion-500">图片加载失败</p>;
    }
    if (!imageQuery.data) {
      return <p className="animate-pulse py-4 text-sm text-ink-400">…</p>;
    }
    return (
      <img
        src={imageQuery.data}
        alt=""
        className="w-full rounded-lg"
        loading="lazy"
      />
    );
  }
  return null;
}

function formatRemaining(unlock_at: string): string {
  const ms = new Date(unlock_at).getTime() - Date.now();
  if (ms <= 0) return '已可启';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return `${days} 日后`;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) return `${hours} 时后`;
  const mins = Math.max(1, Math.floor(ms / (60 * 1000)));
  return `${mins} 分后`;
}
