import { useQuery } from '@tanstack/react-query';
import { getMoodSelfieSignedUrl, selfiePath } from '@/lib/mood-selfies';

interface Props {
  coupleId: string;
  userId: string;
  date: string;
  className?: string;
}

/**
 * Renders a stored mood selfie by deriving the deterministic storage path
 * from (coupleId, userId, date) and resolving a 1-hour signed URL.
 */
export function SelfieAvatar({ coupleId, userId, date, className = '' }: Props) {
  const path = selfiePath(coupleId, userId, date);
  const urlQuery = useQuery({
    queryKey: ['mood-selfie-url', path],
    queryFn: () => getMoodSelfieSignedUrl(path),
    staleTime: 50 * 60 * 1000,
    retry: false,
  });

  if (urlQuery.error || !urlQuery.data) {
    return (
      <span
        className={`flex items-center justify-center bg-paper-mist text-ink-300 ${className}`}
      >
        …
      </span>
    );
  }
  return (
    <img
      src={urlQuery.data}
      alt=""
      className={`object-cover ${className}`}
      loading="lazy"
    />
  );
}
