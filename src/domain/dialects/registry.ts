import type { OS } from '../types';
import { bash } from './bash';
import type { Dialect } from './dialect';
import { powershell } from './powershell';
import { decodeError } from './error-decoder';
import { explainWrongOs } from './wrong-os';
import { zsh } from './zsh';

const isCommand = (d: Dialect, name: string): boolean => {
  if (d.caseInsensitive) {
    const lower = name.toLowerCase();
    return Object.keys(d.commands).some((c) => c.toLowerCase() === lower) || Object.keys(d.aliases).some((a) => a.toLowerCase() === lower);
  }
  return name in d.commands || name in d.aliases;
};

/** Add the wrong-OS explanation to failed lines that look like another shell's habit. */
const withWrongOs = (d: Dialect): Dialect => ({
  ...d,
  run: (line, state) => {
    const r = d.run(line, state);
    if (r.exitCode === 0) return r;
    const wrongOs = r.wrongOs ?? explainWrongOs(d.os, line);
    if (wrongOs !== undefined) return { ...r, wrongOs };
    const decoded = decodeError(d.os, r.stderr, (name) => isCommand(d, name));
    return decoded === undefined ? r : { ...r, decoded };
  },
});

export const dialects: Partial<Record<OS, Dialect>> = {
  linux: withWrongOs(bash),
  mac: withWrongOs(zsh),
  windows: withWrongOs(powershell),
};

export const dialectFor = (os: OS): Dialect | undefined => dialects[os];
