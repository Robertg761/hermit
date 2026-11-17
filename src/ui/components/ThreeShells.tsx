import { useEffect, useState } from 'react';
import type { OS } from '../../domain/types';
import { OS_LABEL } from '../os';

/** One job, three shells: the remix, visible on the landing page. */
const TASKS: readonly { readonly task: string; readonly cmd: Readonly<Record<OS, string>> }[] = [
  { task: 'Show hidden files', cmd: { linux: 'ls -a', mac: 'ls -a', windows: 'Get-ChildItem -Force' } },
  { task: 'Delete a folder', cmd: { linux: 'rm -r junk', mac: 'rm -r junk', windows: 'Remove-Item junk -Recurse' } },
  { task: 'Find a word in a file', cmd: { linux: 'grep TODO notes.txt', mac: 'grep TODO notes.txt', windows: 'Select-String TODO notes.txt' } },
  { task: 'Stop a stuck program', cmd: { linux: 'kill 4242', mac: 'kill 4242', windows: 'Stop-Process -Id 4242' } },
  { task: 'Let a script run', cmd: { linux: 'chmod +x build.sh', mac: 'chmod +x build.sh', windows: 'Set-ExecutionPolicy -Scope CurrentUser RemoteSigned' } },
];

const PROMPT: Readonly<Record<OS, string>> = { linux: '$', mac: '%', windows: 'PS>' };
const ORDER: readonly OS[] = ['linux', 'mac', 'windows'];

export function ThreeShells({ highlight }: { highlight: OS }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1) % TASKS.length), 3200);
    return () => window.clearInterval(t);
  }, []);
  const t = TASKS[i] ?? TASKS[0];
  if (t === undefined) return null;
  return (
    <section className="three-shells" aria-label="One task in three shells">
      <p className="three-task">
        <span className="three-kicker">One job, three shells:</span> {t.task}
      </p>
      <div className="three-row" key={i}>
        {ORDER.map((os) => (
          <div key={os} className={`three-cell os-screen-${os}${os === highlight ? ' is-yours' : ''}`}>
            <span className="three-os">{OS_LABEL[os]}</span>
            <code>
              <span className="three-prompt">{PROMPT[os]}</span> {t.cmd[os]}
            </code>
          </div>
        ))}
      </div>
      <p className="three-note">Hermit teaches the one on your computer. Type a habit from another OS and Herme will explain the difference.</p>
    </section>
  );
}
