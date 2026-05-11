import { Link } from 'react-router';

export function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-display text-3xl text-blush-700">404</p>
      <p className="text-sm text-ink-500">找不到这个页面</p>
      <Link to="/" className="mt-4 text-sm font-medium text-blush-700">
        回首页
      </Link>
    </div>
  );
}
