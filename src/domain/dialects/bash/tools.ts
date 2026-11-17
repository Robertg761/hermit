import type { MachineState, VNode } from '../../types';
import { getNode, readFile, type Path } from '../../vfs/vfs';
import { inputText, result, type CommandHandler } from '../dialect';
import { parseFlags, type FlagSpec, type ParsedArgs } from './flags';
import { parsePosixPath } from './paths';
import type { Flavor } from './commands';

/**
 * Text and process tools for Units 3 to 5: grep, find, head, tail, wc, sort, uniq,
 * ps, pgrep, kill, pkill and chmod. GNU (Linux) and BSD (macOS) wording differ.
 */

const resolve = (raw: string, state: MachineState): Path => parsePosixPath(raw, state) ?? state.cwd;

/** Split text into lines, without a phantom empty line after the final newline. */
const linesOf = (text: string): string[] => {
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
};

const joinLines = (lines: readonly string[]): string => (lines.length === 0 ? '' : lines.join('\n') + '\n');

/** Basic regular expressions: `.`, `*`, `^`, `$`, `[...]` are special; `+ ? ( ) { } |` are literal. */
const breToRegExp = (pattern: string, ignoreCase: boolean): RegExp | null => {
  let src = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i] ?? '';
    if (c === '\\' && i + 1 < pattern.length) {
      const n = pattern[i + 1] ?? '';
      src += /[+?(){}|]/.test(n) ? n : `\\${n}`;
      i++;
    } else if ('+?(){}|'.includes(c)) src += `\\${c}`;
    else src += c;
  }
  try {
    return new RegExp(src, ignoreCase ? 'i' : '');
  } catch {
    return null;
  }
};

export const posixTools = (flavor: Flavor): Readonly<Record<string, CommandHandler>> => {
  const gnu = flavor === 'gnu';
  const q = (s: string): string => (gnu ? `'${s}'` : s);

  const withFlags =
    (cmd: string, spec: FlagSpec, body: (p: ParsedArgs, state: MachineState, input: Parameters<CommandHandler>[1]) => ReturnType<CommandHandler>): CommandHandler =>
    (args, input, state) => {
      const parsed = parseFlags(cmd, args, spec, flavor);
      if (!parsed.ok) return result(state, { stderr: parsed.error, exitCode: 2 });
      return body(parsed.args, state, input);
    };

  /** Read operands, or stdin when there are none. */
  const readSources = (cmd: string, operands: readonly string[], state: MachineState, input: Parameters<CommandHandler>[1]) => {
    const sources: { name: string | null; text: string }[] = [];
    const errs: string[] = [];
    if (operands.length === 0) sources.push({ name: null, text: inputText(input) ?? '' });
    for (const f of operands) {
      const r = readFile(state.root, resolve(f, state));
      if (r.ok) sources.push({ name: f, text: r.value });
      else errs.push(`${cmd}: ${gnu && r.error.code === 'ENOENT' ? `cannot open ${q(f)} for reading` : f}: ${r.error.code === 'EISDIR' ? 'Is a directory' : 'No such file or directory'}`);
    }
    return { sources, errs };
  };

  // ---------- grep ----------

  const grep = withFlags('grep', { short: 'rRinvclhHwFaIE', long: { recursive: 'r', 'ignore-case': 'i', 'line-number': 'n', 'invert-match': 'v', count: 'c', 'files-with-matches': 'l' } }, ({ flags, operands }, state, input) => {
    const [pattern, ...files] = operands;
    if (pattern === undefined) {
      return result(state, { stderr: gnu ? "Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information." : 'usage: grep [-rinvclhHw] [pattern] [file ...]', exitCode: 2 });
    }
    const ignoreCase = flags.has('i');
    const re = flags.has('F') ? null : breToRegExp(flags.has('w') ? `\\b${pattern}\\b` : pattern, ignoreCase);
    const test = (line: string): boolean => {
      const hit = re === null ? (ignoreCase ? line.toLowerCase().includes(pattern.toLowerCase()) : line.includes(pattern)) : re.test(line);
      return flags.has('v') ? !hit : hit;
    };
    const recursive = flags.has('r') || flags.has('R');
    const targets: { name: string | null; text: string }[] = [];
    const errs: string[] = [];
    if (files.length === 0 && !recursive) targets.push({ name: null, text: inputText(input) ?? '' });
    const roots = files.length === 0 && recursive ? ['.'] : files;
    for (const f of roots) {
      const path = resolve(f, state);
      const node = getNode(state.root, path);
      if (!node.ok) {
        errs.push(`grep: ${f}: No such file or directory`);
        continue;
      }
      if (node.value.kind === 'dir') {
        if (!recursive) {
          errs.push(`grep: ${f}: Is a directory`);
          continue;
        }
        const visit = (dirName: string, dir: VNode): void => {
          if (dir.kind !== 'dir') return;
          for (const [name, child] of Object.entries(dir.children).sort(([a], [b]) => a.localeCompare(b))) {
            const shown = files.length === 0 && dirName === '.' ? name : `${dirName.replace(/\/$/, '')}/${name}`;
            if (child.kind === 'dir') visit(shown, child);
            else targets.push({ name: shown, text: child.content });
          }
        };
        visit(f, node.value);
      } else targets.push({ name: f, text: node.value.content });
    }
    const showName = flags.has('H') || (!flags.has('h') && (recursive || targets.length > 1));
    const out: string[] = [];
    let matched = false;
    for (const t of targets) {
      const lines = linesOf(t.text);
      const hits = lines.map((l, i) => [l, i + 1] as const).filter(([l]) => test(l));
      if (hits.length > 0) matched = true;
      const prefix = showName && t.name !== null ? `${t.name}:` : '';
      if (flags.has('l')) {
        if (hits.length > 0) out.push(t.name ?? '(standard input)');
      } else if (flags.has('c')) out.push(`${prefix}${hits.length}`);
      else for (const [l, n] of hits) out.push(`${prefix}${flags.has('n') ? `${n}:` : ''}${l}`);
    }
    return result(state, { stdout: joinLines(out), stderr: errs.join('\n'), exitCode: errs.length > 0 ? 2 : matched ? 0 : 1 });
  });

  // ---------- find ----------

  const find: CommandHandler = (args, _input, state) => {
    const starts: string[] = [];
    let i = 0;
    while (i < args.length && !(args[i] ?? '').startsWith('-')) starts.push(args[i++] ?? '');
    if (starts.length === 0) {
      if (!gnu) return result(state, { stderr: 'usage: find [-H | -L | -P] [-EXdsx] [-f path] path ... [expression]', exitCode: 1 });
      starts.push('.');
    }
    let name: { glob: string; ci: boolean } | null = null;
    let type: 'f' | 'd' | null = null;
    for (; i < args.length; i++) {
      const a = args[i] ?? '';
      const v = args[i + 1];
      if (a === '-name' || a === '-iname') {
        if (v === undefined) return result(state, { stderr: `find: missing argument to \`${a}'`, exitCode: 1 });
        name = { glob: v, ci: a === '-iname' };
        i++;
      } else if (a === '-type') {
        if (v !== 'f' && v !== 'd') return result(state, { stderr: `find: Unknown argument to -type: ${v ?? ''}`, exitCode: 1 });
        type = v;
        i++;
      } else if (a === '-print') {
        continue;
      } else {
        return result(state, { stderr: gnu ? `find: unknown predicate \`${a}'` : `find: ${a}: unknown primary or operator`, exitCode: 1 });
      }
    }
    const nameRe = name === null ? null : globRe(name.glob, name.ci);
    const out: string[] = [];
    const errs: string[] = [];
    for (const start of starts) {
      const node = getNode(state.root, resolve(start, state));
      if (!node.ok) {
        errs.push(gnu ? `find: ‘${start}’: No such file or directory` : `find: ${start}: No such file or directory`);
        continue;
      }
      const visit = (shown: string, base: string, n: VNode): void => {
        const okType = type === null || (type === 'd' ? n.kind === 'dir' : n.kind === 'file');
        if (okType && (nameRe === null || nameRe.test(base))) out.push(shown);
        if (n.kind === 'dir') {
          for (const [child, c] of Object.entries(n.children).sort(([a], [b]) => a.localeCompare(b))) visit(`${shown.replace(/\/$/, '')}/${child}`, child, c);
        }
      };
      const base = start === '.' || start === '/' ? start : (start.replace(/\/$/, '').split('/').pop() ?? start);
      visit(start, base, node.value);
    }
    return result(state, { stdout: joinLines(out), stderr: errs.join('\n'), exitCode: errs.length > 0 ? 1 : 0 });
  };

  // ---------- head and tail ----------

  /** `head -5` is old-style for `head -n 5`. */
  const legacyCount = (args: readonly string[]): string[] => args.map((a) => (/^-\d+$/.test(a) ? `-n${a.slice(1)}` : a));

  const headTail = (cmd: 'head' | 'tail'): CommandHandler => {
    const inner = withFlags(cmd, { short: 'fqv', shortValue: 'nc', long: { lines: 'n', follow: 'f' } }, ({ values, operands }, state, input) => {
      const nRaw = values['n'] ?? '10';
      const count = Number(nRaw.replace(/^[+-]/, ''));
      if (!Number.isInteger(count)) {
        return result(state, { stderr: gnu ? `${cmd}: invalid number of lines: ${q(nRaw)}` : `${cmd}: illegal line count -- ${nRaw}`, exitCode: 1 });
      }
      const { sources, errs } = readSources(cmd, operands, state, input);
      const multi = sources.length + errs.length > 1;
      const parts = sources.map((s, i) => {
        const lines = linesOf(s.text);
        // `tail -n +11` starts at line 11 instead of counting from the end.
        const fromStart = cmd === 'tail' && nRaw.startsWith('+');
        const slice = cmd === 'head' ? lines.slice(0, count) : fromStart ? lines.slice(Math.max(0, count - 1)) : lines.slice(Math.max(0, lines.length - count));
        const header = multi && s.name !== null ? `${i > 0 ? '\n' : ''}==> ${s.name} <==\n` : '';
        return header + joinLines(slice);
      });
      return result(state, { stdout: parts.join(''), stderr: errs.join('\n'), exitCode: errs.length > 0 ? 1 : 0 });
    });
    return (args, input, state, ctx) => inner(legacyCount(args), input, state, ctx);
  };

  // ---------- wc ----------

  const wc = withFlags('wc', { short: 'lwcm', long: { lines: 'l', words: 'w', bytes: 'c', chars: 'm' } }, ({ flags, operands }, state, input) => {
    const { sources, errs } = readSources('wc', operands, state, input);
    const want = { l: flags.has('l'), w: flags.has('w'), c: flags.has('c') || flags.has('m') };
    if (!want.l && !want.w && !want.c) {
      want.l = true;
      want.w = true;
      want.c = true;
    }
    const counts = sources.map((s) => {
      const nums: number[] = [];
      if (want.l) nums.push((s.text.match(/\n/g) ?? []).length);
      if (want.w) nums.push(s.text.split(/\s+/).filter((w) => w !== '').length);
      if (want.c) nums.push(s.text.length);
      return { name: s.name, nums };
    });
    if (counts.length > 1) {
      const total = counts[0]?.nums.map((_, k) => counts.reduce((sum, c) => sum + (c.nums[k] ?? 0), 0)) ?? [];
      counts.push({ name: 'total', nums: total });
    }
    const single = counts.length === 1 && (counts[0]?.nums.length ?? 0) === 1;
    const width = gnu ? (single ? 0 : Math.max(...counts.flatMap((c) => c.nums.map((n) => String(n).length)))) : 8;
    const lines = counts.map((c) => {
      const nums = c.nums.map((n) => String(n).padStart(width)).join(gnu ? ' ' : '');
      return c.name === null ? nums : `${nums} ${c.name}`;
    });
    return result(state, { stdout: joinLines(lines), stderr: errs.join('\n'), exitCode: errs.length > 0 ? 1 : 0 });
  });

  // ---------- sort and uniq ----------

  const sort = withFlags('sort', { short: 'rnuf', long: { reverse: 'r', 'numeric-sort': 'n', unique: 'u', 'ignore-case': 'f' } }, ({ flags, operands }, state, input) => {
    const { sources, errs } = readSources('sort', operands, state, input);
    if (errs.length > 0) return result(state, { stderr: errs.map((e) => e.replace(/^sort: cannot open/, 'sort: cannot read:')).join('\n'), exitCode: 2 });
    let lines = sources.flatMap((s) => linesOf(s.text));
    const fold = flags.has('f');
    const key = (s: string): string => (fold ? s.toLowerCase() : s);
    lines.sort((a, b) => {
      if (flags.has('n')) return (parseFloat(a) || 0) - (parseFloat(b) || 0) || a.localeCompare(b);
      // GNU sort in a UTF-8 locale compares case-insensitively first, like localeCompare.
      return key(a).localeCompare(key(b), 'en');
    });
    if (flags.has('r')) lines.reverse();
    if (flags.has('u')) lines = lines.filter((l, i) => i === 0 || key(l) !== key(lines[i - 1] ?? ''));
    return result(state, { stdout: joinLines(lines) });
  });

  const uniq = withFlags('uniq', { short: 'cdui' }, ({ flags, operands }, state, input) => {
    const { sources, errs } = readSources('uniq', operands.slice(0, 1), state, input);
    if (errs.length > 0) return result(state, { stderr: errs.join('\n'), exitCode: 1 });
    const lines = sources.flatMap((s) => linesOf(s.text));
    const same = (a: string, b: string): boolean => (flags.has('i') ? a.toLowerCase() === b.toLowerCase() : a === b);
    const groups: { line: string; n: number }[] = [];
    for (const l of lines) {
      const last = groups[groups.length - 1];
      if (last !== undefined && same(last.line, l)) last.n++;
      else groups.push({ line: l, n: 1 });
    }
    const kept = groups.filter((g) => (flags.has('d') ? g.n > 1 : flags.has('u') ? g.n === 1 : true));
    const out = kept.map((g) => (flags.has('c') ? `${String(g.n).padStart(7)} ${g.line}` : g.line));
    return result(state, { stdout: joinLines(out) });
  });

  // ---------- processes ----------

  const ps: CommandHandler = (args, _input, state) => {
    const full = args.some((a) => /^-?(aux|ef|e|A)$/.test(a));
    const procs = full ? state.processes : state.processes.filter((p) => p.pid !== 1);
    if (!full) {
      const head = gnu ? '    PID TTY          TIME CMD' : '  PID TTY           TIME CMD';
      const rows = [{ pid: 2001, name: gnu ? 'bash' : '-zsh' }, ...procs.filter((p) => p.pid > 1000), { pid: 2002, name: 'ps' }];
      return result(state, { stdout: joinLines([head, ...rows.map((p) => `${String(p.pid).padStart(gnu ? 7 : 5)} pts/0    00:00:00 ${p.name}`)]) });
    }
    const head = gnu
      ? 'USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND'
      : 'USER               PID  %CPU %MEM      VSZ    RSS   TT  STAT STARTED      TIME COMMAND';
    const rows = procs.map((p) => {
      const user = p.admin === true ? 'root' : 'you';
      const cpu = p.cpu.toFixed(1);
      return gnu
        ? `${user.padEnd(10)} ${String(p.pid).padStart(5)} ${cpu.padStart(4)}  0.4 123456  9876 ?        S    18:00   0:01 ${p.name}`
        : `${user.padEnd(16)} ${String(p.pid).padStart(5)} ${cpu.padStart(5)}  0.4  1234567  12345   ??  S     6:00PM   0:01.00 ${p.name}`;
    });
    return result(state, { stdout: joinLines([head, ...rows]) });
  };

  const pgrep = withFlags('pgrep', { short: 'lfaix' }, ({ flags, operands }, state) => {
    const [pattern] = operands;
    if (pattern === undefined) return result(state, { stderr: gnu ? 'pgrep: no matching criteria specified\nTry `pgrep --help\' for more information.' : 'usage: pgrep [-lfaix] pattern ...', exitCode: 2 });
    const re = breToRegExp(pattern, flags.has('i'));
    const hits = state.processes.filter((p) => (flags.has('x') ? p.name === pattern : (re?.test(p.name) ?? false)));
    const out = hits.map((p) => (flags.has('l') || flags.has('a') ? `${p.pid} ${p.name}` : String(p.pid)));
    return result(state, { stdout: joinLines(out), exitCode: hits.length > 0 ? 0 : 1 });
  });

  const kill: CommandHandler = (args, _input, state) => {
    const targets = args.filter((a) => !/^-(\d+|[A-Z]+|s)$/.test(a) && a !== 'KILL' && a !== 'TERM');
    if (targets.length === 0) {
      return result(state, { stderr: gnu ? 'kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]' : 'kill: not enough arguments', exitCode: gnu ? 2 : 1 });
    }
    let procs = state.processes;
    const errs: string[] = [];
    for (const t of targets) {
      const pid = Number(t);
      if (!Number.isInteger(pid)) {
        errs.push(gnu ? `bash: kill: ${t}: arguments must be process or job IDs` : `kill: illegal pid: ${t}`);
        continue;
      }
      if (procs.some((p) => p.pid === pid && p.admin === true) && !state.isAdmin) {
        errs.push(gnu ? `bash: kill: (${pid}) - Operation not permitted` : `kill: kill ${pid} failed: operation not permitted`);
        continue;
      }
      if (!procs.some((p) => p.pid === pid)) {
        errs.push(gnu ? `bash: kill: (${pid}) - No such process` : `kill: kill ${pid} failed: no such process`);
        continue;
      }
      procs = procs.filter((p) => p.pid !== pid);
    }
    return result({ ...state, processes: procs }, { stderr: errs.join('\n'), exitCode: errs.length > 0 ? 1 : 0 });
  };

  const pkill = withFlags('pkill', { short: 'fix' }, ({ flags, operands }, state) => {
    const [pattern] = operands;
    if (pattern === undefined) return result(state, { stderr: gnu ? 'pkill: no matching criteria specified' : 'usage: pkill [-signal] [-fix] pattern ...', exitCode: 2 });
    const re = breToRegExp(pattern, flags.has('i'));
    const hit = (name: string): boolean => (flags.has('x') ? name === pattern : (re?.test(name) ?? false));
    const matches = state.processes.filter((p) => hit(p.name));
    const victims = matches.filter((p) => p.admin !== true || state.isAdmin);
    const denied = matches.filter((p) => !victims.includes(p));
    const stderr = denied.map((p) => (gnu ? `pkill: killing pid ${p.pid} failed: Operation not permitted` : `pkill: signalling pid ${p.pid}: Operation not permitted`)).join('\n');
    return result({ ...state, processes: state.processes.filter((p) => !victims.includes(p)) }, { stderr, exitCode: victims.length > 0 && denied.length === 0 ? 0 : 1 });
  });

  /** `killall name`: stop every process with exactly that name. */
  const killall: CommandHandler = (args, input, state, ctx) => {
    const names = args.filter((a) => !a.startsWith('-'));
    if (names.length === 0) return result(state, { stderr: gnu ? 'killall: no process name specified' : 'usage: killall [-l] [-v] [-m] [-signal] procname ...', exitCode: 1 });
    let s = state;
    const errs: string[] = [];
    for (const name of names) {
      if (!s.processes.some((p) => p.name === name)) {
        errs.push(gnu ? `${name}: no process found` : `No matching processes belonging to you were found`);
        continue;
      }
      const r = pkill(['-x', name], input, s, ctx);
      s = r.state;
      if (r.stderr) errs.push(r.stderr);
    }
    return result(s, { stderr: errs.join('\n'), exitCode: errs.length > 0 ? 1 : 0 });
  };

  // ---------- permissions ----------

  const chmod: CommandHandler = (args, _input, state) => {
    const [mode, ...files] = args.filter((a) => a !== '-R');
    if (mode === undefined || files.length === 0) {
      return result(state, { stderr: gnu ? `chmod: missing operand${mode === undefined ? '' : ` after ${q(mode)}`}\nTry 'chmod --help' for more information.` : 'usage:\tchmod [-fhv] [-R [-H | -L | -P]] mode file ...', exitCode: 1 });
    }
    let executable: boolean | null;
    if (/^[ugoa]*\+[rwx]*x[rwx]*$/.test(mode)) executable = true;
    else if (/^[ugoa]*-[rwx]*x[rwx]*$/.test(mode)) executable = false;
    else if (/^[0-7]{3,4}$/.test(mode)) executable = (Number(mode.slice(-3, -2)) & 1) === 1;
    else if (/^[ugoa]*=[rwx]*$/.test(mode)) executable = mode.includes('x');
    else if (/^[ugoa]*[+-=][rwx]+$/.test(mode)) executable = null;
    else return result(state, { stderr: gnu ? `chmod: invalid mode: ${q(mode)}\nTry 'chmod --help' for more information.` : `chmod: Invalid file mode: ${mode}`, exitCode: 1 });
    let root = state.root;
    const errs: string[] = [];
    for (const f of files) {
      const path = resolve(f, state);
      const node = getNode(root, path);
      if (!node.ok) {
        errs.push(gnu ? `chmod: cannot access ${q(f)}: No such file or directory` : `chmod: ${f}: No such file or directory`);
        continue;
      }
      if (node.value.kind === 'file' && executable !== null) root = setExecutable(root, path, executable);
    }
    return result({ ...state, root }, { stderr: errs.join('\n'), exitCode: errs.length > 0 ? 1 : 0 });
  };

  return { grep, find, head: headTail('head'), tail: headTail('tail'), wc, sort, uniq, ps, pgrep, kill, pkill, killall, chmod };
};

/** Glob for `find -name`: `*`, `?` and `[...]`, matched against the whole name. */
const globRe = (glob: string, ci: boolean): RegExp => {
  let src = '';
  for (const c of glob) {
    if (c === '*') src += '.*';
    else if (c === '?') src += '.';
    else if (c === '[' || c === ']') src += c;
    else src += c.replace(/[.+^${}()|\\]/g, '\\$&');
  }
  return new RegExp(`^${src}$`, ci ? 'i' : '');
};

const setExecutable = (root: MachineState['root'], path: Path, executable: boolean): MachineState['root'] => {
  const rebuild = (node: VNode, rest: Path): VNode => {
    if (rest.length === 0) return node.kind === 'file' ? { ...node, executable } : node;
    if (node.kind !== 'dir') return node;
    const [head, ...tail] = rest;
    const child = node.children[head ?? ''];
    if (child === undefined || head === undefined) return node;
    return { ...node, children: { ...node.children, [head]: rebuild(child, tail) } };
  };
  const next = rebuild(root, path);
  return next.kind === 'dir' ? next : root;
};

