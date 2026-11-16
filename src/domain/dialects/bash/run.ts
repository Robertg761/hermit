import type { CommandResult, Effect, MachineState } from '../../types';
import { parse, type SimpleCommand } from '../../shell/parse';
import { tokenize } from '../../shell/tokenize';
import { result, type CommandHandler, type PipeInput } from '../dialect';
import { redirectRead, redirectWrite } from './commands';
import { expandWord, expandWordDetailed } from './expand';
import { parsePosixPath } from './paths';
import { getNode } from '../../vfs/vfs';

export type ShellConfig = {
  /** Name used in shell-level error messages: `bash` or `zsh`. */
  readonly shellName: string;
  readonly commands: Readonly<Record<string, CommandHandler>>;
  readonly aliases: Readonly<Record<string, string>>;
  readonly notFound: (name: string) => string;
  /** zsh errors on globs that match nothing; bash passes them through literally. */
  readonly nomatchError?: boolean;
};

type Acc = { state: MachineState; stdout: string; stderr: string[]; effects: Effect[]; exitCode: number };

const runSimple = (
  cmd: SimpleCommand,
  input: PipeInput,
  state: MachineState,
  tty: boolean,
  lastExit: number,
  cfg: ShellConfig,
): CommandResult => {
  const argv: string[] = [];
  for (const w of cmd.words) {
    const e = expandWordDetailed(w, state, lastExit);
    if (e.nomatch !== undefined && cfg.nomatchError) {
      return result(state, { stderr: `${cfg.shellName}: no matches found: ${e.nomatch}`, exitCode: 1 });
    }
    argv.push(...e.words);
  }
  let s = state;
  let stdin = input;
  let stdoutTarget: { path: string; append: boolean } | null = null;
  let stderrTarget: { path: string; append: boolean } | null = null;
  let both = false;
  for (const r of cmd.redirects) {
    const [target] = expandWord(r.target, s, lastExit);
    if (target === undefined) return result(s, { stderr: `${cfg.shellName}: ambiguous redirect`, exitCode: 1 });
    if (r.op === '<') {
      const read = redirectRead(s, target, cfg.shellName);
      if ('error' in read) return result(s, { stderr: read.error, exitCode: 1 });
      stdin = { kind: 'text', text: read.text };
    } else if (r.op === '2>' || r.op === '2>>') {
      stderrTarget = { path: target, append: r.op === '2>>' };
    } else {
      stdoutTarget = { path: target, append: r.op === '>>' };
      both = r.op === '&>';
      // The shell creates (or, for `>`, truncates) the file before the command runs.
      const created = redirectWrite(s, target, '', stdoutTarget.append, cfg.shellName);
      if (created.error) return result(s, { stderr: created.error, exitCode: 1 });
      s = created.state;
    }
  }

  if (argv.length === 0) return result(s);
  const r = dispatch(argv, stdin, s, tty && stdoutTarget === null, cfg);
  let out = r.stdout;
  let err = r.stderr;
  let next = r.state;
  if (stdoutTarget !== null) {
    const content = both ? out + (err ? err + '\n' : '') : out;
    const w = redirectWrite(next, stdoutTarget.path, content, true);
    next = w.state;
    out = '';
    if (both) err = '';
  }
  if (stderrTarget !== null && err) {
    const w = redirectWrite(next, stderrTarget.path, err + '\n', stderrTarget.append);
    next = w.state;
    err = '';
  }
  return { ...r, state: next, stdout: out, stderr: err };
};

/** Find and run a command: builtins, aliases, `sudo`, and scripts like `./build.sh`. */
const dispatch = (argv: readonly string[], stdin: PipeInput, s: MachineState, tty: boolean, cfg: ShellConfig): CommandResult => {
  const [rawName, ...args] = argv;
  const name = rawName ?? '';
  if (name === 'sudo') {
    if (args.length === 0) return result(s, { stderr: 'usage: sudo [-u user] command [arg ...]', exitCode: 1 });
    const r = dispatch(args, stdin, { ...s, isAdmin: true }, tty, cfg);
    return { ...r, state: { ...r.state, isAdmin: s.isAdmin } };
  }
  if (name.includes('/')) return runScript(name, s, cfg, true);
  if ((name === 'bash' || name === 'sh' || name === 'zsh') && args[0] !== undefined && !args[0].startsWith('-')) return runScript(args[0], s, cfg, false);
  const aliased = cfg.aliases[name];
  let handler = cfg.commands[name];
  let finalArgs = args;
  if (handler === undefined && aliased !== undefined) {
    const [aName, ...aArgs] = aliased.split(' ');
    handler = cfg.commands[aName ?? ''];
    finalArgs = [...aArgs, ...args];
  }
  if (handler === undefined) return result(s, { stderr: cfg.notFound(name), exitCode: 127 });
  return handler(finalArgs, stdin, s, { tty });
};

/** Run a script file line by line. `./x` needs the executable bit; `bash x` does not. */
const runScript = (raw: string, state: MachineState, cfg: ShellConfig, needsExec: boolean): CommandResult => {
  const path = parsePosixPath(raw, state);
  const node = path === null ? null : getNode(state.root, path);
  const zsh = cfg.shellName === 'zsh';
  if (node === null || !node.ok) {
    return result(state, { stderr: zsh ? `zsh: no such file or directory: ${raw}` : needsExec ? `bash: ${raw}: No such file or directory` : `bash: ${raw}: No such file or directory`, exitCode: 127 });
  }
  if (node.value.kind === 'dir') return result(state, { stderr: zsh ? `zsh: permission denied: ${raw}` : `bash: ${raw}: Is a directory`, exitCode: 126 });
  if (needsExec && node.value.executable !== true) {
    return result(state, { stderr: zsh ? `zsh: permission denied: ${raw}` : `bash: ${raw}: Permission denied`, exitCode: 126 });
  }
  const body = node.value.content
    .split('\n')
    .filter((l) => l.trim() !== '' && !l.trimStart().startsWith('#'))
    .join('\n');
  let s = state;
  let stdout = '';
  const stderr: string[] = [];
  const effects: CommandResult['effects'][number][] = [];
  let exitCode = 0;
  for (const line of body.split('\n')) {
    const r = runLine(line, s, cfg);
    s = r.state;
    stdout += r.stdout;
    if (r.stderr) stderr.push(r.stderr);
    effects.push(...r.effects);
    exitCode = r.exitCode;
  }
  return { state: s, stdout, stderr: stderr.join('\n'), exitCode, effects };
};

export const runLine = (line: string, state: MachineState, cfg: ShellConfig): CommandResult => {
  const tokens = tokenize(line);
  if (!tokens.ok) return result(state, { stderr: `${cfg.shellName}: ${tokens.error}`, exitCode: 2 });
  const parsed = parse(tokens.tokens);
  if (!parsed.ok) return result(state, { stderr: `${cfg.shellName}: ${parsed.error}`, exitCode: 2 });

  const acc: Acc = { state, stdout: '', stderr: [], effects: [], exitCode: 0 };
  let wrongOs: string | undefined;
  for (const { connector, pipeline } of parsed.list) {
    if (connector === '&&' && acc.exitCode !== 0) continue;
    if (connector === '||' && acc.exitCode === 0) continue;
    let input: PipeInput = { kind: 'none' };
    const last = pipeline.commands.length - 1;
    pipeline.commands.forEach((cmd, i) => {
      const r = runSimple(cmd, input, acc.state, i === last, acc.exitCode, cfg);
      acc.state = r.state;
      if (r.stderr) acc.stderr.push(r.stderr);
      acc.effects.push(...r.effects);
      if (r.wrongOs !== undefined) wrongOs = r.wrongOs;
      if (i === last) {
        acc.stdout += r.stdout;
        acc.exitCode = r.exitCode;
      } else {
        input = { kind: 'text', text: r.stdout };
      }
    });
  }
  return {
    state: acc.state,
    stdout: acc.stdout,
    stderr: acc.stderr.join('\n'),
    exitCode: acc.exitCode,
    effects: acc.effects,
    ...(wrongOs !== undefined ? { wrongOs } : {}),
  };
};
