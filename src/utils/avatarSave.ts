import { avatarPhotoURL, isAvatarId, type AvatarId } from '../config/avatars';
export interface AvatarAccount {
  uid: string;
  isAnonymous?: boolean;
  providerData?: readonly { photoURL?: string | null }[];
}
/** One confirmed write at a time. No optimistic success or cross-account application. */
export function createAvatarSaveController() {
  let busy = false;
  return {
    async save<T extends AvatarAccount>(id: AvatarId | null, dependencies: {
      account: T | null;
      currentAccount: () => AvatarAccount | null;
      persist: (account: T, photoURL: string | null) => Promise<void>;
      apply: (uid: string, photoURL: string | null) => void;
    }): Promise<{ success: boolean; error?: string }> {
      if (id !== null && !isAvatarId(id)) return { success: false, error: 'Choose an avatar from the collection.' };
      if (busy) return { success: false, error: 'An avatar save is already in progress.' };
      const account = dependencies.account;
      if (!account || account.isAnonymous || dependencies.currentAccount()?.uid !== account.uid) {
        return { success: false, error: 'Sign in to save your avatar.' };
      }
      busy = true;
      try {
        const photoURL = id === null ? account.providerData?.find(p => p.photoURL)?.photoURL || null : avatarPhotoURL(id);
        await dependencies.persist(account, photoURL);
        if (dependencies.currentAccount()?.uid !== account.uid) {
          return { success: false, error: 'Your account changed. Open the avatar picker again.' };
        }
        dependencies.apply(account.uid, photoURL);
        return { success: true };
      } catch {
        return { success: false, error: 'Could not save your avatar. Check your connection and try again.' };
      } finally { busy = false; }
    },
  };
}
