import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { signUpWithEmail } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function SignUp() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await signUpWithEmail(email, password, displayName);
      navigate('/', { replace: true });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '注册失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <header className="mb-10 text-center">
        <h1 className="font-brush text-5xl text-ink-800">栖</h1>
        <p className="mt-2 text-sm text-ink-500">创建账号，邀请 TA 加入</p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Input
          name="display_name"
          label="暱称"
          autoComplete="nickname"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
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
          autoComplete="new-password"
          minLength={8}
          hint="至少 8 个字符"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {errorMsg && <p className="text-sm text-blush-600">{errorMsg}</p>}
        <Button type="submit" size="lg" isLoading={isSubmitting}>
          注册
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-500">
        已经有账号？{' '}
        <Link to="/sign-in" className="font-medium text-blush-700">
          去登录
        </Link>
      </p>
    </div>
  );
}
