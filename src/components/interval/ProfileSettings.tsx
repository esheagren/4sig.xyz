import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { normalizeIcon, normalizeColor, normalizeStyle, type Player } from '../../../shared/player-profile';
import { PersonalityPicker } from './PlayerIdentity';
import { useRulerSound } from './useRulerSound';
export function ProfileSettings() {
  const { user, refreshUser } = useAuth();
  const [soundOn, toggleSound] = useRulerSound();
  return <section className="profile-settings">
    <div className="menu-setting">
      <div><span>Sound</span><p>Soft ruler ticks and touch feedback.</p></div>
      <button className="menu-switch" type="button" role="switch" aria-checked={soundOn} aria-label="Sound and vibration" onClick={toggleSound}>
        <span aria-hidden="true">{soundOn ? 'On' : 'Off'}</span><i aria-hidden="true" />
      </button>
    </div>
    {user && !user.isAnonymous && <AppearanceSettings key={user.id} initial={{
      username: user.displayName, icon: normalizeIcon(user.avatarIcon), color: normalizeColor(user.avatarColor),
      style: normalizeStyle(user.scorecardStyle, user.avatarIcon),
    }} onSaved={refreshUser} />}
  </section>;
}

function AppearanceSettings({ initial, onSaved }: { initial: Player; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState(initial);
  const [pending, setPending] = useState(false), [message, setMessage] = useState('');
  return <details className="appearance-settings">
    <summary>Your style & color</summary>
    <form onSubmit={async event => {
      event.preventDefault();
      if (pending) return;
      setPending(true); setMessage('');
      try {
        const response = await fetch('/api/auth/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarIcon: draft.icon, avatarColor: draft.color, scorecardStyle: draft.style }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not save. Try again.');
        await onSaved(); setMessage('Saved.');
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save. Try again.'); }
      finally { setPending(false); }
    }}>
      <PersonalityPicker icon={draft.icon} color={draft.color} style={draft.style} disabled={pending}
        onChange={(icon, color, style) => { setDraft({ ...draft, icon, color, style }); setMessage(''); }} />
      <button className="primary" disabled={pending}>{pending ? 'Saving…' : 'Save style'}</button>
      <p role="status" className="entry-error">{message}</p>
    </form>
  </details>;
}
