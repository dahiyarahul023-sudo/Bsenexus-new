/** Original transparent character assets. Persist a canonical 512px URL in Firebase Auth. */
export const AVATAR_CATALOG = [
  { id: 'sprout', name: 'Sprout' }, { id: 'bunny', name: 'Sunny' },
  { id: 'fox', name: 'Ember' }, { id: 'bear', name: 'Mochi' },
  { id: 'axolotl', name: 'Bubble' }, { id: 'owl', name: 'Sage' },
  { id: 'penguin', name: 'Tide' }, { id: 'frog', name: 'Clover' },
  { id: 'dragon', name: 'Nova' }, { id: 'cat', name: 'Luna' },
  { id: 'sheep', name: 'Cloud' }, { id: 'monster', name: 'Pip' },
] as const;
export type AvatarId = typeof AVATAR_CATALOG[number]['id'];
export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && AVATAR_CATALOG.some(a => a.id === value);
}
export function avatarAssetPath(id: AvatarId, size: 96 | 256 | 512 = 512): string {
  return `/avatars/v1/${id}-${size}.webp`;
}
export function avatarPhotoURL(id: AvatarId): string { return `https://bsenexus.in${avatarAssetPath(id)}`; }
/** Exact catalogue paths only; remote lookalikes never become trusted app avatars. */
export function avatarIdFromPhotoURL(value?: string | null): AvatarId | null {
  if (!value) return null;
  try {
    const url = new URL(value, 'https://bsenexus.in');
    if (url.origin !== 'https://bsenexus.in' || url.search || url.hash) return null;
    return AVATAR_CATALOG.find(a => url.pathname === avatarAssetPath(a.id))?.id ?? null;
  } catch { return null; }
}
