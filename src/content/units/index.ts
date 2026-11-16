import type { Unit } from '../../domain/lessons/types';
import { unit1 } from './unit1';
import { unit2 } from './unit2';
import { unit3 } from './unit3';
import { unit4 } from './unit4';
import { unit5 } from './unit5';

export const units: readonly Unit[] = [unit1, unit2, unit3, unit4, unit5];

/** Units planned in the spec but not written yet. Shown locked on the path. */
export const upcomingUnits: readonly { readonly id: string; readonly title: string; readonly blurb: string }[] = [
  { id: 'u6', title: 'Installing software', blurb: 'Search for and install packages.' },
  { id: 'u7', title: 'Environment and PATH', blurb: 'Variables, PATH and your shell profile.' },
  { id: 'u8', title: 'Party tricks', blurb: 'Fun commands that only your OS has.' },
];
