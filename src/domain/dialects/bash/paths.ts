import type { MachineState } from '../../types';
import { normalize, type Path } from '../../vfs/vfs';

export const formatPosixPath = (segments: Path): string => '/' + segments.join('/');

/** Resolve a POSIX path (absolute or relative to cwd). `~` is expanded earlier by the shell. */
export const parsePosixPath = (raw: string, state: MachineState): Path | null => {
  if (raw.length === 0) return null;
  const parts = raw.split('/');
  const base = raw.startsWith('/') ? [] : state.cwd;
  return normalize([...base, ...parts]);
};

/** Path shown in the prompt: `~` for home, `~/x` inside home. */
export const tildePath = (state: MachineState): string => {
  const { cwd, home } = state;
  if (cwd.length >= home.length && home.every((s, i) => cwd[i] === s)) {
    const rest = cwd.slice(home.length);
    return rest.length === 0 ? '~' : '~/' + rest.join('/');
  }
  return formatPosixPath(cwd);
};
