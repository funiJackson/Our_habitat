import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router';
import { fetchMyCouple, generateInviteCode, redeemInviteCode } from '@/lib/couple';
import { signOut } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Mode = 'choose' | 'generate' | 'redeem';

export function Pair() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('choose');
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const coupleQuery = useQuery({
    queryKey: ['my-couple'],
    queryFn: fetchMyCouple,
  });

  const generateMut = useMutation({
    mutationFn: generateInviteCode,
  });

  const redeemMut = useMutation({
    mutationFn: redeemInviteCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-couple'] });
      navigate('/', { replace: true });
    },
  });

  async function onRedeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg(null);
    try {
      await redeemMut.mutateAsync(code);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '邀请码无效');
    }
  }

  if (coupleQuery.data?.partner_id) {
    return <Navigate to="/" replace />;
  }

  if (mode === 'choose') {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
        <header className="text-center">
          <h2 className="font-display text-3xl text-blush-700">和 TA 配对</h2>
          <p className="mt-2 text-sm text-ink-500">邀请你的另一半，开启专属空间</p>
        </header>
        <Button size="lg" onClick={() => setMode('generate')}>
          生成邀请码
        </Button>
        <Button size="lg" variant="soft" onClick={() => setMode('redeem')}>
          我有邀请码
        </Button>
        <button
          type="button"
          onClick={signOut}
          className="mt-4 text-center text-sm text-ink-400 hover:text-ink-600"
        >
          换个账号登录
        </button>
      </div>
    );
  }

  if (mode === 'generate') {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
        <header className="text-center">
          <h2 className="font-display text-3xl text-blush-700">邀请码</h2>
          <p className="mt-2 text-sm text-ink-500">把这串字符发给 TA，24 小时内有效</p>
        </header>

        {generateMut.data ? (
          <div className="rounded-3xl bg-blush-50 px-8 py-10 text-center">
            <p className="font-display text-5xl tracking-widest text-blush-700">
              {generateMut.data.code}
            </p>
            <p className="mt-3 text-xs text-ink-400">
              过期：{new Date(generateMut.data.expires_at).toLocaleString()}
            </p>
          </div>
        ) : (
          <Button
            size="lg"
            onClick={() => generateMut.mutate()}
            isLoading={generateMut.isPending}
          >
            生成
          </Button>
        )}

        {generateMut.error && (
          <p className="text-center text-sm text-blush-600">
            {generateMut.error instanceof Error ? generateMut.error.message : '生成失败'}
          </p>
        )}

        <Button variant="ghost" onClick={() => setMode('choose')}>
          返回
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <header className="text-center">
        <h2 className="font-display text-3xl text-blush-700">输入邀请码</h2>
      </header>

      <form onSubmit={onRedeem} className="flex flex-col gap-5">
        <Input
          name="code"
          label="邀请码"
          autoComplete="one-time-code"
          inputMode="text"
          autoCapitalize="characters"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="text-center font-display text-2xl tracking-widest"
        />
        {errorMsg && <p className="text-center text-sm text-blush-600">{errorMsg}</p>}
        <Button type="submit" size="lg" isLoading={redeemMut.isPending}>
          配对
        </Button>
      </form>

      <Button variant="ghost" onClick={() => setMode('choose')}>
        返回
      </Button>
    </div>
  );
}
