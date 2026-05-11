# 栖 · Our Habitat

A private, two-person PWA. Wishes, moods, memories, and time capsules — for the two of us, only.

> 一个属于两个人的小天地。许愿、心情、回忆、时光胶囊。
> 用水墨 + 动漫的视觉语言写成。

---

## ✦ Features

| 模块 | 字 | 说明 |
|------|------|------|
| 愿望清单 | **笺** | 共同心愿，可拖动排序，月底自动入总结 |
| 每日心情 | **绪** | 12 种水墨表情 + 自拍打卡，整月心情潮汐可视化 |
| 共同回忆 | **拾** | 照片上传，自动生成缩略图，九宫格 / 画卷两种浏览模式 |
| 时光胶囊 | **缄** | 给未来的信。红线封印 + 待启倒计时 + 解封画卷展开仪式 |
| 月度总结 | **封** | 月底 3 天自动出现，整月数字小诗 + 心情潮汐 + 照片墙 + 胶囊往来 |

主题封面可从相册上传；每月可设主题字（"五月 · 向阳"）。

---

## ✦ Stack

- **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS 4**（自定义水墨调色 + 朱砂 + 五调墨色 + 宣纸纹理 SVG）
- **Supabase** 托管（Postgres + Storage + Auth）
- **Zustand**（session 状态）
- **React Query**（数据缓存）
- **framer-motion** v12（拖拽排序、解封仪式、月度总结卷轴）
- **browser-image-compression**（照片 / 自拍上传前压缩）
- **date-fns**（中文相对时间）
- **vite-plugin-pwa**（manifest + service worker）

---

## ✦ Local development

```bash
# 1. install deps
npm install

# 2. supabase env
cp .env.local.example .env.local
# 填入 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY

# 3. run
npm run dev
```

如果 `.env.local` 缺失或值不对，启动时会显示一个友好的 setup 引导页（而不是炸 stack trace）。

### Useful scripts

```bash
npm run dev          # vite dev server
npm run typecheck    # tsc --noEmit
npm run build        # tsc -b && vite build
```

---

## ✦ Supabase setup

1. 在 Supabase Dashboard 建项目。
2. 把 `supabase/migrations/*.sql` 按编号顺序在 SQL Editor 跑一遍：
   - `0001_core.sql` — 核心表 / RLS / 配对 RPC
   - `0002_lock_down_functions.sql` — SECURITY DEFINER 函数权限收紧
   - `0003_storage.sql` — `memories` + `capsules` 两个 bucket
   - `0004_storage_update_policies.sql` — Storage UPDATE policies（允许 upsert 覆盖）
   - `0005_wishes_sort_order.sql` — 愿望排序字段 + 批量更新 RPC
3. 在 Auth → Sign In / Providers 打开 **Email provider** 并关掉 **Confirm email**（个人 app 不需要邮件验证流程）。
4. Storage 服务首次需要访问一次 Dashboard → Storage 才会初始化（否则 0003 不会成功）。

---

## ✦ Project shape

```
src/
├── components/
│   ├── ink/              # 水墨原件 — BleedFrame、BrushDot、RedString、LetterEnvelope、各种 icon
│   ├── ui/               # Button、Input、InkTextarea
│   ├── AppShell.tsx      # 已登录 shell（不含动画包装，简单稳定）
│   ├── HeroIllustration.tsx
│   ├── SelfieAvatar.tsx
│   └── CapsuleReveal.tsx # 解封仪式全屏 overlay
├── lib/
│   ├── supabase.ts       # client
│   ├── auth.ts couple.ts wishes.ts moods.ts memories.ts time-capsules.ts mood-selfies.ts themes.ts summaries.ts
│   ├── dates.ts          # 月份名 / boundaries / 末三天 gating
│   ├── storage.ts        # batch signed URL
│   └── hooks.ts          # useScrollLock / useNowTick
├── routes/
│   ├── home.tsx          # 月主题封面 + 今日心愿 + 四方块导航
│   ├── wishes.tsx        # 拖拽排序
│   ├── moods.tsx         # 表情 + 自拍 + 整周打卡
│   ├── memories.tsx      # grid / timeline 切换
│   ├── capsules.tsx      # 列表 + 写胶囊
│   ├── summary.tsx       # 月度总结卷轴
│   ├── sign-in.tsx sign-up.tsx pair.tsx setup.tsx not-found.tsx
├── stores/session.ts
├── theme/tokens.ts       # CSS var 镜像 + framer-motion 预设
└── index.css             # @theme 块 + 宣纸纹理 + 滚动锁定
supabase/migrations/      # SQL — 单一真理源
docs/solutions/           # 解过的坑（pgcrypto 404、storage RLS 等）按 frontmatter 索引
CLAUDE.md                 # 给 AI 编程助手的项目说明
```

---

## ✦ Design system

整套水墨视觉建在四个 token 维度上：

- **色彩**：`paper-rice / paper-mist / paper-edge`（三层宣纸）+ `ink-wash-1..5`（五调墨色）+ `vermillion-300/500/700`（朱砂）
- **字体**：`font-brush` (Ma Shan Zheng 毛笔) + `font-serif` (Noto Serif SC 衬线) + `font-sans` (Inter UI)
- **滤镜**：`<InkFilters />` 全局挂载一份 SVG `feTurbulence + feDisplacementMap` 共享，所有墨笔原件引用
- **动画**：`inkMotion.bleedIn / strokeDraw / unfurl / pageFade` 几套 framer-motion 预设

---

## ✦ Privacy / scope

- 仅供两人使用，无注册推广路径
- 所有数据都通过 Supabase RLS 按 `couple_id` 严格隔离
- 时光胶囊在解锁前服务器端就拒读（不只是前端隐藏）
- 不收集任何分析数据；不对外网公开任何信息

---

详细工程注记见 [`CLAUDE.md`](./CLAUDE.md)；过往踩过的坑见 [`docs/solutions/`](./docs/solutions/)。

License: [MIT](./LICENSE).
