import type { OS } from '../types';
import { bash } from './bash';
import type { Dialect } from './dialect';
import { powershell } from './powershell';
import { zsh } from './zsh';

export const dialects: Partial<Record<OS, Dialect>> = { linux: bash, mac: zsh, windows: powershell };

export const dialectFor = (os: OS): Dialect | undefined => dialects[os];
