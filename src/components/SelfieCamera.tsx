import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useScrollLock } from '@/lib/hooks';

interface Props {
  /** Fired once with the captured frame as a JPEG File. */
  onCapture: (file: File) => void;
  onClose: () => void;
  /** Called instead of the camera when getUserMedia isn't usable (no permission,
   *  no HTTPS, unsupported browser) — the caller falls back to a file picker. */
  onFallback: () => void;
}

/**
 * In-app selfie camera.
 *
 * We deliberately do NOT use `<input capture>` here: that hands off to the
 * system camera app, which applies *its own* remembered flash setting — on iOS
 * and most Android camera apps that means auto-flash, so a night-time check-in
 * fires the (screen or LED) flash in your face. A getUserMedia stream never
 * fires a flash: the torch is a separate opt-in constraint we never set, and we
 * explicitly pin it off below for the handful of devices that keep torch state
 * across sessions.
 */
export function SelfieCamera({ onCapture, onClose, onFallback }: Props) {
  useScrollLock();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setReady(false);
      setErrorMsg(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        onFallback();
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        // Belt and braces: the torch defaults to off, but some Android devices
        // remember it per-camera. Only try when the track advertises support —
        // applyConstraints throws OverconstrainedError otherwise.
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        if (caps?.torch) {
          try {
            await track.applyConstraints({
              advanced: [{ torch: false } as unknown as MediaTrackConstraintSet],
            });
          } catch {
            // Non-fatal — the stream is still usable without touching the torch.
          }
        }

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
          setReady(true);
        }
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setErrorMsg('没有相机权限，去系统设置里打开，或从相册选一张');
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setErrorMsg('找不到可用的摄像头');
        } else {
          setErrorMsg('相机打不开，从相册选一张吧');
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing, onFallback]);

  const shoot = useCallback(() => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Front camera preview is mirrored, so mirror the saved frame too — what
    // you see while posing is what gets stored.
    if (facing === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErrorMsg('拍照失败，再试一次');
          return;
        }
        onCapture(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  }, [facing, onCapture, ready]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-ink-900"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div
        className="flex items-center justify-between px-6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="text-2xl leading-none text-paper-rice/70 hover:text-paper-rice"
          aria-label="关闭"
        >
          ×
        </button>
        <span aria-hidden />
        <button
          type="button"
          onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
          className="font-serif text-sm text-paper-rice/70 hover:text-paper-rice"
          aria-label="切换摄像头"
        >
          翻转
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
          style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
        />
        {!ready && !errorMsg && (
          <p className="absolute animate-pulse font-serif text-sm text-paper-rice/60">…</p>
        )}
        {errorMsg && (
          <div className="absolute inset-x-8 flex flex-col items-center gap-4 text-center">
            <p className="font-serif text-sm text-paper-rice/80">{errorMsg}</p>
            <button
              type="button"
              onClick={onFallback}
              className="rounded-full border border-paper-rice/40 px-5 py-2 font-serif text-sm text-paper-rice"
            >
              从相册选择
            </button>
          </div>
        )}
      </div>

      <div
        className="flex items-center justify-center"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)', paddingTop: '1.5rem' }}
      >
        <button
          type="button"
          onClick={shoot}
          disabled={!ready}
          aria-label="拍照"
          className="rounded-full border-4 border-paper-rice/80 p-1 disabled:opacity-40"
          style={{ height: '4.5rem', width: '4.5rem' }}
        >
          <span className="block h-full w-full rounded-full bg-paper-rice" />
        </button>
      </div>
    </motion.div>
  );
}
