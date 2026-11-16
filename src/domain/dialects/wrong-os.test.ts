import { describe, expect, it } from 'vitest';
import { buildMachine } from '../machine';
import { dialects } from './registry';
import { wrongOsRules } from './wrong-os';

const seed = { files: { 'notes.txt': 'hi\n', 'a.txt': 'a', 'junk/x.txt': 'x' }, dirs: ['projects/game', 'b'], hidden: [], executable: [], cwd: '', env: {}, processes: [] };

describe('wrong-OS explanations', () => {
  it('has at least 20 rules', () => {
    expect(wrongOsRules.length).toBeGreaterThanOrEqual(20);
  });

  for (const rule of wrongOsRules) {
    for (const os of rule.on) {
      for (const line of rule.examples) {
        it(`${os}: "${line}" fails and is explained`, () => {
          const d = dialects[os];
          if (d === undefined) throw new Error(`no dialect for ${os}`);
          const r = d.run(line, buildMachine(os, seed));
          expect(r.exitCode).not.toBe(0);
          expect(r.wrongOs).toBe(wrongOsRules.find((x) => x.on.includes(os) && x.test.test(line))?.explain);
          expect(r.wrongOs).toBeDefined();
        });
      }
    }
  }

  it('acceptance: rm -rf junk in PowerShell explains Remove-Item -Recurse -Force', () => {
    const d = dialects.windows;
    if (d === undefined) throw new Error('no windows');
    const r = d.run('rm -rf junk', buildMachine('windows', seed));
    expect(r.stderr).toContain("parameter name 'rf'");
    expect(r.wrongOs).toContain('Remove-Item junk -Recurse -Force');
  });

  it('does not explain lines that worked', () => {
    const d = dialects.linux;
    if (d === undefined) throw new Error('no linux');
    expect(d.run('cat notes.txt', buildMachine('linux', seed)).wrongOs).toBeUndefined();
  });
});
