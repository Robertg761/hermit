import type { OS } from '../types';
import { bash } from './bash';
import type { Dialect } from './dialect';
import { powershell } from './powershell';
import { decodeError } from './error-decoder';
import { runEgg } from './eggs';
import { explainWrongOs } from './wrong-os';
import { zsh } from './zsh';

const isCommand = (d: Dialect, name: string): boolean => {
  if (d.caseInsensitive) {
    const lower = name.toLowerCase();
    return Object.keys(d.commands).some((c) => c.toLowerCase() === lower) || Object.keys(d.aliases).some((a) => a.toLowerCase() === lower);
  }
  return name in d.commands || name in d.aliases;
};

const NOT_SIMULATED = /Hermit doesn't simulate|are not simulated/;

/**
 * Easter eggs first, then the dialect. Failed lines get the wrong-OS explanation
 * or a plain-English reading. Eggs and unsimulated features are marked free.
 */
const withWrongOs = (d: Dialect): Dialect => ({
  ...d,
  run: (line, state) => {
    const egg = runEgg(d.os, line, state);
    if (egg !== undefined) return { ...egg, free: true };
    const raw = d.run(line, state);
    const r = raw.effects.some((e) => e.kind === 'easterEgg') || NOT_SIMULATED.test(raw.stderr) ? { ...raw, free: true } : raw;
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
