import { describe, expect, it } from 'vitest';
import { buildMachine } from '../machine';
import { startChallenge, step } from '../lessons/runner';
import type { Challenge } from '../lessons/types';
import type { OS } from '../types';
import { dialects } from './registry';

const run = (os: OS, line: string) => {
  const d = dialects[os];
  if (d === undefined) throw new Error('no dialect');
  return d.run(line, buildMachine(os, { files: { 'a.txt': 'a\n' } }));
};
const eggOf = (os: OS, line: string): string | undefined => {
  const e = run(os, line).effects.find((x) => x.kind === 'easterEgg');
  return e?.kind === 'easterEgg' ? e.id : undefined;
};

describe('easter eggs', () => {
  it.each([
    ['linux', 'sudo rm -rf /', 'nuke'],
    ['mac', 'rm -rf /*', 'nuke'],
    ['windows', 'Remove-Item C:\\ -Recurse -Force', 'nuke'],
    ['windows', 'rm -r -fo C:\\', 'nuke'],
    ['linux', 'vim', 'editor'],
    ['mac', 'nano notes.txt', 'editor'],
    ['windows', 'notepad a.txt', 'editor'],
    ['linux', 'neofetch', 'fetch'],
    ['windows', 'fastfetch', 'fetch'],
    ['linux', 'sl', 'sl'],
    ['mac', 'cowsay hello', 'cowsay'],
    ['linux', 'fortune', 'fortune'],
    ['linux', 'sudo make me a sandwich', 'sandwich'],
    ['windows', 'exit', 'exit'],
  ] as const)('%s: %s', (os, line, id) => {
    expect(eggOf(os, line)).toBe(id);
    expect(run(os, line).free).toBe(true);
  });
  it('the GNU failsafe message is real', () => {
    expect(run('linux', 'rm -rf /').stderr).toBe("rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe");
  });
  it('ordinary deletes are not eggs', () => {
    expect(eggOf('linux', 'rm -rf a.txt')).toBeUndefined();
    expect(eggOf('windows', 'Remove-Item a.txt')).toBeUndefined();
    expect(eggOf('linux', 'slack')).toBeUndefined();
  });
  it('vim on Windows is still a wrong-OS habit, not an egg', () => {
    expect(eggOf('windows', 'vim a.txt')).toBeUndefined();
    expect(run('windows', 'vim a.txt').wrongOs).toContain('notepad');
  });
  it('eggs and unsimulated features never cost a heart', () => {
    const c: Challenge = {
      id: 't', type: 'do', uses: [], prompt: { linux: 'x', mac: 'x', windows: 'x' },
      seed: { linux: {}, mac: {}, windows: {} }, goal: { linux: { kind: 'exists', path: 'z' }, mac: { kind: 'exists', path: 'z' }, windows: { kind: 'exists', path: 'z' } },
      solutions: { linux: [['touch z']], mac: [['touch z']], windows: [['ni z']] }, hints: { linux: [], mac: [], windows: [] }, explain: { linux: '', mac: '', windows: '' },
    };
    const d = dialects.linux;
    if (d === undefined) throw new Error('no dialect');
    const s = step(startChallenge(c, 'linux'), 'sudo rm -rf /', d);
    expect(s.outcome).toBe('ok');
    expect(s.attempt.lostHeart).toBe(false);
    const pd = dialects.windows;
    if (pd === undefined) throw new Error('no dialect');
    const s2 = step(startChallenge(c, 'windows'), '{ $x }', pd);
    expect(s2.attempt.lostHeart).toBe(false);
  });
});
