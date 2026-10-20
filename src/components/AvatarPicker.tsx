import { useState } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AVATAR_CATALOG, avatarIdFromPhotoURL, avatarPhotoURL, type AvatarId } from '../config/avatars';
import { UserAvatar } from './ui/UserAvatar';
import { ActionButton } from './ui/ActionButton';
/** Inline picker: the existing parent overlay owns focus/scroll. Selection is only a draft. */
export function AvatarPicker({ onDone }: { onDone?: () => void }) {
  const { user, profile, accountPhotoURL, updateAvatar } = useAuth();
  const [selection, setSelection] = useState<AvatarId | null>(avatarIdFromPhotoURL(profile?.photoURL));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const name = profile?.displayName || user?.displayName || 'User';
  const signedIn = Boolean(user && !user.isAnonymous);
  const selectedName = AVATAR_CATALOG.find(a => a.id === selection)?.name || 'Account photo';
  const save = async () => {
    if (saving) return;
    setSaving(true); setError(null); setSaved(false);
    const result = await updateAvatar(selection);
    setSaving(false);
    if (result.success) { setSaved(true); onDone?.(); }
    else setError(result.error || 'Could not save your avatar. Try again.');
  };
  return <section className="avatar-picker" aria-label="Choose your avatar" aria-busy={saving}>
    <div className="avatar-picker-preview"><UserAvatar photoURL={selection ? avatarPhotoURL(selection) : accountPhotoURL} name={name} size={88} decorative />
      <div><h4>Make it yours</h4><p>{selectedName}</p><small>Choose a character or keep your account photo.</small></div>
    </div>
    <fieldset disabled={saving || !signedIn} className="avatar-picker-options"><legend className="sr-only">Profile avatar</legend>
      <button type="button" className={`avatar-account-option ${selection === null ? 'is-selected' : ''}`} aria-pressed={selection === null} onClick={() => { setSelection(null); setSaved(false); setError(null); }}>
        <UserAvatar photoURL={accountPhotoURL} name={name} size={36} decorative /><span>Account photo</span>{selection === null && <Check size={16} aria-hidden />}
      </button>
      <div className="avatar-picker-grid">{AVATAR_CATALOG.map(a => <button key={a.id} type="button"
        aria-label={`${a.name} avatar`} aria-pressed={selection === a.id} className={`avatar-choice ${selection === a.id ? 'is-selected' : ''}`}
        onClick={() => { setSelection(a.id); setSaved(false); setError(null); }}>
        <UserAvatar photoURL={avatarPhotoURL(a.id)} name={a.name} size={64} decorative /><span className="avatar-choice-name">{a.name}</span>
        {selection === a.id && <span className="avatar-choice-check"><Check size={12} aria-hidden /></span>}
      </button>)}</div>
    </fieldset>
    {!signedIn && <p className="avatar-picker-message">Sign in to choose and save an avatar.</p>}
    {error && <p role="alert" className="avatar-picker-error">{error}</p>}
    <div className="avatar-picker-footer"><span role="status">{saving ? 'Saving your avatar…' : saved ? 'Avatar saved' : 'Updates your profile and header.'}</span>
      <ActionButton type="button" variant="primary" isLoading={saving} disabled={!signedIn || saved} loadingText="Saving…" onClick={save}>Save avatar</ActionButton>
    </div>
  </section>;
}
