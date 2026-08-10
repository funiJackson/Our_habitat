import { useMemo, useState, type FormEvent, type PointerEvent } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Reorder, useDragControls } from 'motion/react';
import {
  createWish,
  deleteWish,
  listWishes,
  reorderWishes,
  setWishStatus,
  wishInputSchema,
  type Wish,
} from '@/lib/wishes';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { InkTextarea } from '@/components/ui/InkTextarea';
import { BrushDot } from '@/components/ink/BrushDot';

const queryKey = ['wishes'] as const;

export function Wishes() {
  const queryClient = useQueryClient();
  const wishesQuery = useQuery({ queryKey, queryFn: listWishes });

  const createMut = useMutation({
    mutationFn: createWish,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'todo' | 'done' }) =>
      setWishStatus(id, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const deleteMut = useMutation({
    mutationFn: deleteWish,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const reorderMut = useMutation({
    mutationFn: reorderWishes,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { todo, done } = useMemo(() => {
    const list = wishesQuery.data ?? [];
    return {
      todo: list.filter((w) => w.status === 'todo'),
      done: list.filter((w) => w.status === 'done'),
    };
  }, [wishesQuery.data]);

  // Local mirror of the todo list — Reorder mutates it during drag for instant
  // visual feedback. Re-syncs at *render time* when the server set of ids
  // changes, avoiding the empty-state flash that useEffect-based sync caused.
  const todoIdsKey = useMemo(() => todo.map((w) => w.id).join('|'), [todo]);
  const [localTodo, setLocalTodo] = useState<Wish[]>(todo);
  const [syncedIdsKey, setSyncedIdsKey] = useState<string>(todoIdsKey);
  if (syncedIdsKey !== todoIdsKey) {
    setSyncedIdsKey(todoIdsKey);
    setLocalTodo(todo);
  }

  function commitOrder() {
    if (localTodo.length < 2) return;
    reorderMut.mutate(localTodo.map((w) => w.id));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg(null);
    const parsed = wishInputSchema.safeParse({
      title,
      note: note.trim() ? note : undefined,
    });
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message ?? '输入有误');
      return;
    }
    try {
      await createMut.mutateAsync(parsed.data);
      setTitle('');
      setNote('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '添加失败');
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link to="/" className="text-sm text-ink-500 hover:text-ink-700">←</Link>
        <h1 className="font-brush text-4xl leading-none text-ink-800">笺</h1>
        <span className="text-sm text-ink-300">{todo.length}/{todo.length + done.length}</span>
      </header>

      <form onSubmit={onSubmit} className="mb-10 flex flex-col gap-4">
        <Input
          name="title"
          placeholder="想要一起做的事 / 主题月份想要做的事"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
        <InkTextarea
          name="note"
          placeholder="备注（可选 / 可写下想完成的日期）"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          rows={2}
        />
        {errorMsg && <p className="text-sm text-vermillion-500">{errorMsg}</p>}
        <Button type="submit" isLoading={createMut.isPending} disabled={!title.trim()}>
          添加愿望
        </Button>
      </form>

      {wishesQuery.isLoading ? (
        <p className="text-center text-ink-400 animate-pulse">…</p>
      ) : wishesQuery.error ? (
        <p className="text-center text-sm text-vermillion-500">
          {wishesQuery.error instanceof Error ? wishesQuery.error.message : '加载失败'}
        </p>
      ) : (
        <>
          <TodoSection
            wishes={localTodo}
            onReorder={setLocalTodo}
            onCommit={commitOrder}
            onToggle={(w) => toggleMut.mutate({ id: w.id, next: 'done' })}
            onDelete={(w) => deleteMut.mutate(w.id)}
          />
          {done.length > 0 && (
            <DoneSection
              wishes={done}
              onToggle={(w) => toggleMut.mutate({ id: w.id, next: 'todo' })}
              onDelete={(w) => deleteMut.mutate(w.id)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Todo section — drag-to-reorder via framer-motion Reorder + a per-row handle
// ---------------------------------------------------------------------------

interface TodoSectionProps {
  wishes: Wish[];
  onReorder: (next: Wish[]) => void;
  onCommit: () => void;
  onToggle: (w: Wish) => void;
  onDelete: (w: Wish) => void;
}

function TodoSection({ wishes, onReorder, onCommit, onToggle, onDelete }: TodoSectionProps) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 font-brush text-xl text-ink-700">想做</h2>
      {wishes.length === 0 ? (
        <p className="font-serif text-sm text-ink-400">还没有愿望，先许一个吧</p>
      ) : (
        <Reorder.Group
          axis="y"
          values={wishes}
          onReorder={onReorder}
          as="ul"
          className="flex flex-col"
        >
          {wishes.map((w) => (
            <DraggableWishRow
              key={w.id}
              wish={w}
              onCommit={onCommit}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}
        </Reorder.Group>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Done section — no drag, simple list
// ---------------------------------------------------------------------------

interface DoneSectionProps {
  wishes: Wish[];
  onToggle: (w: Wish) => void;
  onDelete: (w: Wish) => void;
}

function DoneSection({ wishes, onToggle, onDelete }: DoneSectionProps) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 font-brush text-xl text-ink-700">已完成</h2>
      <ul className="flex flex-col">
        {wishes.map((w) => (
          <WishRow
            key={w.id}
            wish={w}
            muted
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Row variants
// ---------------------------------------------------------------------------

interface RowProps {
  wish: Wish;
  muted?: boolean;
  onToggle: (w: Wish) => void;
  onDelete: (w: Wish) => void;
}

interface DraggableRowProps extends RowProps {
  onCommit: () => void;
}

/** Static row used for the done list. */
function WishRow({ wish, muted, onToggle, onDelete }: RowProps) {
  const isDone = wish.status === 'done';
  return (
    <li className="flex items-start gap-3 border-b border-[var(--color-ink-wash-2)] py-3.5 last:border-b-0">
      <ToggleButton wish={wish} isDone={isDone} onToggle={onToggle} />
      <RowBody wish={wish} dim={isDone || !!muted} />
      <DeleteButton wish={wish} onDelete={onDelete} />
    </li>
  );
}

/** Reorder-aware row with a drag handle on the right edge. */
function DraggableWishRow({
  wish,
  onCommit,
  onToggle,
  onDelete,
}: DraggableRowProps) {
  const controls = useDragControls();
  const isDone = wish.status === 'done';

  function startDrag(e: PointerEvent<HTMLButtonElement>) {
    controls.start(e);
  }

  return (
    <Reorder.Item
      value={wish}
      as="li"
      dragListener={false}
      dragControls={controls}
      onDragEnd={onCommit}
      className="flex items-start gap-3 border-b border-[var(--color-ink-wash-2)] bg-paper-rice py-3.5 last:border-b-0"
      whileDrag={{ scale: 1.02, boxShadow: '0 6px 20px rgba(42,38,34,0.10)' }}
    >
      <ToggleButton wish={wish} isDone={isDone} onToggle={onToggle} />
      <RowBody wish={wish} dim={isDone} />
      <button
        type="button"
        onPointerDown={startDrag}
        aria-label="拖动排序"
        className="touch-none cursor-grab select-none px-1.5 py-1 text-base leading-none text-ink-300 transition-colors hover:text-ink-600 active:cursor-grabbing"
      >
        ≡
      </button>
      <DeleteButton wish={wish} onDelete={onDelete} />
    </Reorder.Item>
  );
}

function ToggleButton({
  wish,
  isDone,
  onToggle,
}: {
  wish: Wish;
  isDone: boolean;
  onToggle: (w: Wish) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(wish)}
      aria-label={isDone ? '标记为未完成' : '标记为完成'}
      className="mt-0.5 transition-transform active:scale-90"
    >
      <BrushDot done={isDone} size={22} />
    </button>
  );
}

function DeleteButton({
  wish,
  onDelete,
}: {
  wish: Wish;
  onDelete: (w: Wish) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onDelete(wish)}
      aria-label="删除愿望"
      className="px-2 py-1 text-lg leading-none text-ink-300 transition-colors hover:text-vermillion-500"
    >
      ×
    </button>
  );
}

function RowBody({ wish, dim }: { wish: Wish; dim: boolean }) {
  return (
    <div className="flex-1 min-w-0">
      <p
        className={[
          'font-serif text-base leading-snug',
          dim
            ? 'text-[var(--color-ink-wash-4)] line-through decoration-vermillion-500/50'
            : 'text-ink-900',
        ].join(' ')}
      >
        {wish.title}
      </p>
      {wish.note && (
        <p
          className={[
            'mt-1 font-serif text-sm leading-relaxed',
            dim ? 'text-[var(--color-ink-wash-3)]' : 'text-ink-500',
          ].join(' ')}
        >
          {wish.note}
        </p>
      )}
    </div>
  );
}
