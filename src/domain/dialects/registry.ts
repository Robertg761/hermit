import type { OS } from '../types';
import { bash } from './bash';
import type { Dialect } from './dialect';
import { powershell } from './powershell';
import { explainWrongOs } from './wrong-os';
import { zsh } from './zsh';

/** Add the wrong-OS explanation to failed lines that look like another shell's habit. */
const withWrongOs = (d: Dialect): Dialect => ({
  ...d,
  run: (line, state) => {
    const r = d.run(line, state);
    if (r.exitCode === 0 || r.wrongOs !== undefined) return r;
    const wrongOs = explainWrongOs(d.os, line);
    return wrongOs === undefined ? r : { ...r, wrongOs };
  },
});

export const dialects: Partial<Record<OS, Dialect>> = {
  linux: withWrongOs(bash),
  mac: withWrongOs(zsh),
  windows: withWrongOs(powershell),
};

export const dialectFor = (os: OS): Dialect | undefined => dialects[os];
