import type { DirNode, MachineState, OS, Process, VNode } from './types';
import { dir, file, mkdir, setNode, type Path } from './vfs/vfs';

/**
 * A challenge's starting state, written once in a neutral form.
 * Paths are relative to the learner's home folder and use `/`.
 */
export type SeedState = {
  /** Files to create, keyed by path relative to home. */
  readonly files?: Readonly<Record<string, string>>;
  /** Extra (possibly empty) directories, relative to home. */
  readonly dirs?: readonly string[];
  /** Paths that get the hidden flag (Windows) — dotfiles are hidden on Linux and macOS automatically. */
  readonly hidden?: readonly string[];
  readonly executable?: readonly string[];
  /** Starting folder, relative to home. Defaults to home. */
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly processes?: readonly Process[];
};

export const USER = 'you';

export const homeFor = (os: OS): Path => {
  switch (os) {
    case 'linux':
      return ['home', USER];
    case 'mac':
      return ['Users', USER];
    case 'windows':
      return ['C:', 'Users', USER];
  }
};

const skeleton = (os: OS): DirNode => {
  switch (os) {
    case 'linux':
      return dir({
        bin: dir(),
        etc: dir({ hostname: file('hermit\n'), 'os-release': file('NAME="Hermit Linux"\nID=hermit\n') }),
        home: dir({ [USER]: dir() }),
        tmp: dir(),
        usr: dir({ bin: dir() }),
      });
    case 'mac':
      return dir({
        Applications: dir(),
        System: dir(),
        Users: dir({ [USER]: dir() }),
        tmp: dir(),
        usr: dir({ bin: dir() }),
      });
    case 'windows':
      return dir({
        'C:': dir({
          'Program Files': dir(),
          Users: dir({ [USER]: dir() }),
          Windows: dir({ System32: dir() }),
        }),
      });
  }
};

const DEFAULT_PROCESSES: readonly Process[] = [
  { pid: 1, name: 'init', cpu: 0 },
  { pid: 312, name: 'hermitd', cpu: 0.3 },
];

const defaultEnv = (os: OS, home: Path): Record<string, string> => {
  switch (os) {
    case 'linux':
      return { HOME: '/' + home.join('/'), USER, SHELL: '/bin/bash', PATH: '/usr/local/bin:/usr/bin:/bin' };
    case 'mac':
      return { HOME: '/' + home.join('/'), USER, SHELL: '/bin/zsh', PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' };
    case 'windows':
      return {
        USERPROFILE: home.join('\\'),
        USERNAME: USER,
        Path: 'C:\\Windows\\System32;C:\\Program Files\\PowerShell\\7',
      };
  }
};

const split = (rel: string): Path => rel.split('/').filter((s) => s.length > 0 && s !== '.');

/** Build the starting machine for an OS from a neutral seed. */
export const buildMachine = (os: OS, seed: SeedState = {}): MachineState => {
  const home = homeFor(os);
  let root = skeleton(os);
  const put = (rel: string, node: VNode): void => {
    const path = [...home, ...split(rel)];
    const parent = mkdir(root, path.slice(0, -1), { parents: true });
    if (!parent.ok) throw new Error(`bad seed path ${rel}`);
    const r = setNode(parent.value, path, node);
    if (!r.ok) throw new Error(`bad seed path ${rel}`);
    root = r.value;
  };
  for (const d of seed.dirs ?? []) {
    const r = mkdir(root, [...home, ...split(d)], { parents: true });
    if (!r.ok) throw new Error(`bad seed dir ${d}`);
    root = r.value;
  }
  for (const [rel, content] of Object.entries(seed.files ?? {})) {
    put(rel, file(content, { executable: seed.executable?.includes(rel) ?? false, mtime: 0 }));
  }
  for (const rel of seed.hidden ?? []) {
    const path = [...home, ...split(rel)];
    root = markHidden(root, path);
  }
  return {
    root,
    cwd: [...home, ...split(seed.cwd ?? '')],
    home,
    env: { ...defaultEnv(os, home), ...(seed.env ?? {}) },
    processes: [...DEFAULT_PROCESSES, ...(seed.processes ?? [])],
    installed: [],
    isAdmin: false,
    ...(os === 'windows' ? { executionPolicy: 'Restricted' as const } : {}),
  };
};

const markHidden = (root: DirNode, path: Path): DirNode => {
  let node: VNode = root;
  for (const seg of path) {
    if (node.kind !== 'dir') return root;
    const next: VNode | undefined = node.children[seg];
    if (next === undefined) return root;
    node = next;
  }
  const r = setNode(root, path, { ...node, hidden: true });
  return r.ok ? r.value : root;
};

/** Seed-relative path (`notes/todo.txt`) to absolute segments for an OS. */
export const seedPath = (os: OS, rel: string): Path => [...homeFor(os), ...split(rel)];
