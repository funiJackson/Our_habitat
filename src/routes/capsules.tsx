import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router';
import { AnimatePresence } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  createTextCapsule,
  deleteLockedCapsule,
  listCapsules,
  type TimeCapsule,
} from '@/lib/time-capsules';
import { fetchPartner } from '@/lib/moods';
import { useNowTick } from '@/lib/hooks';
import { useSessionStore } from '@/stores/session';
import { Input } from '@/components/ui/Input';
import { InkTextarea } from '@/components/ui/InkTextarea';
import { LetterEnvelope } from '@/components/ink/LetterEnvelope';
import { RedString } from '@/components/ink/RedString';
import {
  LetterCapsuleIcon,
  PictureCapsuleIcon,
} from '@/components/ink/CapsuleKindIcons';
import { CapsuleReveal } from '@/components/CapsuleReveal';

const queryKey = ['time-capsules'] as const;

type Mode = 'list' | 'create';
type Recipient = 'partner' | 'self';

export function Capsules() {
  const me = useSessionStore((s) => s.user);
  const partnerQuery = useQuery({ queryKey: ['partner'], queryFn: fetchPartner });
  const capsulesQuery = useQuery({ queryKey, queryFn: listCapsules });
  const [mode, setMode] = useState<Mode>('list');
  const [revealing, setRevealing] = useState<TimeCapsule | null>(null);
  // Re-render every minute so locked-card countdowns ("3 小时后解锁") stay fresh.
  useNowTick(60_000);

  if (!me) return null;

  if (partnerQuery.isLoading || capsulesQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-ink-400">
        <span className="animate-pulse">…</span>
      </div>
    );
  }

  if (!partnerQuery.data) {
    return <Navigate to="/pair" replace />;
  }

  const partnerName = partnerQuery.data.display_name ?? 'TA';

  return (
    <>
      {mode === 'create' ? (
        <CreateView
          myId={me.id}
          partnerId={partnerQuery.data.id}
          partnerName={partnerName}
          onDone={() => setMode('list')}
        />
      ) : (
        <ListView
          myId={me.id}
          partnerName={partnerName}
          capsules={capsulesQuery.data ?? []}
          onCreate={() => setMode('create')}
          onReveal={setRevealing}
          error={capsulesQuery.error}
        />
      )}

      <AnimatePresence>
        {revealing && (
          <CapsuleReveal
            key={revealing.id}
            capsule={revealing}
            myId={me.id}
            partnerName={partnerName}
            onClose={() => setRevealing(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

interface ListViewProps {
  myId: string;
  partnerName: string;
  capsules: TimeCapsule[];
  onCreate: () => void;
  onReveal: (c: TimeCapsule) => void;
  error: unknown;
}

function ListView({ myId, partnerName, capsules, onCreate, onReveal, error }: ListViewProps) {
  const now = Date.now();
  const { ready, locked, archive } = useMemo(() => {
    const ready: TimeCapsule[] = [];
    const locked: TimeCapsule[] = [];
    const archive: TimeCapsule[] = [];
    for (const c of capsules) {
      const unlocked = new Date(c.unlock_at).getTime() <= now;
      if (!unlocked) {
        locked.push(c);
      } else if (c.recipient_id === myId && !c.opened_at) {
        ready.push(c);
      } else {
        archive.push(c);
      }
    }
    return { ready, locked, archive };
  }, [capsules, myId, now]);

  return (
    <div className="mx-auto max-w-md px-6 py-10 pb-28">
      <header className="mb-8 flex items-center justify-between">
        <Link to="/" className="text-sm text-ink-500 hover:text-ink-700">←</Link>
        <h1 className="font-brush text-3xl text-ink-800">时光胶囊</h1>
        <span className="text-sm text-ink-300">
          {ready.length + locked.length + archive.length}
        </span>
      </header>

      {error instanceof Error && (
        <p className="mb-6 text-center text-sm text-vermillion-500">
          {error.message}
        </p>
      )}

      {capsules.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="font-brush text-2xl text-ink-700">还没有任何胶囊</p>
          <p className="mt-2 font-serif text-sm text-ink-400">写一封给未来的信吧</p>
        </div>
      ) : (
        <>
          {ready.length > 0 && (
            <Section title={`等你打开 · ${ready.length}`} highlight>
              {ready.map((c) => (
                <CapsuleRow
                  key={c.id}
                  capsule={c}
                  myId={myId}
                  partnerName={partnerName}
                  onReveal={onReveal}
                />
              ))}
            </Section>
          )}

          {locked.length > 0 && (
            <Section title="等待解锁">
              {locked.map((c) => (
                <LockedCard
                  key={c.id}
                  capsule={c}
                  myId={myId}
                  partnerName={partnerName}
                />
              ))}
            </Section>
          )}

          {archive.length > 0 && (
            <Section title="时光留念">
              {archive.map((c) => (
                <CapsuleRow
                  key={c.id}
                  capsule={c}
                  myId={myId}
                  partnerName={partnerName}
                  onReveal={onReveal}
                />
              ))}
            </Section>
          )}
        </>
      )}

      <button
        type="button"
        onClick={onCreate}
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
        className="fixed inset-x-0 mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-vermillion-500 font-brush text-3xl leading-none text-paper-rice shadow-lg shadow-vermillion-700/30 transition-transform active:scale-95"
        aria-label="写新胶囊"
      >
        寄
      </button>
    </div>
  );
}

interface SectionProps {
  title: string;
  highlight?: boolean;
  children: ReactNode;
}

function Section({ title, highlight, children }: SectionProps) {
  return (
    <section className="mb-8">
      <h2
        className={[
          'mb-4 font-brush text-xl',
          highlight ? 'text-vermillion-500' : 'text-ink-700',
        ].join(' ')}
      >
        {title}
      </h2>
      <ul className="flex flex-col gap-3">{children}</ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// CapsuleRow — unlocked items (ready to open + archive)
// ---------------------------------------------------------------------------

interface CapsuleRowProps {
  capsule: TimeCapsule;
  myId: string;
  partnerName: string;
  onReveal: (c: TimeCapsule) => void;
}

function CapsuleRow({ capsule, myId, partnerName, onReveal }: CapsuleRowProps) {
  const isMine = capsule.sender_id === myId;
  const recipientLabel =
    capsule.sender_id === capsule.recipient_id
      ? '给自己'
      : isMine
        ? `给 ${partnerName}`
        : `${partnerName} 写给你`;

  const subtitle = capsule.opened_at
    ? `已开启 · ${new Date(capsule.opened_at).toLocaleDateString()}`
    : isMine
      ? '已交付 · 等 TA 打开'
      : '可以打开了';

  const isUnread = capsule.recipient_id === myId && !capsule.opened_at;

  return (
    <li>
      <button
        type="button"
        onClick={() => onReveal(capsule)}
        className={[
          'flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors',
          isUnread
            ? 'bg-blush-100 hover:bg-blush-200'
            : 'bg-paper-mist hover:bg-paper-edge',
        ].join(' ')}
      >
        {capsule.kind === 'image' ? (
          <PictureCapsuleIcon size={22} color="var(--color-ink-700)" />
        ) : (
          <LetterCapsuleIcon size={22} color="var(--color-ink-700)" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-serif text-base text-ink-900">{recipientLabel}</p>
          <p className={[
            'mt-0.5 font-serif text-xs',
            isUnread ? 'text-vermillion-500' : 'text-ink-500',
          ].join(' ')}>
            {subtitle}
          </p>
        </div>
        <span className="text-ink-300">›</span>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// LockedCard — sealed letter centerpiece for items still in countdown
// ---------------------------------------------------------------------------

function LockedCard({
  capsule,
  myId,
  partnerName,
}: {
  capsule: TimeCapsule;
  myId: string;
  partnerName: string;
}) {
  const queryClient = useQueryClient();
  const isMine = capsule.sender_id === myId;
  const recipientLabel =
    capsule.sender_id === capsule.recipient_id
      ? '给自己'
      : isMine
        ? `给 ${partnerName}`
        : `${partnerName} 写给你`;

  const remaining = formatDistanceToNow(new Date(capsule.unlock_at), {
    locale: zhCN,
    addSuffix: true,
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteLockedCapsule(capsule),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return (
    <li className="flex flex-col items-center rounded-2xl bg-paper-mist/50 px-6 py-6">
      <p className="mb-3 font-serif text-xs text-ink-500">{recipientLabel}</p>
      <div className="relative">
        <LetterEnvelope state="sealed" width={200}>
          <div className="text-center">
            <p className="font-brush text-2xl text-ink-700">待启</p>
            <p className="mt-1 font-brush text-base text-ink-900">{remaining}解锁</p>
          </div>
        </LetterEnvelope>
        <div className="pointer-events-none absolute inset-0">
          <RedString tied width={200} height={144} />
        </div>
      </div>
      {isMine && (
        <button
          type="button"
          onClick={() => {
            if (confirm('删除这条尚未解锁的胶囊？')) deleteMut.mutate();
          }}
          disabled={deleteMut.isPending}
          className="mt-4 font-serif text-xs text-ink-400 transition-colors hover:text-vermillion-500"
        >
          撤回
        </button>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

interface CreateViewProps {
  myId: string;
  partnerId: string;
  partnerName: string;
  onDone: () => void;
}

function CreateView({ myId, partnerId, partnerName, onDone }: CreateViewProps) {
  const queryClient = useQueryClient();
  const [recipient, setRecipient] = useState<Recipient>('partner');
  const [content, setContent] = useState('');
  const [unlockAt, setUnlockAt] = useState<string>(defaultUnlockLocal());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const recipient_id = recipient === 'partner' ? partnerId : myId;
      return createTextCapsule({
        kind: 'text',
        recipient_id,
        content_text: content,
        unlock_at: unlockAt,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      onDone();
    },
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg(null);
    try {
      await mut.mutateAsync();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '保存失败');
    }
  }

  const minLocal = nowLocal();

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-ink-500 hover:text-ink-700"
        >
          ← 取消
        </button>
        <h1 className="font-brush text-3xl text-ink-800">写胶囊</h1>
        <span className="w-12" />
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-7">
        <Toggle
          label="寄给"
          value={recipient}
          onChange={setRecipient}
          options={[
            { value: 'partner', label: partnerName },
            { value: 'self', label: '自己' },
          ]}
        />

        <InkTextarea
          label="内容"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={5000}
          rows={6}
          placeholder="想对未来的 TA / 自己说点什么…"
        />

        <Input
          name="unlock_at"
          type="datetime-local"
          label="解锁时间"
          required
          min={minLocal}
          value={unlockAt}
          onChange={(e) => setUnlockAt(e.target.value)}
        />

        {errorMsg && <p className="text-sm text-vermillion-500">{errorMsg}</p>}

        <button
          type="submit"
          disabled={!content.trim() || mut.isPending}
          className="rounded-2xl bg-vermillion-500 px-6 py-3.5 font-brush text-xl text-paper-rice transition-colors hover:bg-vermillion-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mut.isPending ? '埋藏中…' : '埋藏'}
        </button>
      </form>
    </div>
  );
}

interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

interface ToggleProps<T extends string> {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: ToggleOption<T>[];
}

function Toggle<T extends string>({ label, value, onChange, options }: ToggleProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-widest text-ink-400">{label}</span>
      <div className="flex gap-2">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={[
                'flex-1 rounded-2xl px-4 py-2.5 font-serif text-sm transition-colors',
                active
                  ? 'bg-ink-700 text-paper-rice'
                  : 'bg-paper-mist text-ink-700 hover:bg-paper-edge',
              ].join(' ')}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowLocal(): string {
  return toLocalInput(new Date());
}

function defaultUnlockLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(20, 0, 0, 0);
  return toLocalInput(d);
}
