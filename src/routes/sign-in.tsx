import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { signInWithEmail } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await signInWithEmail(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '登录失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <header className="mb-10 text-center">
        <h1 className="font-brush text-5xl text-ink-800">栖</h1>
        <p className="mt-2 text-sm text-ink-500">属于我们俩的小天地</p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Input
          name="email"
          type="email"
          label="邮箱"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          name="password"
          type="password"
          label="密码"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {errorMsg && <p className="text-sm text-blush-600">{errorMsg}</p>}
        <Button type="submit" size="lg" isLoading={isSubmitting}>
          登录
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-500">
        还没有账号？{' '}
        <Link to="/sign-up" className="font-medium text-blush-700">
          去注册
        </Link>
      </p>
    </div>
  );
}
