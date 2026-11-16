import type { CommandResult, DirNode, MachineState, VNode } from '../../types';
import { copy, getNode, listDir, mkdir, move, readFile, remove, rmdir, touch, writeFile, type Path, type VfsError } from '../../vfs/vfs';
import { inputText, result, type CommandContext, type CommandHandler, type PipeInput } from '../dialect';
import { parseFlags, type FlagSpec, type ParsedArgs } from './flags';
import { formatPosixPath, parsePosixPath } from './paths';

const BLUE = '\x1b[1;34m';
const GREEN = '\x1b[1;32m';
const RESET = '\x1b[0m';

const errText = (e: VfsError): string => {
  switch (e.code) {
    case 'ENOENT':
      return 'No such file or directory';
    case 'ENOTDIR':
      return 'Not a directory';
    case 'EISDIR':
      return 'Is a directory';
    case 'EEXIST':
      return 'File exists';
    case 'ENOTEMPTY':
      return 'Directory not empty';
    case 'EINVAL':
      return 'Invalid argument';
  }
};

export type Flavor = 'gnu' | 'bsd';

/** Error wording differs between GNU coreutils (Linux) and BSD userland (macOS). */
type Messages = {
  readonly shell: string;
  readonly cd: (what: 'missing' | 'notdir', target: string) => string;
  readonly lsMissing: (t: string) => string;
  readonly lsMissingExit: number;
  readonly mkdir: (d: string, err: string) => string;
  readonly touch: (f: string, err: string) => string;
  readonly rm: (f: string, e: VfsError) => string;
  readonly rmRoot: string;
  readonly cpStat: (s: string) => string;
  readonly cpDir: (s: string) => string;
  readonly mvStat: (s: string, d: string) => string;
  readonly owner: string;
  readonly colour: boolean;
  readonly missingOperand: (cmd: string) => string;
};

const MESSAGES: Record<Flavor, Messages> = {
  gnu: {
    shell: 'bash',
    cd: (what, t) => `bash: cd: ${t}: ${what === 'missing' ? 'No such file or directory' : 'Not a directory'}`,
    lsMissing: (t) => `ls: cannot access '${t}': No such file or directory`,
    lsMissingExit: 2,
    mkdir: (d, err) => `mkdir: cannot create directory '${d}': ${err}`,
    touch: (f, err) => `touch: cannot touch '${f}': ${err}`,
    rm: (f, e) => `rm: cannot remove '${f}': ${errText(e)}`,
    rmRoot: "rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe",
    cpStat: (s) => `cp: cannot stat '${s}': No such file or directory`,
    cpDir: (s) => `cp: -r not specified; omitting directory '${s}'`,
    mvStat: (s) => `mv: cannot stat '${s}': No such file or directory`,
    owner: 'you you  ',
    colour: true,
    missingOperand: (cmd) => `${cmd}: missing operand\nTry '${cmd} --help' for more information.`,
  },
  bsd: {
    shell: 'zsh',
    cd: (what, t) => `cd: ${what === 'missing' ? 'no such file or directory' : 'not a directory'}: ${t}`,
    lsMissing: (t) => `ls: ${t}: No such file or directory`,
    lsMissingExit: 1,
    mkdir: (d, err) => `mkdir: ${d}: ${err}`,
    touch: (f, err) => `touch: ${f}: ${err}`,
    rm: (f, e) => `rm: ${f}: ${e.code === 'EISDIR' ? 'is a directory' : errText(e)}`,
    rmRoot: 'rm: "/" may not be removed',
    cpStat: (s) => `cp: ${s}: No such file or directory`,
    cpDir: (s) => `cp: ${s} is a directory (not copied).`,
    mvStat: (s, d) => `mv: rename ${s} to ${d}: No such file or directory`,
    owner: 'you  staff',
    colour: false,
    missingOperand: (cmd) => `usage: ${cmd} [options] file ...`,
  },
};

const resolve = (raw: string, state: MachineState): Path => parsePosixPath(raw, state) ?? state.cwd;

/** Write `content` to a file for `>` / `>>` redirects. */
export const redirectWrite = (
  state: MachineState,
  target: string,
  content: string,
  append: boolean,
  shell = 'bash',
): { state: MachineState; error?: string } => {
  const path = resolve(target, state);
  const r = writeFile(state.root, path, content, { append });
  if (!r.ok) return { state, error: `${shell}: ${target}: ${errText(r.error)}` };
  return { state: { ...state, root: r.value } };
};

export const redirectRead = (state: MachineState, target: string, shell = 'bash'): { text: string } | { error: string } => {
  const r = readFile(state.root, resolve(target, state));
  if (!r.ok) return { error: `${shell}: ${target}: ${errText(r.error)}` };
  return { text: r.value };
};


export const posixCommands = (flavor: Flavor): Readonly<Record<string, CommandHandler>> => {
  const M = MESSAGES[flavor];

type Body = (
  parsed: ParsedArgs,
  state: MachineState,
  input: PipeInput,
  ctx: CommandContext,
) => CommandResult;

const withFlags =
  (cmd: string, spec: FlagSpec, body: Body): CommandHandler =>
  (args, input, state, ctx) => {
    const parsed = parseFlags(cmd, args, spec, flavor);
    if (!parsed.ok) return result(state, { stderr: parsed.error, exitCode: 2 });
    return body(parsed.args, state, input, ctx);
  };

// ---------- navigation ----------

const pwd: CommandHandler = (_args, _input, state) => result(state, { stdout: formatPosixPath(state.cwd) + '\n' });

const cd: CommandHandler = (args, _input, state) => {
  const operands = args.filter((a) => a !== '--');
  if (operands.length > 1) return result(state, { stderr: `${M.shell}: cd: too many arguments` });
  const target = operands[0];
  if (target === undefined || target === '~') return result({ ...state, cwd: state.home });
  if (target === '-') {
    const old = state.env['OLDPWD'];
    if (old === undefined) return result(state, { stderr: `${M.shell}: cd: OLDPWD not set` });
    const p = resolve(old, state);
    return result({ ...state, cwd: p, env: { ...state.env, OLDPWD: formatPosixPath(state.cwd) } }, { stdout: old + '\n' });
  }
  const path = resolve(target, state);
  const node = getNode(state.root, path);
  if (!node.ok) return result(state, { stderr: M.cd('missing', target) });
  if (node.value.kind !== 'dir') return result(state, { stderr: M.cd('notdir', target) });
  return result({ ...state, cwd: path, env: { ...state.env, OLDPWD: formatPosixPath(state.cwd), PWD: formatPosixPath(path) } });
};

// ---------- listing ----------

const MONTH = 'Nov 16';

const longLine = (name: string, node: VNode, tty: boolean, M: Messages): string => {
  const isDir = node.kind === 'dir';
  const exec = node.kind === 'file' && node.executable === true;
  const mode = isDir ? 'drwxr-xr-x' : exec ? '-rwxr-xr-x' : '-rw-r--r--';
  const links = isDir ? String(2 + Object.values(node.children).filter((c) => c.kind === 'dir').length) : '1';
  const size = isDir ? 4096 : node.content.length;
  return `${mode} ${links.padStart(2)} ${M.owner} ${String(size).padStart(5)} ${MONTH} 18:00 ${colour(name, node, tty && M.colour)}`;
};

const colour = (name: string, node: VNode, tty: boolean): string => {
  if (!tty) return name;
  if (node.kind === 'dir') return BLUE + name + RESET;
  if (node.executable) return GREEN + name + RESET;
  return name;
};

const sizeOf = (node: VNode): number => (node.kind === 'dir' ? 4096 : node.content.length);

const ls = withFlags('ls', { short: 'alAhrRS1dt', long: { all: 'a', 'almost-all': 'A', reverse: 'r', recursive: 'R' } }, ({ flags, operands }, state, _input, ctx) => {
  const showAll = flags.has('a');
  const showAlmost = flags.has('A');
  const long = flags.has('l');
  const onePer = flags.has('1') || !ctx.tty;
  const targets = operands.length > 0 ? operands : ['.'];
  const out: string[] = [];
  const errs: string[] = [];
  let exitCode = 0;

  const render = (entries: (readonly [string, VNode])[]): string => {
    let list = entries;
    if (flags.has('S')) list = [...list].sort(([, a], [, b]) => sizeOf(b) - sizeOf(a));
    if (flags.has('r')) list = [...list].reverse();
    if (list.length === 0) return '';
    if (long) {
      const total = list.reduce((n, [, node]) => n + Math.ceil(sizeOf(node) / 1024) * 4, 0);
      return `total ${total}\n` + list.map(([n, node]) => longLine(n, node, ctx.tty, M)).join('\n') + '\n';
    }
    const names = list.map(([n, node]) => colour(n, node, ctx.tty && M.colour));
    return names.join(onePer ? '\n' : '  ') + '\n';
  };

  const fileTargets: (readonly [string, VNode])[] = [];
  const dirTargets: (readonly [string, DirNode, Path])[] = [];
  for (const t of targets) {
    const path = resolve(t, state);
    const node = getNode(state.root, path);
    if (!node.ok) {
      errs.push(M.lsMissing(t));
      exitCode = M.lsMissingExit;
      continue;
    }
    if (node.value.kind === 'dir' && !flags.has('d')) dirTargets.push([t, node.value, path]);
    else fileTargets.push([t, node.value]);
  }
  if (fileTargets.length > 0) out.push(render(fileTargets));
  const multi = targets.length > 1;
  dirTargets.forEach(([label, node, path], i) => {
    const listed = listDir(state.root, path);
    let entries: (readonly [string, VNode])[] = listed.ok ? [...listed.value] : [];
    if (!showAll && !showAlmost) entries = entries.filter(([n]) => !n.startsWith('.'));
    if (showAll) {
      const parent = getNode(state.root, path.slice(0, -1));
      entries = [['.', node], ['..', parent.ok ? parent.value : node], ...entries];
    }
    const body = render(entries);
    if (multi || flags.has('R')) out.push((i > 0 || fileTargets.length > 0 ? '\n' : '') + `${label}:\n` + body);
    else out.push(body);
  });
  return result(state, { stdout: out.join(''), stderr: errs.join('\n'), exitCode });
});

// ---------- files ----------

const cat = withFlags('cat', { short: 'n', long: { number: 'n' } }, ({ flags, operands }, state, input) => {
  if (operands.length === 0) return result(state, { stdout: inputText(input) ?? '' });
  let stdout = '';
  const errs: string[] = [];
  for (const f of operands) {
    const r = readFile(state.root, resolve(f, state));
    if (!r.ok) errs.push(`cat: ${f}: ${errText(r.error)}`);
    else stdout += r.value;
  }
  if (flags.has('n')) {
    const lines = stdout.split('\n');
    const trailing = lines[lines.length - 1] === '' ? lines.pop() : undefined;
    stdout = lines.map((l, i) => `${String(i + 1).padStart(6)}\t${l}`).join('\n') + (trailing === '' ? '\n' : '');
  }
  return result(state, { stdout, stderr: errs.join('\n'), exitCode: errs.length ? 1 : 0 });
});

const echo: CommandHandler = (args, _input, state) => {
  let a = args;
  let newline = true;
  while (a[0] === '-n' || a[0] === '-e' || a[0] === '-E') {
    if (a[0] === '-n') newline = false;
    a = a.slice(1);
  }
  return result(state, { stdout: a.join(' ') + (newline ? '\n' : '') });
};

const mkdirCmd = withFlags('mkdir', { short: 'pv', long: { parents: 'p', verbose: 'v' } }, ({ flags, operands }, state) => {
  if (operands.length === 0) return result(state, { stderr: M.missingOperand('mkdir') });
  let s = state;
  const errs: string[] = [];
  for (const d of operands) {
    const r = mkdir(s.root, resolve(d, s), { parents: flags.has('p') });
    if (!r.ok) errs.push(M.mkdir(d, errText(r.error)));
    else s = { ...s, root: r.value };
  }
  return result(s, { stderr: errs.join('\n') });
});

const touchCmd: CommandHandler = (args, _input, state) => {
  const operands = args.filter((a) => !a.startsWith('-'));
  if (operands.length === 0) return result(state, { stderr: M.missingOperand('touch') });
  let s = state;
  const errs: string[] = [];
  for (const f of operands) {
    const r = touch(s.root, resolve(f, s));
    if (!r.ok) errs.push(M.touch(f, errText(r.error)));
    else s = { ...s, root: r.value };
  }
  return result(s, { stderr: errs.join('\n') });
};

const rm = withFlags('rm', { short: 'rRfiv', long: { recursive: 'r', force: 'f', verbose: 'v' } }, ({ flags, operands }, state) => {
  const recursive = flags.has('r') || flags.has('R');
  const force = flags.has('f');
  if (operands.length === 0) {
    if (force) return result(state);
    return result(state, { stderr: M.missingOperand('rm') });
  }
  let s = state;
  const errs: string[] = [];
  for (const f of operands) {
    const path = resolve(f, s);
    if (path.length === 0 || f === '/') {
      errs.push(M.rmRoot);
      continue;
    }
    if (f === '.' || f === '..' || f.endsWith('/.') || f.endsWith('/..')) {
      errs.push(`rm: refusing to remove '.' or '..' directory: skipping '${f}'`);
      continue;
    }
    const r = remove(s.root, path, { recursive });
    if (!r.ok) {
      if (r.error.code === 'ENOENT' && force) continue;
      errs.push(M.rm(f, r.error));
    } else s = { ...s, root: r.value };
  }
  return result(s, { stderr: errs.join('\n') });
});

const rmdirCmd: CommandHandler = (args, _input, state) => {
  const operands = args.filter((a) => !a.startsWith('-'));
  if (operands.length === 0) return result(state, { stderr: "rmdir: missing operand\nTry 'rmdir --help' for more information." });
  let s = state;
  const errs: string[] = [];
  for (const d of operands) {
    const r = rmdir(s.root, resolve(d, s));
    if (!r.ok) errs.push(`rmdir: failed to remove '${d}': ${errText(r.error)}`);
    else s = { ...s, root: r.value };
  }
  return result(s, { stderr: errs.join('\n') });
};

const cp = withFlags('cp', { short: 'rRvfi', long: { recursive: 'r', verbose: 'v', force: 'f' } }, ({ flags, operands }, state) => {
  if (operands.length < 2) {
    return result(state, {
      stderr: operands.length === 0 ? "cp: missing file operand\nTry 'cp --help' for more information." : `cp: missing destination file operand after '${operands[0] ?? ''}'\nTry 'cp --help' for more information.`,
    });
  }
  const recursive = flags.has('r') || flags.has('R');
  const dest = operands[operands.length - 1] ?? '';
  const sources = operands.slice(0, -1);
  const destPath = resolve(dest, state);
  const destNode = getNode(state.root, destPath);
  if (sources.length > 1 && (!destNode.ok || destNode.value.kind !== 'dir')) {
    return result(state, { stderr: `cp: target '${dest}': Not a directory` });
  }
  let s = state;
  const errs: string[] = [];
  for (const src of sources) {
    const srcPath = resolve(src, s);
    const node = getNode(s.root, srcPath);
    if (!node.ok) {
      errs.push(M.cpStat(src));
      continue;
    }
    if (node.value.kind === 'dir' && !recursive) {
      errs.push(M.cpDir(src));
      continue;
    }
    const r = copy(s.root, srcPath, destPath, { recursive });
    if (!r.ok) {
      if (r.error.code === 'EINVAL') errs.push(`cp: cannot copy a directory, '${src}', into itself, '${dest}'`);
      else errs.push(`cp: cannot create regular file '${dest}': ${errText(r.error)}`);
    } else s = { ...s, root: r.value };
  }
  return result(s, { stderr: errs.join('\n') });
});

const mv = withFlags('mv', { short: 'vfin', long: { verbose: 'v', force: 'f' } }, ({ operands }, state) => {
  if (operands.length < 2) {
    return result(state, {
      stderr: operands.length === 0 ? "mv: missing file operand\nTry 'mv --help' for more information." : `mv: missing destination file operand after '${operands[0] ?? ''}'\nTry 'mv --help' for more information.`,
    });
  }
  const dest = operands[operands.length - 1] ?? '';
  const sources = operands.slice(0, -1);
  const destPath = resolve(dest, state);
  const destNode = getNode(state.root, destPath);
  if (sources.length > 1 && (!destNode.ok || destNode.value.kind !== 'dir')) {
    return result(state, { stderr: `mv: target '${dest}': Not a directory` });
  }
  let s = state;
  const errs: string[] = [];
  for (const src of sources) {
    const srcPath = resolve(src, s);
    if (!getNode(s.root, srcPath).ok) {
      errs.push(M.mvStat(src, dest));
      continue;
    }
    const r = move(s.root, srcPath, destPath);
    if (!r.ok) {
      if (r.error.code === 'EINVAL') errs.push(`mv: cannot move '${src}' to a subdirectory of itself, '${dest}'`);
      else errs.push(`mv: cannot move '${src}' to '${dest}': ${errText(r.error)}`);
    } else s = { ...s, root: r.value };
  }
  return result(s, { stderr: errs.join('\n') });
});

const clear: CommandHandler = (_args, _input, state) => result(state, { effects: [{ kind: 'clear' }] });

const whoami: CommandHandler = (_args, _input, state) => result(state, { stdout: (state.env['USER'] ?? 'you') + '\n' });

const exit: CommandHandler = (_args, _input, state) =>
  result(state, { stdout: "You can't leave. You have a streak.\n", effects: [{ kind: 'easterEgg', id: 'exit' }] });

  return {
  pwd,
  cd,
  ls,
  cat,
  echo,
  mkdir: mkdirCmd,
  touch: touchCmd,
  rm,
  rmdir: rmdirCmd,
  cp,
  mv,
  clear,
  whoami,
  exit,
};
};

export const bashCommands = posixCommands('gnu');
