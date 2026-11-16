import { describe, expect, it } from 'vitest';
import { buildMachine } from '../../machine';
import type { MachineState } from '../../types';
import { exists } from '../../vfs/vfs';
import { zsh } from './index';

const seed = buildMachine('mac', { files: { 'notes.txt': 'hi\n', 'projects/app.js': '' } });
const run = (lines: readonly string[], state: MachineState = seed) => {
  let s = state;
  let last = zsh.run('', s);
  for (const l of lines) {
    last = zsh.run(l, s);
    s = last.state;
  }
  return last;
};

describe('zsh (macOS)', () => {
  it('uses macOS paths and prompt', () => {
    expect(run(['pwd']).stdout).toBe('/Users/you\n');
    expect(zsh.prompt(seed)).toBe('you@Hermits-MacBook ~ % ');
    expect(zsh.prompt(run(['cd projects']).state)).toBe('you@Hermits-MacBook projects % ');
  });
  it('uses zsh wording for shell errors', () => {
    expect(run(['frob']).stderr).toBe('zsh: command not found: frob');
    expect(run(['cd nope']).stderr).toBe('cd: no such file or directory: nope');
    expect(run(['cd notes.txt']).stderr).toBe('cd: not a directory: notes.txt');
  });
  it('uses BSD wording for coreutils errors', () => {
    const ls = run(['ls nope']);
    expect(ls.stderr).toBe('ls: nope: No such file or directory');
    expect(ls.exitCode).toBe(1);
    expect(run(['mkdir projects']).stderr).toBe('mkdir: projects: File exists');
    expect(run(['rm projects']).stderr).toBe('rm: projects: is a directory');
    expect(run(['rm ghost']).stderr).toBe('rm: ghost: No such file or directory');
    expect(run(['cp projects backup']).stderr).toBe('cp: projects is a directory (not copied).');
    expect(run(['cp ghost x']).stderr).toBe('cp: ghost: No such file or directory');
    expect(run(['mv ghost x']).stderr).toBe('mv: rename ghost to x: No such file or directory');
    expect(run(['touch a/b']).stderr).toBe('touch: a/b: No such file or directory');
    expect(run(['ls -z']).stderr).toContain('ls: invalid option -- z');
  });
  it('does not colour ls output and shows staff group', () => {
    expect(run(['ls']).stdout).toBe('notes.txt  projects\n');
    expect(run(['ls -l']).stdout).toContain('you  staff');
  });
  it('errors on globs that match nothing', () => {
    expect(run(['ls *.xyz']).stderr).toBe('zsh: no matches found: *.xyz');
    expect(run(['ls *.txt']).stdout).toBe('notes.txt\n');
  });
  it('still does the shared POSIX work', () => {
    const r = run(['mkdir out && cd out', 'touch a.txt', 'cp a.txt b.txt']);
    expect(exists(r.state.root, ['Users', 'you', 'out', 'b.txt'])).toBe(true);
  });
  it('has macOS extras', () => {
    expect(run(['say hello']).effects).toEqual([{ kind: 'speak', text: 'hello' }]);
    expect(run(['echo copied | pbcopy', 'pbpaste']).stdout).toBe('copied\n');
    expect(run(['sw_vers']).stdout).toContain('ProductName:');
  });
});
