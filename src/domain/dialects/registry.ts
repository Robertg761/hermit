import type { OS } from '../types';
import { bash } from './bash';
import type { Dialect } from './dialect';

/** Dialects implemented so far. macOS and Windows arrive in Phase 2. */
export const dialects: Partial<Record<OS, Dialect>> = { linux: bash };

export const dialectFor = (os: OS): Dialect | undefined => dialects[os];
