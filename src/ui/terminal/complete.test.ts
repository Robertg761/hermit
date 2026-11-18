import { describe, expect, it } from 'vitest';
import { dialects } from '../../domain/dialects/registry';
import { buildMachine } from '../../domain/machine';
import { completeLine } from './complete';
import type { Dialect } from '../../domain/dialects/dialect';

const need = (d: Dialect | undefined): Dialect => {
  if (d === undefined) throw new Error('missing dialect');
  return d;
};

const seed = { files: { 'notes.txt': 'x', 'projects/game/main.py': 'x', 'projects/website/index.html': 'x', 'photos/beach.jpg': 'x', '.secret': 'x' } };

describe('tab completion', () => {
  const linux = need(dialects.linux);
  const m = buildMachine('linux', seed);
  it('finishes a unique folder name with a slash', () => {
    expect(completeLine('cd proj', linux, m).line).toBe('cd projects/');
  });
  it('finishes a file name with a space', () => {
    expect(completeLine('cat no', linux, m).line).toBe('cat notes.txt ');
  });
  it('goes inside folders', () => {
    expect(completeLine('cd projects/g', linux, m).line).toBe('cd projects/game/');
  });
  it('lists several matches without changing the line', () => {
    const r = completeLine('cd projects/', linux, m);
    expect(r.line).toBe('cd projects/');
    expect(r.matches).toEqual(['game/', 'website/']);
  });
  it('hides dot files unless the word starts with a dot', () => {
    expect(completeLine('cat ', linux, m).matches).not.toContain('.secret');
    expect(completeLine('cat .s', linux, m).line).toBe('cat .secret ');
  });
  it('completes command names', () => {
    expect(completeLine('pw', linux, m).line).toBe('pwd ');
  });
  it('is case-insensitive with backslashes on Windows', () => {
    const win = need(dialects.windows);
    const w = buildMachine('windows', seed);
    expect(completeLine('cd PROJ', win, w).line).toBe('cd projects\\');
    expect(completeLine('Get-Cont', win, w).line).toBe('Get-Content ');
  });
});
