import { useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, Link } from 'react-router';
import { motion } from 'motion/react';
import { fetchMyCouple } from '@/lib/couple';
import {
  fetchCurrentTheme,
  getThemeCoverSignedUrl,
  themeInputSchema,
  uploadThemeCover,
  upsertCurrentTheme,
  type MonthlyTheme,
} from '@/lib/themes';
import { listWishes, type Wish } from '@/lib/wishes';
import { useSessionStore } from '@/stores/session';
import { signOut } from '@/lib/auth';
import { MONTH_NAMES_CN, currentYearMonth } from '@/lib/dates';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { InkTextarea } from '@/components/ui/InkTextarea';
import { BleedFrame } from '@/components/ink/BleedFrame';
import { HeroIllustration } from '@/components/HeroIllustration';

const themeKey = ['monthly-theme'] as const;
const wishesKey = ['wishes'] as const;

export function Home() {
  const user = useSessionStore((s) => s.user);
  const coupleQuery = useQuery({
    queryKey: ['my-couple'],
    queryFn: fetchMyCouple,
  });
  const themeQuery = useQuery({ queryKey: themeKey, queryFn: fetchCurrentTheme });
  const wishesQuery = useQuery({ queryKey: wishesKey, queryFn: listWishes });
  const dailyWish = useMemo(
    () => pickDailyWish(wishesQuery.data ?? []),
    [wishesQuery.data],
  );

  if (coupleQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-ink-400">
        <span className="animate-pulse">…</span>
      </div>
    );
  }

  if (!coupleQuery.data?.partner_id) {
    return <Navigate to="/pair" replace />;
  }

  const displayName = user?.user_metadata?.display_name ?? user?.email ?? '';

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="font-brush text-3xl text-ink-800">栖</h1>
        <button
          type="button"
          onClick={signOut}
          aria-label="登出"
          className="p-2 text-ink-500 transition-colors hover:text-ink-900"
        >
          <PowerIcon size={22} />
        </button>
      </header>

      <section className="mb-8">
        <p className="font-serif text-sm text-ink-500">你好，</p>
        <p className="mt-1 font-brush text-3xl text-ink-900">{displayName}</p>
      </section>

      <ThemeHero theme={themeQuery.data ?? null} isLoading={themeQuery.isLoading} />

      <DailyWishCard wish={dailyWish} isLoading={wishesQuery.isLoading} />

      <TileGrid />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero theme card — illustration + month + theme title in brush
// ---------------------------------------------------------------------------

function ThemeHero({ theme, isLoading }: { theme: MonthlyTheme | null; isLoading: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upsertMut = useMutation({
    mutationFn: upsertCurrentTheme,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: themeKey });
      setEditing(false);
    },
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => {
      if (!theme) throw new Error('请先题字 / 设置主题');
      return uploadThemeCover(theme, file);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: themeKey }),
  });

  const coverQuery = useQuery({
    queryKey: ['theme-cover', theme?.cover_url],
    queryFn: () => getThemeCoverSignedUrl(theme!.cover_url!),
    enabled: !!theme?.cover_url,
    staleTime: 50 * 60 * 1000,
  });

  async function onCoverChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      await uploadMut.mutateAsync(f);
    } catch (err) {
      alert(err instanceof Error ? err.message : '上传失败');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function startEdit() {
    setTitle(theme?.title ?? '');
    setDescription(theme?.description ?? '');
    setErrorMsg(null);
    setEditing(true);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg(null);
    const parsed = themeInputSchema.safeParse({
      title,
      description: description.trim() ? description : undefined,
    });
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message ?? '输入有误');
      return;
    }
    try {
      await upsertMut.mutateAsync(parsed.data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '保存失败');
    }
  }

  const monthLabel = monthLabelOf(new Date());

  if (editing) {
    return (
      <BleedFrame intensity="strong" radius={24} className="rounded-3xl">
        <section className="rounded-3xl bg-paper px-6 py-6">
          <p className="text-xs uppercase tracking-widest text-ink-400">{monthLabel} · 本月主题</p>
          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
            <Input
              name="theme_title"
              placeholder="比如：向阳"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              autoFocus
            />
            <InkTextarea
              name="theme_description"
              placeholder="想为这个月写句话…（可选）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
            />
            {errorMsg && <p className="text-sm text-vermillion-500">{errorMsg}</p>}
            <div className="flex gap-2">
              <Button
                type="submit"
                isLoading={upsertMut.isPending}
                disabled={!title.trim()}
              >
                保存
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(false)}
                disabled={upsertMut.isPending}
              >
                取消
              </Button>
            </div>
          </form>
        </section>
      </BleedFrame>
    );
  }

  return (
    <BleedFrame intensity="strong" radius={24} className="rounded-3xl">
      <section className="overflow-hidden rounded-3xl bg-paper">
        <div className="relative aspect-[4/3] w-full">
          <HeroIllustration src={coverQuery.data ?? undefined} />
          {theme && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onCoverChange}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadMut.isPending}
                className="absolute bottom-3 right-3 rounded-full bg-paper-rice/90 px-3 py-1.5 font-brush text-sm text-ink-700 shadow-sm transition-colors hover:bg-paper-rice disabled:opacity-60"
              >
                {uploadMut.isPending
                  ? '上传中…'
                  : theme.cover_url
                    ? '换图'
                    : '+ 添加封面'}
              </button>
              {uploadMut.isPending && (
                <div
                  className="pointer-events-none absolute inset-0 bg-paper-rice/30"
                  aria-hidden
                />
              )}
            </>
          )}
        </div>
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-widest text-ink-400">
                {monthLabel} · 本月主题
              </p>
              {isLoading ? (
                <p className="mt-2 animate-pulse text-ink-400">…</p>
              ) : theme ? (
                <>
                  <p className="mt-2 font-brush text-3xl text-ink-900">{theme.title}</p>
                  {theme.description && (
                    <p className="mt-2 font-serif text-sm leading-relaxed text-ink-600">
                      {theme.description}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 font-serif text-sm text-ink-400">
                  还没起名字，给这个月题个字吧
                </p>
              )}
            </div>
            <div className="flex items-start gap-1">
              <Link
                to={`/summary/${currentYearMonth()}`}
                className="font-brush text-sm leading-none text-vermillion-500 px-3 py-1.5 rounded-sm hover:text-vermillion-700 transition-colors"
                aria-label="本月总结"
              >
                封
              </Link>
              <button
                type="button"
                onClick={startEdit}
                className="font-brush text-sm leading-none text-vermillion-500 px-3 py-1.5 rounded-sm hover:text-vermillion-700 transition-colors"
                aria-label={theme ? '编辑主题' : '设置主题'}
              >
                {theme ? '题' : '+ 题'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </BleedFrame>
  );
}

// ---------------------------------------------------------------------------
// Daily wish card
// ---------------------------------------------------------------------------

function DailyWishCard({ wish, isLoading }: { wish: Wish | null; isLoading: boolean }) {
  return (
    <BleedFrame intensity="soft" radius={24} className="mt-5 rounded-3xl">
      <section className="rounded-3xl bg-blush-50 px-6 py-6">
        {isLoading ? (
          <p className="animate-pulse text-ink-400">…</p>
        ) : wish ? (
          <Link to="/wishes" className="block">
            <p className="font-serif text-xl leading-relaxed text-ink-900">
              <span className="font-brush text-3xl text-vermillion-500 leading-none align-[-0.15em] mr-0.5">「</span>
              {wish.title}
              <span className="font-brush text-3xl text-vermillion-500 leading-none align-[-0.15em] ml-0.5">」</span>
            </p>
            {wish.note && (
              <p className="mt-2 line-clamp-2 font-serif text-sm leading-relaxed text-ink-500">
                {wish.note}
              </p>
            )}
            <p className="mt-3 text-xs text-vermillion-500">去看看 →</p>
          </Link>
        ) : (
          <Link to="/wishes" className="block">
            <p className="font-serif text-sm text-ink-400">愿望清单空着 · 添加一个吧 →</p>
          </Link>
        )}
      </section>
    </BleedFrame>
  );
}

// ---------------------------------------------------------------------------
// Tile grid (2x2) with brushy ink icons + staggered entry
// ---------------------------------------------------------------------------

const tileContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const tileItem = {
  hidden: { opacity: 0, y: 6, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4 } },
};

function TileGrid() {
  return (
    <motion.section
      className="mt-8 grid grid-cols-2 gap-4"
      variants={tileContainer}
      initial="hidden"
      animate="visible"
    >
      <Tile to="/wishes" label="愿望清单 · 书写的信笺" text="笺" />
      <Tile to="/moods" label="每日心情 · 细腻的思绪" text="绪" />
      <Tile to="/memories" label="共同回忆 · 拾起的时光" text="拾" />
      <Tile to="/capsules" label="时光胶囊 · 封存的心意" text="缄" />
    </motion.section>
  );
}

interface TileProps {
  label: string;
  to: string;
  Icon?: (props: { size?: number; color?: string; className?: string }) => ReactNode;
  /** Single Chinese character displayed in the brush font instead of an SVG icon. */
  text?: string;
}

function Tile({ label, to, Icon, text }: TileProps) {
  return (
    <motion.div variants={tileItem}>
      <Link
        to={to}
        aria-label={label}
        className="flex aspect-square items-center justify-center rounded-2xl bg-paper-mist transition-all hover:bg-paper-edge active:scale-[0.98]"
      >
        {Icon ? (
          <Icon size={72} color="var(--color-ink-700)" />
        ) : (
          <span
            className="font-brush text-[80px] leading-none text-ink-800"
            aria-hidden
          >
            {text}
          </span>
        )}
      </Link>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function monthLabelOf(d: Date): string {
  return MONTH_NAMES_CN[d.getMonth()];
}

/** Brush-styled power icon for the sign-out button. */
function PowerIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <path
        d="M 12 3 V 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        filter="url(#ink-edge)"
      />
      <path
        d="M 18.4 6.6 A 9 9 0 1 1 5.63 6.64"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        filter="url(#ink-edge)"
      />
    </svg>
  );
}

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return Math.abs(h | 0);
}

function pickDailyWish(wishes: Wish[]): Wish | null {
  const todo = wishes.filter((w) => w.status === 'todo');
  if (todo.length === 0) return null;
  const d = new Date();
  const seed = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${todo.length}`;
  const idx = hashString(seed) % todo.length;
  return todo[idx];
}
