import type { CommandResult, Effect, MachineState } from '../../types';
import type { CommandHandler, Dialect, PsObject } from '../dialect';
import { inputText, result } from '../dialect';
import { getNode, writeFile, caseInsensitive as ci } from '../../vfs/vfs';
import type { BoundArg } from './binder';
import { bindAndRun, cmdlets, findCmdlet, psAliases } from './cmdlets';
import { formatObjects, getProperty, objectToString } from './format';
import { parsePowerShell, type Arg, type Element, type Expr, type Pipeline, type StatementList } from './parse';
import { formatWinPath, parseWinPath } from './paths';

type Exec = {
  readonly state: MachineState;
  readonly out: readonly PsObject[];
  readonly errors: readonly string[];
  readonly effects: readonly Effect[];
  readonly ok: boolean;
};

const s = (value: string): PsObject => ({ type: 'string', value });

export const notRecognized = (name: string): string =>
  `${name}: The term '${name}' is not recognized as a name of a cmdlet, function, script file, or executable program.\nCheck the spelling of the name, or if a path was included, verify that the path is correct and try again.`;

const NOT_SIMULATED = "Hermit doesn't simulate that part of PowerShell yet. Stick to the commands in the lesson.";

/** Read a variable. `$?` reflects the last statement's success. */
const readVar = (name: string, state: MachineState, lastOk: boolean): readonly PsObject[] => {
  const lower = name.toLowerCase();
  if (lower.startsWith('env:')) {
    const key = name.slice(4);
    const hit = Object.entries(state.env).find(([k]) => k.toLowerCase() === key.toLowerCase());
    return hit === undefined ? [] : [s(hit[1])];
  }
  switch (lower) {
    case 'home':
      return [s(formatWinPath(state.home))];
    case 'pwd':
      return [{ type: 'pathInfo', path: formatWinPath(state.cwd) }];
    case 'profile':
      return [s(`${formatWinPath(state.home)}\\Documents\\PowerShell\\Microsoft.PowerShell_profile.ps1`)];
    case 'true':
      return [s('True')];
    case 'false':
      return [s('False')];
    case 'null':
      return [];
    case '?':
      return [s(lastOk ? 'True' : 'False')];
    default:
      return [];
  }
};

const expandString = (text: string, state: MachineState, lastOk: boolean): string =>
  text.replace(/\$(env:[A-Za-z_][A-Za-z0-9_]*|[A-Za-z_][A-Za-z0-9_]*|\?)/g, (_m, name: string) =>
    readVar(name, state, lastOk).map(objectToString).join(' '),
  );

type Ctx = { state: MachineState; errors: string[]; effects: Effect[]; lastOk: boolean };

const evalExpr = (expr: Expr, ctx: Ctx): readonly PsObject[] => {
  switch (expr.kind) {
    case 'bare':
      return [/^-?\d+$/.test(expr.text) ? { type: 'number', value: Number(expr.text) } : s(expr.text)];
    case 'string':
      return [s(expr.expand ? expandString(expr.text, ctx.state, ctx.lastOk) : expr.text)];
    case 'var':
      return readVar(expr.name, ctx.state, ctx.lastOk);
    case 'array':
      return expr.items.flatMap((e) => evalExpr(e, ctx));
    case 'block':
      return [{ type: 'scriptblock', text: expr.text }];
    case 'sub': {
      const r = runStatements(expr.body, ctx.state, ctx.lastOk);
      ctx.state = r.state;
      ctx.errors.push(...r.errors);
      ctx.effects.push(...r.effects);
      let values = r.out;
      for (const m of expr.members) {
        // Member enumeration: `(Get-ChildItem).Name` maps over every item.
        if (m.toLowerCase() === 'count' && values.length !== 1) {
          values = [{ type: 'number', value: values.length }];
          continue;
        }
        values = values.flatMap((v) => {
          const p = getProperty(v, m);
          return p === null ? [] : [p];
        });
      }
      return values;
    }
  }
};

const evalArgs = (args: readonly Arg[], ctx: Ctx): BoundArg[] =>
  args.map((a): BoundArg =>
    a.kind === 'param'
      ? a.value === undefined
        ? { kind: 'param', name: a.name }
        : { kind: 'param', name: a.name, value: evalExpr(a.value, ctx) }
      : { kind: 'value', value: evalExpr(a.expr, ctx) },
  );

const runElement = (el: Element, input: readonly PsObject[], ctx: Ctx): readonly PsObject[] | null => {
  if (el.kind === 'expr') return evalExpr(el.expr, ctx);
  if (el.kind === 'assign') {
    if (!/^env:/i.test(el.target)) {
      ctx.errors.push(NOT_SIMULATED);
      return null;
    }
    const r = runPipeline(el.value, ctx.state, ctx.lastOk);
    ctx.state = r.state;
    ctx.errors.push(...r.errors);
    const key = el.target.slice(4);
    const existing = Object.keys(ctx.state.env).find((k) => k.toLowerCase() === key.toLowerCase()) ?? key;
    ctx.state = { ...ctx.state, env: { ...ctx.state.env, [existing]: r.out.map(objectToString).join(' ') } };
    return [];
  }
  const cmdlet = findCmdlet(el.name);
  if (cmdlet === undefined) {
    const script = runScript(el.name, ctx.state);
    if (script === null) {
      ctx.errors.push(notRecognized(el.name));
      return null;
    }
    ctx.state = script.state;
    ctx.errors.push(...script.errors);
    ctx.effects.push(...script.effects);
    return script.ok || script.out.length > 0 ? script.out : null;
  }
  const r = bindAndRun(cmdlet, evalArgs(el.args, ctx), input, ctx.state);
  ctx.state = r.state;
  ctx.errors.push(...r.errors);
  if (r.effects) ctx.effects.push(...r.effects);
  return r.out;
};

const SCRIPTS_DISABLED = (path: string, raw: string): string =>
  `${raw}: File ${path} cannot be loaded because running scripts is disabled on this system. For more information, see about_Execution_Policies at https://go.microsoft.com/fwlink/?LinkID=135170.`;

/**
 * `.\build.ps1`: scripts need a path (PowerShell never runs scripts from the current folder by
 * bare name) and an execution policy that allows them. Returns null when there is no such file.
 */
const runScript = (raw: string, state: MachineState): Exec | null => {
  const looksLikePath = /^\.{1,2}[\\/]|[\\/]|^[A-Za-z]:/.test(raw);
  const path = parseWinPath(raw, state);
  if (path === null) return null;
  const node = getNode(state.root, path, ci);
  if (!node.ok || node.value.kind !== 'file') return null;
  const fail = (msg: string): Exec => ({ state, out: [], errors: [msg], effects: [], ok: false });
  if (!looksLikePath) {
    return fail(
      `${notRecognized(raw)}\n\nSuggestion [3,General]: The command "${raw}" was not found, but does exist in the current location. PowerShell does not load commands from the current location by default. If you trust this command, instead type: ".\\${raw}". See "get-help about_Command_Precedence" for more details.`,
    );
  }
  if (!/\.ps1$/i.test(raw)) return null;
  const policy = state.executionPolicy ?? 'Restricted';
  if (policy === 'Restricted' || policy === 'AllSigned') return fail(SCRIPTS_DISABLED(formatWinPath(path), raw));
  let cur = state;
  const out: PsObject[] = [];
  const errors: string[] = [];
  const effects: Effect[] = [];
  let ok = true;
  for (const line of node.value.content.split(/\r?\n/)) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const parsed = parsePowerShell(line);
    if (!parsed.ok) {
      errors.push(`ParserError: ${parsed.error}`);
      ok = false;
      continue;
    }
    const r = runStatements(parsed.list, cur, true);
    cur = r.state;
    out.push(...r.out);
    errors.push(...r.errors);
    effects.push(...r.effects);
    ok = ok && r.ok;
  }
  return { state: cur, out, errors, effects, ok };
};

const runPipeline = (p: Pipeline, state: MachineState, lastOk: boolean): Exec => {
  const ctx: Ctx = { state, errors: [], effects: [], lastOk };
  let objects: readonly PsObject[] = [];
  let stopped = false;
  for (const el of p.elements) {
    const out = runElement(el, objects, ctx);
    if (out === null) {
      stopped = true;
      objects = [];
      break;
    }
    objects = out;
  }
  let errors = ctx.errors;
  for (const r of p.redirects) {
    const target = evalExpr(r.target, ctx).map(objectToString).join(' ');
    const path = parseWinPath(target, ctx.state);
    if (path === null) continue;
    const isErr = r.op.startsWith('2');
    const text = isErr ? (errors.length > 0 ? errors.join('\n') + '\n' : '') : formatObjects(objects);
    const w = writeFile(ctx.state.root, path, text, { append: r.op.endsWith('>>') }, ci);
    if (!w.ok) {
      errors = [...errors, `out-file: Could not find a part of the path '${formatWinPath(path)}'.`];
      continue;
    }
    ctx.state = { ...ctx.state, root: w.value };
    if (isErr) errors = [];
    else objects = [];
  }
  return { state: ctx.state, out: objects, errors, effects: ctx.effects, ok: !stopped && ctx.errors.length === 0 };
};

const runStatements = (list: StatementList, state: MachineState, lastOk: boolean): Exec => {
  let cur = state;
  let ok = lastOk;
  const out: PsObject[] = [];
  const errors: string[] = [];
  const effects: Effect[] = [];
  let first = true;
  for (const { connector, pipeline } of list) {
    if (!first && connector === '&&' && !ok) continue;
    if (!first && connector === '||' && ok) continue;
    first = false;
    const r = runPipeline(pipeline, cur, ok);
    cur = r.state;
    ok = r.ok;
    out.push(...r.out);
    errors.push(...r.errors);
    effects.push(...r.effects);
  }
  return { state: cur, out, errors, effects, ok };
};

export const runPowerShell = (line: string, state: MachineState): CommandResult => {
  if (line.trim() === '') return result(state);
  const parsed = parsePowerShell(line);
  if (!parsed.ok) {
    const msg = parsed.error === 'SCRIPTBLOCK' ? NOT_SIMULATED : `ParserError: ${parsed.error}`;
    return result(state, { stderr: msg + '\n', exitCode: 1 });
  }
  const r = runStatements(parsed.list, state, true);
  return {
    state: r.state,
    stdout: formatObjects(r.out),
    stderr: r.errors.length > 0 ? r.errors.join('\n') + '\n' : '',
    exitCode: r.ok ? 0 : 1,
    effects: r.effects,
  };
};

/** Wrap each cmdlet as a plain string-args handler (used by tests and the Rosetta view). */
const handlerFor =
  (name: string): CommandHandler =>
  (args, input, state) => {
    const cmdlet = findCmdlet(name);
    if (cmdlet === undefined) return result(state, { stderr: notRecognized(name) + '\n', exitCode: 1 });
    const bound = args.map((a): BoundArg => (a.startsWith('-') && a.length > 1 ? { kind: 'param', name: a.slice(1) } : { kind: 'value', value: [s(a)] }));
    const text = inputText(input);
    const objs = input.kind === 'objects' ? input.items : text === null ? [] : text.split('\n').filter((l) => l !== '').map(s);
    const r = bindAndRun(cmdlet, bound, objs, state);
    return {
      state: r.state,
      stdout: formatObjects(r.out),
      stderr: r.errors.length > 0 ? r.errors.join('\n') + '\n' : '',
      exitCode: r.errors.length > 0 ? 1 : 0,
      effects: r.effects ?? [],
    };
  };

const psCommands: Record<string, CommandHandler> = Object.fromEntries(cmdlets.map((c) => [c.name, handlerFor(c.name)]));

export const powershell: Dialect = {
  os: 'windows',
  prompt: (state) => `PS ${formatWinPath(state.cwd)}> `,
  formatPath: formatWinPath,
  parsePath: parseWinPath,
  caseInsensitive: true,
  commands: psCommands,
  aliases: psAliases,
  run: runPowerShell,
};
