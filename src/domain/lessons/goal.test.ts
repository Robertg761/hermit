import { describe, expect, it } from 'vitest';
import { buildMachine } from '../machine';
import { goalMet } from './goal';

describe('canRun and isAdmin goals', () => {
  it('canRun follows the execute bit on Linux and macOS', () => {
    const off = buildMachine('linux', { files: { 'a.sh': 'echo hi\n' } });
    const on = buildMachine('mac', { files: { 'a.sh': 'echo hi\n' }, executable: ['a.sh'] });
    expect(goalMet({ kind: 'canRun', path: 'a.sh' }, 'linux', off, null)).toBe(false);
    expect(goalMet({ kind: 'canRun', path: 'a.sh' }, 'mac', on, null)).toBe(true);
  });
  it('canRun follows the execution policy on Windows', () => {
    expect(goalMet({ kind: 'canRun', path: 'a.ps1' }, 'windows', buildMachine('windows'), null)).toBe(false);
    expect(goalMet({ kind: 'canRun', path: 'a.ps1' }, 'windows', buildMachine('windows', { executionPolicy: 'RemoteSigned' }), null)).toBe(true);
  });
  it('isAdmin', () => {
    const m = buildMachine('windows');
    expect(goalMet({ kind: 'isAdmin' }, 'windows', m, null)).toBe(false);
    expect(goalMet({ kind: 'isAdmin' }, 'windows', { ...m, isAdmin: true }, null)).toBe(true);
  });
});
