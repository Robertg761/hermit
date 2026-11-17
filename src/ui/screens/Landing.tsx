import type { OS } from '../../domain/types';
import { Herme } from '../mascot/Herme';
import { OS_LABEL, SHELL_LABEL } from '../os';
import { ThreeShells } from '../components/ThreeShells';

type Props = {
  readonly detected: OS;
  readonly current: OS | null;
  readonly available: readonly OS[];
  readonly onPick: (os: OS) => void;
};

const ORDER: readonly OS[] = ['linux', 'mac', 'windows'];

export function Landing({ detected, current, available, onPick }: Props) {
  const highlight = current ?? detected;
  return (
    <main className="landing">
      <div className="landing-hero">
        <Herme mood="smug" size={200} />
        <div>
          <h1 className="wordmark">hermit</h1>
          <p className="pitch">Learn the real command line for your OS, one tiny lesson at a time.</p>
        </div>
      </div>
      <p className="landing-ask">{current === null ? 'Which computer do you use?' : 'Switch track. Progress is kept per OS.'}</p>
      <div className="os-picker">
        {ORDER.map((os) => {
          const ready = available.includes(os);
          return (
            <button
              key={os}
              type="button"
              className={`os-button os-${os}${os === highlight ? ' is-detected' : ''}`}
              disabled={!ready}
              onClick={() => onPick(os)}
              autoFocus={os === highlight && ready}
            >
              <span className="os-name">{OS_LABEL[os]}</span>
              <span className="os-shell">{ready ? SHELL_LABEL[os] : 'Coming soon'}</span>
              {os === highlight && <span className="os-badge">{current === os ? 'Your track' : "You're on this"}</span>}
            </button>
          );
        })}
      </div>
      <ThreeShells highlight={highlight} />
      <p className="small-screen-note">Hermit is best on a desktop, with a real keyboard.</p>
      <p className="fineprint">Nothing you type runs on a real machine. It's all a simulated shell.</p>
    </main>
  );
}
