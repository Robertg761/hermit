import type { CommandResult, MachineState, OS } from '../types';
import type { Path } from '../vfs/vfs';

/** Typed object flowing through a PowerShell pipeline. */
export type PsObject =
  | { readonly type: 'string'; readonly value: string }
  | { readonly type: 'number'; readonly value: number }
  | { readonly type: 'pathInfo'; readonly path: string }
  | {
      readonly type: 'file';
      readonly name: string;
      readonly path: Path;
      readonly isDir: boolean;
      readonly length: number;
      readonly hidden: boolean;
    }
  | { readonly type: 'process'; readonly name: string; readonly pid: number; readonly cpu: number }
  | { readonly type: 'matchInfo'; readonly path: string; readonly lineNumber: number; readonly line: string }
  | { readonly type: 'measure'; readonly lines: number; readonly words: number; readonly chars: number; readonly count: number; readonly mode: 'text' | 'count' }
  /** `Select-Object Name, Length` output: a row with only some properties. */
  | { readonly type: 'record'; readonly props: readonly (readonly [string, PsObject | null])[] }
  | { readonly type: 'scriptblock'; readonly text: string };

export type PipeInput =
  | { readonly kind: 'none' }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'objects'; readonly items: readonly PsObject[] };

export type CommandContext = {
  /** True when stdout goes to the terminal (not a pipe or file). Drives colours and column layout. */
  readonly tty: boolean;
};

export type CommandHandler = (
  args: readonly string[],
  input: PipeInput,
  state: MachineState,
  ctx: CommandContext,
) => CommandResult;

export type Dialect = {
  readonly os: OS;
  readonly prompt: (state: MachineState) => string;
  readonly formatPath: (segments: Path) => string;
  readonly parsePath: (raw: string, state: MachineState) => Path | null;
  readonly caseInsensitive: boolean;
  readonly commands: Readonly<Record<string, CommandHandler>>;
  readonly aliases: Readonly<Record<string, string>>;
  readonly run: (line: string, state: MachineState) => CommandResult;
};

export const noInput: PipeInput = { kind: 'none' };

export const result = (
  state: MachineState,
  out: { stdout?: string; stderr?: string; exitCode?: number; effects?: CommandResult['effects'] } = {},
): CommandResult => ({
  state,
  stdout: out.stdout ?? '',
  stderr: out.stderr ?? '',
  exitCode: out.exitCode ?? (out.stderr ? 1 : 0),
  effects: out.effects ?? [],
});

export const inputText = (input: PipeInput): string | null => {
  if (input.kind === 'text') return input.text;
  if (input.kind === 'objects') return input.items.map((o) => ('value' in o ? String(o.value) : 'name' in o ? o.name : '')).join('\n') + '\n';
  return null;
};
