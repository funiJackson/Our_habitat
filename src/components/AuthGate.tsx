import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { bootstrapSession, useSessionStore } from '@/stores/session';

let bootstrapped = false;

/** Wraps protected routes. Redirects to /sign-in when there's no session. */
export function AuthGate() {
  const location = useLocation();
  const { session, isLoading } = useSessionStore();

  useEffect(() => {
    if (!bootstrapped) {
      bootstrapped = true;
      bootstrapSession();
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-ink-400">
        <span className="animate-pulse">…</span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

/** Inverse of AuthGate — redirects already-signed-in users away from auth pages. */
export function GuestOnly() {
  const { session, isLoading } = useSessionStore();

  useEffect(() => {
    if (!bootstrapped) {
      bootstrapped = true;
      bootstrapSession();
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-ink-400">
        <span className="animate-pulse">…</span>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
