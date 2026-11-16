import type { MachineState } from '../../types';
import { canonical, caseInsensitive, normalize, type Path } from '../../vfs/vfs';

/** ['C:', 'Users', 'you'] → 'C:\Users\you'. */
export const formatWinPath = (segments: Path): string => {
  if (segments.length === 0) return '\\';
  const [drive, ...rest] = segments;
  return `${drive ?? 'C:'}\\${rest.join('\\')}`;
};

/** Windows paths: `\` or `/`, drive-absolute (`C:\x`), drive-relative root (`\x`), `~`, `.` and `..`. */
export const parseWinPath = (raw: string, state: MachineState): Path | null => {
  if (raw.length === 0) return null;
  const s = raw.replace(/\//g, '\\');
  let base: Path;
  let rest: string;
  const drive = /^([A-Za-z]:)(\\|$)/.exec(s);
  if (drive !== null) {
    base = [(drive[1] ?? 'C:').toUpperCase()];
    rest = s.slice(drive[0].length);
  } else if (s.startsWith('\\')) {
    base = state.cwd.slice(0, 1);
    rest = s.slice(1);
  } else if (s === '~' || s.startsWith('~\\')) {
    base = state.home;
    rest = s.slice(1);
  } else {
    base = state.cwd;
    rest = s;
  }
  const segs = normalize([...base, ...rest.split('\\')]);
  // `..` above the drive stays at the drive root
  const withDrive = segs.length === 0 || !/^[A-Za-z]:$/.test(segs[0] ?? '') ? [base[0] ?? 'C:', ...segs.filter((x) => !/^[A-Za-z]:$/.test(x))] : segs;
  return canonical(state.root, withDrive, caseInsensitive) ?? withDrive;
};
