import { describe, expect, it } from 'vitest';
import { buildMachine } from '../machine';
import type { OS } from '../types';
import { dialects } from './registry';

const run = (os: OS, line: string) => {
  const d = dialects[os];
  if (d === undefined) throw new Error(os);
  return d.run(line, buildMachine(os, { files: { 'notes.txt': 'x', 'dir/a': 'y' } }));
};

describe('error decoder', () => {
  for (const os of ['linux', 'mac', 'windows'] as const) {
    it(`${os}: typos are "no command called"`, () => {
      expect(run(os, 'pdw').decoded).toBe("There's no command called `pdw`. Check the spelling.");
    });
    it(`${os}: a missing name points at listing`, () => {
      expect(run(os, 'cd gaem').decoded).toContain('Nothing called `gaem` here');
      expect(run(os, 'cat gaem').decoded).toContain('Nothing called `gaem` here');
    });
    it(`${os}: reading a folder`, () => {
      expect(run(os, 'cat dir').decoded).toContain('`dir` is a folder');
    });
  }
  it('flags glued to commands', () => {
    expect(run('linux', 'ls-a').decoded).toBe('Commands and flags need a space between them: `ls -a`.');
    expect(run('mac', 'ls-a').decoded).toBe('Commands and flags need a space between them: `ls -a`.');
    expect(run('windows', 'Get-ChildItem-Force').decoded).toBe('Commands and flags need a space between them: `Get-ChildItem -Force`.');
  });
  it('cd into a file', () => {
    expect(run('linux', 'cd notes.txt').decoded).toBe('`notes.txt` is a file. You can only `cd` into folders.');
    expect(run('mac', 'cd notes.txt').decoded).toBe('`notes.txt` is a file. You can only `cd` into folders.');
  });
  it('folders need recursion to delete', () => {
    expect(run('linux', 'rm dir').decoded).toContain('needs `-r`');
    expect(run('windows', 'rm dir').decoded).toContain('-Recurse');
  });
  it('wrong-OS explanations win over the decoder', () => {
    const r = run('windows', 'rm -rf dir');
    expect(r.wrongOs).toBeDefined();
    expect(r.decoded).toBeUndefined();
  });
  it('successful commands are left alone', () => {
    expect(run('linux', 'ls').decoded).toBeUndefined();
  });
});
