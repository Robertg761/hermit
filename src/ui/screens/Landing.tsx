import type { OS } from '../../domain/types';
import { Shellby } from '../mascot/Shellby';
import { OS_LABEL, SHELL_LABEL } from '../os';

type Props = {
  readonly detected: OS;
  readonly available: readonly OS[];
  readonly onPick: (os: OS) => void;
};

const ORDER: readonly OS[] = ['linux', 'mac', 'windows'];

export function Landing({ detected, available, onPick }: Props) {
  return (
    <main className="landing">
      <div className="landing-hero">
        <Shellby mood="smug" size={200} />
        <div>
          <h1 className="wordmark">hermit</h1>
          <p className="pitch">Learn the real command line for your OS, one tiny lesson at a time.</p>
        </div>
      </div>
      <p className="landing-ask">Which computer do you use?</p>
      <div className="os-picker">
        {ORDER.map((os) => {
          const ready = available.includes(os);
          return (
            <button
              key={os}
              type="button"
              className={`os-button os-${os}${os === detected ? ' is-detected' : ''}`}
              disabled={!ready}
              onClick={() => onPick(os)}
              autoFocus={os === detected && ready}
            >
              <span className="os-name">{OS_LABEL[os]}</span>
              <span className="os-shell">{ready ? SHELL_LABEL[os] : 'Coming soon'}</span>
              {os === detected && <span className="os-badge">You're on this</span>}
            </button>
          );
        })}
      </div>
      <p className="small-screen-note">Hermit is best on a desktop, with a real keyboard.</p>
      <p className="fineprint">Nothing you type runs on a real machine. It's all a simulated shell.</p>
    </main>
  );
}
