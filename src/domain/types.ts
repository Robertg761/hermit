export type OS = 'linux' | 'mac' | 'windows';

export type FileNode = {
  readonly kind: 'file';
  readonly content: string;
  readonly executable?: boolean;
  readonly hidden?: boolean;
  /** Fake modification time, minutes since epoch of the simulation. Used for `ls -l`. */
  readonly mtime?: number;
};

export type DirNode = {
  readonly kind: 'dir';
  readonly children: Readonly<Record<string, VNode>>;
  readonly hidden?: boolean;
};

export type VNode = FileNode | DirNode;

/** `admin`: owned by root / SYSTEM, so stopping it needs sudo or an Administrator window. */
export type Process = { readonly pid: number; readonly name: string; readonly cpu: number; readonly admin?: boolean };

export type MachineState = {
  readonly root: DirNode;
  readonly cwd: readonly string[];
  readonly home: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly processes: readonly Process[];
  readonly installed: readonly string[];
  readonly isAdmin: boolean;
  readonly executionPolicy?: 'Restricted' | 'RemoteSigned' | 'Unrestricted' | 'Bypass' | 'AllSigned';
};

export type Effect =
  | { readonly kind: 'clear' }
  | { readonly kind: 'speak'; readonly text: string }
  | { readonly kind: 'clipboard'; readonly text: string }
  | { readonly kind: 'easterEgg'; readonly id: string };

export type CommandResult = {
  readonly state: MachineState;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  readonly effects: readonly Effect[];
  /** Set when the command was recognised as coming from another OS's shell. */
  readonly wrongOs?: string;
  /** A plain-English reading of the error, for beginners. */
  readonly decoded?: string;
};
