import { createBrowserRouter } from 'react-router';
import { AuthGate, GuestOnly } from '@/components/AuthGate';
import { SignIn } from '@/routes/sign-in';
import { SignUp } from '@/routes/sign-up';
import { Pair } from '@/routes/pair';
import { Home } from '@/routes/home';
import { Wishes } from '@/routes/wishes';
import { Moods } from '@/routes/moods';
import { Memories } from '@/routes/memories';
import { Capsules } from '@/routes/capsules';
import { Summary } from '@/routes/summary';
import { AppShell } from '@/components/AppShell';
import { NotFound } from '@/routes/not-found';

export const router = createBrowserRouter([
  {
    Component: GuestOnly,
    children: [
      { path: '/sign-in', Component: SignIn },
      { path: '/sign-up', Component: SignUp },
    ],
  },
  {
    Component: AuthGate,
    children: [
      {
        Component: AppShell,
        children: [
          { path: '/', Component: Home },
          { path: '/pair', Component: Pair },
          { path: '/wishes', Component: Wishes },
          { path: '/moods', Component: Moods },
          { path: '/memories', Component: Memories },
          { path: '/capsules', Component: Capsules },
          { path: '/summary/:yearMonth', Component: Summary },
        ],
      },
    ],
  },
  { path: '*', Component: NotFound },
]);
