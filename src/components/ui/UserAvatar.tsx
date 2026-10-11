import { useState } from 'react';
import { avatarAssetPath, avatarIdFromPhotoURL } from '../../config/avatars';
/** Shared rendering for account photos, original characters and safe initials fallback. */
export function UserAvatar({ photoURL, name = 'User', size = 40, className = '', decorative = false }: {
  photoURL?: string | null; name?: string; size?: number; className?: string; decorative?: boolean;
}) {
  const id = avatarIdFromPhotoURL(photoURL);
  const [failedURL, setFailedURL] = useState<string | null>(null);
  const showImage = Boolean(photoURL && failedURL !== photoURL);
  return <span className={`user-avatar ${id ? 'user-avatar-character' : 'user-avatar-photo'} ${className}`}
    style={{ width: size, height: size }} aria-hidden={decorative || undefined}>
    {showImage ? <img src={id ? avatarAssetPath(id, size <= 48 ? 96 : size <= 128 ? 256 : 512) : photoURL!}
      srcSet={id ? `${avatarAssetPath(id, 96)} 96w, ${avatarAssetPath(id, 256)} 256w, ${avatarAssetPath(id)} 512w` : undefined}
      sizes={id ? `${size}px` : undefined} width={size} height={size} alt={decorative ? '' : `Avatar for ${name}`}
      decoding="async" referrerPolicy="no-referrer" onError={() => setFailedURL(photoURL || null)} />
      : <span className="user-avatar-initial" aria-label={decorative ? undefined : `Avatar for ${name}`}>{name.trim().charAt(0).toUpperCase() || 'U'}</span>}
  </span>;
}
