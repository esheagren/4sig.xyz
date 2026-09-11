import { useRulerSound } from './useRulerSound';
export function ProfileSettings() {
  const [soundOn, toggleSound] = useRulerSound();
  return <section className="profile-settings">
    <div className="menu-setting">
      <div><span>Sound</span><p>Soft ruler ticks and touch feedback.</p></div>
      <button className="menu-switch" type="button" role="switch" aria-checked={soundOn} aria-label="Sound and vibration" onClick={toggleSound}>
        <span aria-hidden="true">{soundOn ? 'On' : 'Off'}</span><i aria-hidden="true" />
      </button>
    </div>
  </section>;
}
