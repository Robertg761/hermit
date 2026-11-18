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
  it('real commands Hermit does not simulate are free and explained', () => {
    const man = run('linux', 'man ls');
    expect(man.free).toBe(true);
    expect(man.decoded).toContain('opens the manual');
    expect(run('mac', 'brew install wget').free).toBe(true);
    expect(run('windows', 'Get-History').free).toBe(true);
    expect(run('linux', 'ls --help').free).toBe(true);
    expect(run('linux', 'pdw').free).toBeUndefined();
  });
  it('commands builders reach for are free too', () => {
    for (const line of ['export A=1', 'env', 'printenv', 'id', 'locate notes.txt', 'doas ls', '. notes.txt', '!!', 'sudo !!', 'sudo -i', 'for i in 1 2; do echo $i; done']) {
      expect(run('linux', line).free, line).toBe(true);
      expect(run('mac', line).free, line).toBe(true);
    }
    for (const line of ['whoami', 'date', 'pushd ..', 'man ls', 'Get-ChildItem | Format-List', 'Get-ChildItem | ft', 'Get-Content notes.txt | Tee-Object out.txt', 'Unblock-File notes.txt', 'runas /user:Administrator pwsh']) {
      expect(run('windows', line).free, line).toBe(true);
    }
  });
  it('an unsimulated command inside a pipe is explained, not called a typo', () => {
    const r = run('linux', "awk '/x/' notes.txt | wc -l");
    expect(r.free).toBe(true);
    expect(r.stderr).toContain('awk is a real command');
    expect(r.decoded).toContain('picks out columns');
  });
  it('common slips get a plain-English line', () => {
    expect(run('linux', 'LS').decoded).toContain('lower case: `ls`');
    expect(run('linux', 'cp notes.txt').decoded).toContain('needs two names');
    expect(run('linux', 'mkdir').decoded).toContain('needs a name');
    expect(run('linux', 'cat "notes.txt').decoded).toContain('never closed');
    expect(run('windows', 'Get-Content "notes.txt').decoded).toContain('never closed');
    expect(run('linux', 'cat my file.txt').decoded).toContain('quotes');
    expect(run('windows', 'Get-Content my file.txt').decoded).toContain('quotes');
  });
  it('successful commands are left alone', () => {
    expect(run('linux', 'ls').decoded).toBeUndefined();
  });
});
