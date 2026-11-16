import type { Unit } from '../../domain/lessons/types';
import { unit1 } from './unit1';
import { unit2 } from './unit2';

export const units: readonly Unit[] = [unit1, unit2];

/** Units planned in the spec but not written yet. Shown locked on the path. */
export const upcomingUnits: readonly { readonly id: string; readonly title: string; readonly blurb: string }[] = [
  { id: 'u3', title: 'Finding things', blurb: 'Search inside files and find files by name.' },
  { id: 'u4', title: 'Pipes and redirects', blurb: 'Chain commands together and save their output.' },
  { id: 'u5', title: 'Processes and permissions', blurb: 'Stop runaway programs and run scripts.' },
  { id: 'u6', title: 'Installing software', blurb: 'Search for and install packages.' },
  { id: 'u7', title: 'Environment and PATH', blurb: 'Variables, PATH and your shell profile.' },
  { id: 'u8', title: 'Party tricks', blurb: 'Fun commands that only your OS has.' },
];
