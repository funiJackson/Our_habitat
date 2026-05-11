import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteMedia,
  getSignedUrl,
  listMedia,
  uploadPhoto,
  type MediaItem,
} from '@/lib/memories';
import { getBatchSignedUrls } from '@/lib/storage';
import { useScrollLock } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { BleedFrame } from '@/components/ink/BleedFrame';
import { BrushLine } from '@/components/ink/BrushLine';

const queryKey = ['media', 'list'] as const;
const VIEW_STORAGE_KEY = 'sandz-memories-view';
type View = 'grid' | 'timeline';

function loadView(): View {
  if (typeof window === 'undefined') return 'grid';
  const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return v === 'timeline' ? 'timeline' : 'grid';
}

export function Memories() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<MediaItem | null>(null);
  const [view, setViewState] = useState<View>(loadView);

  function setView(v: View) {
    setViewState(v);
    window.localStorage.setItem(VIEW_STORAGE_KEY, v);
  }

  const mediaQuery = useQuery({ queryKey, queryFn: listMedia });

  const uploadMut = useMutation({
    mutationFn: (file: File) => uploadPhoto(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteMut = useMutation({
    mutationFn: (item: MediaItem) => deleteMedia(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setOpenItem(null);
    },
  });

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    try {
      await uploadMut.mutateAsync(file);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '上传失败');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const items = mediaQuery.data ?? [];

  // Batch-fetch all signed URLs in a single round trip; share via prop down
  // to thumbs and lightbox to avoid N parallel storage calls on cold load.
  const itemsVersion = useMemo(() => {
    if (items.length === 0) return 'empty';
    return `${items.length}|${items[0].id}|${items[items.length - 1].id}`;
  }, [items]);

  // Display path = thumb if available (~10× smaller), else fall back to original.
  const urlsQuery = useQuery({
    queryKey: ['memories-urls', itemsVersion],
    queryFn: () =>
      getBatchSignedUrls(
        'memories',
        items.map((i) => i.thumb_path ?? i.storage_path),
      ),
    enabled: items.length > 0,
    staleTime: 50 * 60 * 1000,
  });

  const urls = urlsQuery.data ?? new Map<string, string>();
  const urlFor = (item: MediaItem) =>
    urls.get(item.thumb_path ?? item.storage_path) ?? null;

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <Link to="/" className="text-sm text-ink-500 hover:text-ink-700">←</Link>
        <h1 className="font-brush text-3xl text-ink-800">回忆</h1>
        <span className="text-sm text-ink-300">{items.length}</span>
      </header>

      <div className="mb-6 flex items-center justify-end gap-2">
        <ViewToggle view={view} onChange={setView} />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
      <Button
        className="mb-6 w-full"
        size="lg"
        onClick={() => fileInputRef.current?.click()}
        isLoading={uploadMut.isPending}
      >
        + 添加照片
      </Button>

      {errorMsg && <p className="mb-4 text-center text-sm text-vermillion-500">{errorMsg}</p>}

      {mediaQuery.isLoading ? (
        <p className="text-center text-ink-400 animate-pulse">…</p>
      ) : mediaQuery.error ? (
        <p className="text-center text-sm text-vermillion-500">
          {mediaQuery.error instanceof Error ? mediaQuery.error.message : '加载失败'}
        </p>
      ) : items.length === 0 ? (
        <p className="text-center font-serif text-sm text-ink-400">
          还没有照片，添加一张开始记录吧
        </p>
      ) : view === 'grid' ? (
        <GridView items={items} urlFor={urlFor} onOpen={setOpenItem} />
      ) : (
        <TimelineView items={items} urlFor={urlFor} onOpen={setOpenItem} />
      )}

      {openItem && (
        <Lightbox
          item={openItem}
          onClose={() => setOpenItem(null)}
          onDelete={() => deleteMut.mutate(openItem)}
          isDeleting={deleteMut.isPending}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// View toggle
// ---------------------------------------------------------------------------

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full bg-paper-mist text-xs">
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={[
          'px-3 py-1.5 transition-colors',
          view === 'grid' ? 'bg-ink-700 text-paper-rice' : 'text-ink-600 hover:text-ink-900',
        ].join(' ')}
        aria-pressed={view === 'grid'}
      >
        九宫格
      </button>
      <button
        type="button"
        onClick={() => onChange('timeline')}
        className={[
          'px-3 py-1.5 transition-colors',
          view === 'timeline' ? 'bg-ink-700 text-paper-rice' : 'text-ink-600 hover:text-ink-900',
        ].join(' ')}
        aria-pressed={view === 'timeline'}
      >
        画卷
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grid view
// ---------------------------------------------------------------------------

function GridView({
  items,
  urlFor,
  onOpen,
}: {
  items: MediaItem[];
  urlFor: (i: MediaItem) => string | null;
  onOpen: (i: MediaItem) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {items.map((item) => (
        <Thumb
          key={item.id}
          url={urlFor(item)}
          onClick={() => onOpen(item)}
          variant="square"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline view — brushy vertical spine, alternating sides, month dividers
// ---------------------------------------------------------------------------

function TimelineView({
  items,
  urlFor,
  onOpen,
}: {
  items: MediaItem[];
  urlFor: (i: MediaItem) => string | null;
  onOpen: (i: MediaItem) => void;
}) {
  const groups = useMemo(() => groupByMonth(items), [items]);

  return (
    <div className="relative pb-6">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2">
        <BrushLine orientation="v" length="100%" wobble color="var(--color-ink-wash-3)" />
      </div>

      {groups.map((g) => (
        <div key={g.label} className="mb-6">
          <MonthDivider label={g.label} />
          <ul className="flex flex-col gap-6 pt-3">
            {g.items.map((item, idx) => (
              <TimelineRow
                key={item.id}
                item={item}
                url={urlFor(item)}
                side={idx % 2 === 0 ? 'left' : 'right'}
                onOpen={() => onOpen(item)}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function MonthDivider({ label }: { label: string }) {
  return (
    <div className="relative flex items-center justify-center gap-3">
      <div className="w-12 opacity-60">
        <BrushLine orientation="h" length="100%" />
      </div>
      <span className="bg-paper-rice px-2 font-brush text-xl text-ink-700">{label}</span>
      <div className="w-12 opacity-60">
        <BrushLine orientation="h" length="100%" />
      </div>
    </div>
  );
}

function TimelineRow({
  item,
  url,
  side,
  onOpen,
}: {
  item: MediaItem;
  url: string | null;
  side: 'left' | 'right';
  onOpen: () => void;
}) {
  const isLeft = side === 'left';
  return (
    <li className={`flex items-center gap-3 ${isLeft ? '' : 'flex-row-reverse'}`}>
      <BleedFrame intensity="soft" radius={9999} className="h-24 w-24 shrink-0 rounded-full">
        <Thumb url={url} onClick={onOpen} variant="circle" />
      </BleedFrame>
      <div className={`flex-1 ${isLeft ? 'text-left' : 'text-right'}`}>
        {item.description && (
          <p className="font-serif text-sm leading-relaxed text-ink-700 line-clamp-2">
            {item.description}
          </p>
        )}
        <p className="mt-0.5 text-xs text-ink-500">
          {new Date(item.taken_at).toLocaleDateString('zh-CN', {
            month: 'numeric',
            day: 'numeric',
          })}
        </p>
      </div>
    </li>
  );
}

function groupByMonth(items: MediaItem[]): { label: string; items: MediaItem[] }[] {
  const map = new Map<string, MediaItem[]>();
  for (const item of items) {
    const d = new Date(item.taken_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  const sorted = Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  return sorted.map(([key, items]) => {
    const [year, month] = key.split('-');
    const monthIdx = Number(month) - 1;
    const label = `${MONTH_NAMES_CN[monthIdx]} ${year}`;
    return { label, items };
  });
}

const MONTH_NAMES_CN = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];

// ---------------------------------------------------------------------------
// Thumb (square or circle)
// ---------------------------------------------------------------------------

function Thumb({
  url,
  onClick,
  variant = 'square',
}: {
  url: string | null;
  onClick: () => void;
  variant?: 'square' | 'circle';
}) {
  const shape = variant === 'circle' ? 'rounded-full h-24 w-24' : 'rounded-md aspect-square';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`overflow-hidden bg-paper-mist transition-opacity hover:opacity-90 ${shape}`}
    >
      {url ? (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-ink-300">…</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

interface LightboxProps {
  item: MediaItem;
  onClose: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function Lightbox({ item, onClose, onDelete, isDeleting }: LightboxProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useScrollLock();
  const urlQuery = useQuery({
    queryKey: ['memories-full-url', item.storage_path],
    queryFn: () => getSignedUrl(item.storage_path),
    staleTime: 50 * 60 * 1000,
  });
  const url = urlQuery.data ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink-900/90 backdrop-blur-sm"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      onClick={onClose}
    >
      <header className="flex items-center justify-between px-6 py-4 text-paper-rice">
        <button onClick={onClose} className="text-2xl leading-none" aria-label="关闭">×</button>
        <span className="font-serif text-xs text-paper-rice/70">
          {new Date(item.taken_at).toLocaleDateString()}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirmingDelete) onDelete();
            else setConfirmingDelete(true);
          }}
          disabled={isDeleting}
          className="text-sm text-paper-rice/80 hover:text-vermillion-300 disabled:opacity-50"
        >
          {isDeleting ? '…' : confirmingDelete ? '确认删除？' : '删除'}
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
        {url ? (
          <img
            src={url}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
            decoding="async"
          />
        ) : (
          <span className="text-paper-rice/60">…</span>
        )}
      </div>

      {item.description && (
        <p
          className="px-6 py-4 text-center font-serif text-sm leading-relaxed text-paper-rice/80"
          onClick={(e) => e.stopPropagation()}
        >
          {item.description}
        </p>
      )}
    </div>
  );
}
