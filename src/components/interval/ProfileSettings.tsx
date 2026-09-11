import { useId } from 'react';
import { useRulerSound } from './useRulerSound';
export function ProfileSettings() {
  const [soundOn, toggleSound] = useRulerSound();
  const title = useId();
  return <section className="profile-settings" aria-labelledby={title}>
    <h3 id={title}>Settings</h3>
    <div className="menu-setting">
      <div><span>Sound</span><p>Soft ruler ticks and touch feedback.</p></div>
      <button className="menu-switch" type="button" role="switch" aria-checked={soundOn} aria-label="Sound and vibration" onClick={toggleSound}>
        <span aria-hidden="true">{soundOn ? 'On' : 'Off'}</span><i aria-hidden="true" />
      </button>
    </div>
    <details><summary>How to play</summary>
      <p>Enter your best estimate, then move the brackets until you’re 95% sure the answer lies between them.</p>
      <p>Tap either number to edit it. Hold a bracket at the edge to widen the ruler. Hold the round submit button for half a second to give your answer.</p>
      <p>You can use your computer keyboard or the on-screen keys. Tap the calculator icon to work out a number.</p>
      <p>If your range misses the answer, you earn zero points. A narrower range that contains the answer earns more, up to 10,000 points for an exact answer.</p>
      <p>Begin with eight calibration questions. Then everyone gets four new questions each day. Your first daily attempt counts; replays are practice.</p>
    </details>
    <details><summary>About 4σ</summary>
      <p>A daily game about the slow-changing numbers that shape our world. Make an estimate, consider how sure you are, and explore the answer and its source.</p>
    </details>
  </section>;
}
