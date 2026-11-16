import { seedPath } from '../machine';
import type { CommandResult, MachineState, OS } from '../types';
import { canonical, caseInsensitive, caseSensitive, getNode } from '../vfs/vfs';
import type { Goal } from './types';

const eqFor = (os: OS) => (os === 'windows' ? caseInsensitive : caseSensitive);

const samePath = (os: OS, a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((s, i) => eqFor(os)(s, b[i] ?? ''));

/** Evaluate a declarative goal against the machine state and the last command's output. */
export const goalMet = (goal: Goal, os: OS, state: MachineState, last: CommandResult | null): boolean => {
  const eq = eqFor(os);
  switch (goal.kind) {
    case 'exists': {
      const r = getNode(state.root, seedPath(os, goal.path), eq);
      return r.ok && (goal.type === undefined || r.value.kind === goal.type);
    }
    case 'notExists':
      return !getNode(state.root, seedPath(os, goal.path), eq).ok;
    case 'fileContains':
    case 'fileEquals': {
      const r = getNode(state.root, seedPath(os, goal.path), eq);
      if (!r.ok || r.value.kind !== 'file') return false;
      const content = r.value.content.replace(/\r\n/g, '\n');
      return goal.kind === 'fileContains' ? content.includes(goal.text) : content.trimEnd() === goal.text.trimEnd();
    }
    case 'cwdIs': {
      const want = canonical(state.root, seedPath(os, goal.path), eq) ?? seedPath(os, goal.path);
      return samePath(os, state.cwd, want);
    }
    case 'stdoutIncludes':
      return last !== null && last.stdout.includes(goal.text);
    case 'stdoutExcludes':
      return last !== null && last.stdout.trim() !== '' && !last.stdout.includes(goal.text);
    case 'envIs':
      return state.env[goal.name] === goal.value;
    case 'processGone':
      return !state.processes.some((p) => p.name === goal.name);
    case 'installed':
      return state.installed.includes(goal.pkg);
    case 'canRun': {
      if (os === 'windows') return state.executionPolicy === 'RemoteSigned' || state.executionPolicy === 'Unrestricted' || state.executionPolicy === 'Bypass';
      const r = getNode(state.root, seedPath(os, goal.path), eq);
      return r.ok && r.value.kind === 'file' && r.value.executable === true;
    }
    case 'isAdmin':
      return state.isAdmin;
    case 'all':
      return goal.goals.every((g) => goalMet(g, os, state, last));
  }
};
