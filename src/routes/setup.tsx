/**
 * Friendly first-run screen shown when VITE_SUPABASE_URL / ANON_KEY are missing.
 * Walks Laura through the 4 setup steps without dumping a stack trace at her.
 */
export function Setup() {
  return (
    <div className="mx-auto min-h-screen max-w-md px-6 py-12">
      <header className="mb-8 text-center">
        <h1 className="font-brush text-5xl text-ink-800">栖</h1>
        <p className="mt-2 text-sm text-ink-500">还差一步就能开始啦 ✨</p>
      </header>

      <div className="rounded-3xl bg-blush-50 px-6 py-6">
        <p className="text-sm text-ink-700">
          找不到 Supabase 配置。请按下面步骤创建{' '}
          <code className="rounded bg-cream-200 px-1.5 py-0.5 text-blush-700">.env.local</code>。
        </p>
      </div>

      <ol className="mt-8 flex flex-col gap-6 text-ink-700">
        <Step n={1} title="创建 Supabase 项目">
          <p>
            打开 <a className="text-blush-700 underline" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">supabase.com/dashboard</a> →{' '}
            <strong>New project</strong>。建议 region 选 <em>Singapore</em>。
          </p>
        </Step>

        <Step n={2} title="复制 API 密钥">
          <p>
            项目就绪后进入 <strong>Project Settings → API</strong>，复制 <strong>Project URL</strong>{' '}
            和 <strong>anon public</strong> 那把 key。
          </p>
        </Step>

        <Step n={3} title="创建 .env.local">
          <p>在项目根目录新建 <code className="rounded bg-cream-200 px-1.5 py-0.5">.env.local</code>，写入：</p>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-ink-900 px-4 py-3 text-xs text-cream-50">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...`}
          </pre>
        </Step>

        <Step n={4} title="跑 migration + 重启">
          <p>
            在 Supabase Dashboard → <strong>SQL Editor</strong> 中粘贴并执行{' '}
            <code className="rounded bg-cream-200 px-1.5 py-0.5">supabase/migrations/0001_init.sql</code>，
            然后回到终端按 <kbd className="rounded border border-ink-200 bg-paper px-1.5 py-0.5 text-xs">Ctrl+C</kbd>{' '}
            停掉 dev server，再 <code className="rounded bg-cream-200 px-1.5 py-0.5">npm run dev</code>。
          </p>
        </Step>
      </ol>

      <p className="mt-12 text-center text-xs text-ink-400">
        看到这页说明 Vite 已经启动成功 — 就差这点配置。
      </p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blush-500 font-display text-sm text-paper">
        {n}
      </span>
      <div className="flex-1">
        <p className="font-display text-lg text-ink-900">{title}</p>
        <div className="mt-1 text-sm leading-relaxed text-ink-600">{children}</div>
      </div>
    </li>
  );
}
