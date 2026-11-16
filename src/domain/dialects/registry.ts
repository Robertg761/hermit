import type { OS } from '../types';
import { bash } from './bash';
import type { Dialect } from './dialect';
import { zsh } from './zsh';

/** Dialects implemented so far. Windows arrives with the PowerShell dialect. */
export const dialects: Partial<Record<OS, Dialect>> = { linux: bash, mac: zsh };

export const dialectFor = (os: OS): Dialect | undefined => dialects[os];
