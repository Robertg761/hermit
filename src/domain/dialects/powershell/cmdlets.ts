import type { Effect, MachineState, VNode } from '../../types';
import { globMatch, hasGlob } from '../../shell/glob';
import {
  caseInsensitive as ci,
  copy,
  getNode,
  mkdir,
  move,
  remove,
  setNode,
  walk,
  writeFile,
  type Path,
} from '../../vfs/vfs';
import type { PsObject } from '../dialect';
import { bind, has, str, strs, type Bound, type BoundArg, type ParamSpec } from './binder';
import { formatObjects, getProperty, objectToString } from './format';
import { formatWinPath, parseWinPath } from './paths';

export type PsResult = {
  readonly state: MachineState;
  readonly out: readonly PsObject[];
  readonly errors: readonly string[];
  readonly effects?: readonly Effect[];
};

export type Cmdlet = {
  readonly name: string;
  readonly params: readonly ParamSpec[];
  readonly run: (b: Bound, input: readonly PsObject[], state: MachineState) => PsResult;
};

const ok = (state: MachineState, out: readonly PsObject[] = [], effects?: readonly Effect[]): PsResult => ({ state, out, errors: [], ...(effects ? { effects } : {}) });
const fail = (state: MachineState, ...errors: string[]): PsResult => ({ state, out: [], errors });

const resolve = (raw: string, state: MachineState): Path => parseWinPath(raw, state) ?? state.cwd;
const show = (p: Path): string => formatWinPath(p);
const notFound = (cmd: string, p: Path): string => `${cmd}: Cannot find path '${show(p)}' because it does not exist.`;

const fileObject = (path: Path, node: VNode): PsObject => ({
  type: 'file',
  name: path[path.length - 1] ?? '',
  path,
  isDir: node.kind === 'dir',
  length: node.kind === 'file' ? node.content.length : 0,
  hidden: node.hidden === true,
});

/** Resolve a path that may contain wildcards in its last segment. */
const expandPath = (raw: string, state: MachineState): readonly Path[] => {
  const base = raw.replace(/\//g, '\\');
  const idx = base.lastIndexOf('\\');
  const last = base.slice(idx + 1);
  if (!hasGlob(last)) return [resolve(raw, state)];
  const parentRaw = idx === -1 ? '.' : base.slice(0, idx) || '\\';
  const parent = resolve(parentRaw, state);
  const node = getNode(state.root, parent, ci);
  if (!node.ok || node.value.kind !== 'dir') return [];
  return Object.keys(node.value.children)
    .filter((n) => globMatch(last, n, true))
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    .map((n) => [...parent, n]);
};

const sortEntries = (entries: [string, VNode][]): [string, VNode][] =>
  // PowerShell lists folders first, then files, each alphabetically.
  entries.sort(([a, an], [b, bn]) => (an.kind === bn.kind ? a.localeCompare(b, 'en', { sensitivity: 'base' }) : an.kind === 'dir' ? -1 : 1));

const P = {
  path: { name: 'Path', kind: 'value', position: 0, type: 'System.String[]' } as ParamSpec,
  literal: { name: 'LiteralPath', kind: 'value', aliases: ['PSPath', 'LP'], type: 'System.String[]' } as ParamSpec,
  force: { name: 'Force', kind: 'switch' } as ParamSpec,
  recurse: { name: 'Recurse', kind: 'switch' } as ParamSpec,
  filter: { name: 'Filter', kind: 'value' } as ParamSpec,
  include: { name: 'Include', kind: 'value', type: 'System.String[]' } as ParamSpec,
  exclude: { name: 'Exclude', kind: 'value', type: 'System.String[]' } as ParamSpec,
  whatIf: { name: 'WhatIf', kind: 'switch', aliases: ['wi'] } as ParamSpec,
  confirm: { name: 'Confirm', kind: 'switch', aliases: ['cf'] } as ParamSpec,
  passThru: { name: 'PassThru', kind: 'switch' } as ParamSpec,
};

const pathArg = (b: Bound): string | undefined => str(b, 'Path') ?? str(b, 'LiteralPath');

// ---------------- cmdlets ----------------

const getLocation: Cmdlet = {
  name: 'Get-Location',
  params: [{ name: 'PSProvider', kind: 'value' }, { name: 'PSDrive', kind: 'value' }, { name: 'Stack', kind: 'switch' }],
  run: (_b, _i, state) => ok(state, [{ type: 'pathInfo', path: show(state.cwd) }]),
};

const setLocation: Cmdlet = {
  name: 'Set-Location',
  params: [P.path, P.literal, P.passThru],
  run: (b, _i, state) => {
    const raw = pathArg(b);
    if (raw === undefined || raw === '~') return ok({ ...state, cwd: state.home });
    if (raw === '-') {
      const prev = state.env['HERMIT_OLDPWD'];
      if (prev === undefined) return fail(state, 'Set-Location: There is no location history left to navigate backwards.');
      return ok({ ...state, cwd: resolve(prev, state), env: { ...state.env, HERMIT_OLDPWD: show(state.cwd) } });
    }
    const path = resolve(raw, state);
    const node = getNode(state.root, path, ci);
    if (!node.ok || node.value.kind !== 'dir') return fail(state, notFound('Set-Location', path));
    return ok({ ...state, cwd: path, env: { ...state.env, HERMIT_OLDPWD: show(state.cwd) } }, has(b, 'PassThru') ? [{ type: 'pathInfo', path: show(path) }] : []);
  },
};

const getChildItem: Cmdlet = {
  name: 'Get-ChildItem',
  params: [
    P.path,
    P.literal,
    { ...P.filter, position: 1 },
    P.include,
    P.exclude,
    { ...P.recurse, aliases: ['s'] },
    { name: 'Depth', kind: 'value', type: 'System.UInt32' },
    P.force,
    { name: 'Name', kind: 'switch' },
    { name: 'Attributes', kind: 'value', type: 'System.Management.Automation.FlagsExpression`1[System.IO.FileAttributes]' },
    { name: 'Directory', kind: 'switch', aliases: ['ad', 'd'] },
    { name: 'File', kind: 'switch', aliases: ['af'] },
    { name: 'Hidden', kind: 'switch', aliases: ['ah', 'h'] },
    { name: 'ReadOnly', kind: 'switch', aliases: ['ar'] },
    { name: 'System', kind: 'switch', aliases: ['as'] },
    { name: 'FollowSymlink', kind: 'switch' },
  ],
  run: (b, _i, state) => {
    const raws = strs(b, 'Path') ?? strs(b, 'LiteralPath') ?? ['.'];
    const filter = str(b, 'Filter');
    const include = strs(b, 'Include');
    const exclude = strs(b, 'Exclude');
    const force = has(b, 'Force') || has(b, 'Hidden');
    const out: PsObject[] = [];
    const errors: string[] = [];
    const keep = (name: string, node: VNode): boolean => {
      if (node.hidden && !force) return false;
      if (has(b, 'Hidden') && !node.hidden) return false;
      if (has(b, 'Directory') && node.kind !== 'dir') return false;
      if (has(b, 'File') && node.kind !== 'file') return false;
      if (filter !== undefined && !globMatch(filter, name, true)) return false;
      if (include !== undefined && !include.some((g) => globMatch(g, name, true))) return false;
      if (exclude !== undefined && exclude.some((g) => globMatch(g, name, true))) return false;
      return true;
    };
    for (const raw of raws) {
      const paths = expandPath(raw, state);
      if (paths.length === 0 && hasGlob(raw)) continue;
      for (const path of paths) {
        const node = getNode(state.root, path, ci);
        if (!node.ok) {
          errors.push(notFound('Get-ChildItem', path));
          continue;
        }
        if (node.value.kind === 'file') {
          out.push(fileObject(path, node.value));
          continue;
        }
        if (has(b, 'Recurse')) {
          const visit = (dirPath: Path, dir: VNode): void => {
            if (dir.kind !== 'dir') return;
            const entries = sortEntries(Object.entries(dir.children));
            for (const [name, child] of entries) if (keep(name, child)) out.push(fileObject([...dirPath, name], child));
            for (const [name, child] of entries) {
              if (child.kind === 'dir' && (!child.hidden || force)) visit([...dirPath, name], child);
            }
          };
          visit(path, node.value);
        } else {
          for (const [name, child] of sortEntries(Object.entries(node.value.children))) {
            if (keep(name, child)) out.push(fileObject([...path, name], child));
          }
        }
      }
    }
    const result = has(b, 'Name') ? out.map((o): PsObject => ({ type: 'string', value: o.type === 'file' ? o.name : '' })) : out;
    return { state, out: result, errors };
  },
};

const newItem: Cmdlet = {
  name: 'New-Item',
  params: [P.path, { name: 'Name', kind: 'value' }, { name: 'ItemType', kind: 'value', aliases: ['Type'] }, { name: 'Value', kind: 'value', type: 'System.Object' }, P.force, P.whatIf, P.confirm],
  run: (b, input, state) => {
    const raws = strs(b, 'Path') ?? ['.'];
    const name = str(b, 'Name');
    const type = (str(b, 'ItemType') ?? 'File').toLowerCase();
    if (!['file', 'directory', 'dir', 'folder'].includes(type)) {
      return fail(state, `New-Item: The type is not a known type for the file system. Only "file","directory","symboliclink","junction","hardlink" can be specified.`);
    }
    const isDir = type !== 'file';
    const value = str(b, 'Value') ?? (input.length > 0 ? input.map(objectToString).join('\n') : '');
    let s = state;
    const out: PsObject[] = [];
    const errors: string[] = [];
    if (str(b, 'Path') === undefined && name === undefined) {
      return fail(state, "New-Item: Cannot process command because of one or more missing mandatory parameters: Path.");
    }
    for (const raw of raws) {
      const path = name !== undefined ? [...resolve(raw, s), name] : resolve(raw, s);
      const existing = getNode(s.root, path, ci);
      if (existing.ok && !has(b, 'Force')) {
        errors.push(
          existing.value.kind === 'dir' || isDir
            ? `New-Item: An item with the specified name ${show(path)} already exists.`
            : `New-Item: The file '${show(path)}' already exists.`,
        );
        continue;
      }
      if (isDir) {
        const r = mkdir(s.root, path, { parents: true }, ci);
        if (!r.ok) {
          errors.push(`New-Item: Could not find a part of the path '${show(path)}'.`);
          continue;
        }
        s = { ...s, root: r.value };
      } else {
        let root = s.root;
        if (has(b, 'Force')) {
          const parents = mkdir(root, path.slice(0, -1), { parents: true }, ci);
          if (parents.ok) root = parents.value;
        }
        const r = writeFile(root, path, value, {}, ci);
        if (!r.ok) {
          errors.push(`New-Item: Could not find a part of the path '${show(path)}'.`);
          continue;
        }
        s = { ...s, root: r.value };
      }
      const node = getNode(s.root, path, ci);
      if (node.ok) out.push(fileObject(path, node.value));
    }
    return { state: s, out, errors };
  },
};

const getContent: Cmdlet = {
  name: 'Get-Content',
  params: [P.path, P.literal, { name: 'TotalCount', kind: 'value', aliases: ['First', 'Head'], type: 'System.Int64' }, { name: 'Tail', kind: 'value', aliases: ['Last'], type: 'System.Int32' }, { name: 'Raw', kind: 'switch' }, { name: 'ReadCount', kind: 'value' }, { name: 'Encoding', kind: 'value' }],
  run: (b, _i, state) => {
    const raws = strs(b, 'Path') ?? strs(b, 'LiteralPath');
    if (raws === undefined) return fail(state, 'Get-Content: Cannot process command because of one or more missing mandatory parameters: Path.');
    const out: PsObject[] = [];
    const errors: string[] = [];
    for (const raw of raws) {
      for (const path of expandPath(raw, state)) {
        const node = getNode(state.root, path, ci);
        if (!node.ok) {
          errors.push(notFound('Get-Content', path));
          continue;
        }
        if (node.value.kind === 'dir') {
          errors.push(`Get-Content: Unable to get content because it is a directory: '${show(path)}'. Please use 'Get-ChildItem' instead.`);
          continue;
        }
        if (has(b, 'Raw')) {
          out.push({ type: 'string', value: node.value.content });
          continue;
        }
        let lines = node.value.content.replace(/\r\n/g, '\n').split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        const head = str(b, 'TotalCount');
        const tail = str(b, 'Tail');
        if (head !== undefined) lines = lines.slice(0, Math.max(0, Number(head)));
        if (tail !== undefined) lines = lines.slice(Math.max(0, lines.length - Number(tail)));
        out.push(...lines.map((value): PsObject => ({ type: 'string', value })));
      }
    }
    return { state, out, errors };
  },
};

const writeContent = (name: 'Set-Content' | 'Add-Content'): Cmdlet => ({
  name,
  params: [P.path, P.literal, { name: 'Value', kind: 'value', position: 1, type: 'System.Object[]', remaining: true }, P.force, { name: 'NoNewline', kind: 'switch' }, { name: 'Encoding', kind: 'value' }],
  run: (b, input, state) => {
    const raws = strs(b, 'Path') ?? strs(b, 'LiteralPath');
    if (raws === undefined) return fail(state, `${name}: Cannot process command because of one or more missing mandatory parameters: Path.`);
    const values = b.values['Value'] ?? input;
    const text = values.map(objectToString).join('\n') + (has(b, 'NoNewline') ? '' : '\n');
    let s = state;
    const errors: string[] = [];
    for (const raw of raws) {
      const path = resolve(raw, s);
      const r = writeFile(s.root, path, text, { append: name === 'Add-Content' }, ci);
      if (!r.ok) errors.push(r.error.code === 'EISDIR' ? `${name}: Access to the path '${show(path)}' is denied.` : `${name}: Could not find a part of the path '${show(path)}'.`);
      else s = { ...s, root: r.value };
    }
    return { state: s, out: [], errors };
  },
});

const copyItem: Cmdlet = {
  name: 'Copy-Item',
  params: [P.path, P.literal, { name: 'Destination', kind: 'value', position: 1 }, { ...P.recurse }, P.force, { name: 'Container', kind: 'switch' }, P.filter, P.include, P.exclude, P.passThru, P.whatIf, P.confirm],
  run: (b, _i, state) => {
    const raws = strs(b, 'Path') ?? strs(b, 'LiteralPath');
    if (raws === undefined) return fail(state, 'Copy-Item: Cannot process command because of one or more missing mandatory parameters: Path.');
    const destRaw = str(b, 'Destination') ?? '.';
    let s = state;
    const errors: string[] = [];
    for (const raw of raws) {
      for (const src of expandPath(raw, s)) {
        const node = getNode(s.root, src, ci);
        if (!node.ok) {
          errors.push(notFound('Copy-Item', src));
          continue;
        }
        const dest = resolve(destRaw, s);
        // Without -Recurse, copying a folder copies only the empty folder.
        const value: VNode = node.value.kind === 'dir' && !has(b, 'Recurse') ? { kind: 'dir', children: {} } : node.value;
        const tmp = setNode(s.root, src, value, ci);
        if (!tmp.ok) continue;
        const r = copy(tmp.value, src, dest, { recursive: true }, ci);
        if (!r.ok) {
          errors.push(r.error.code === 'ENOENT' ? `Copy-Item: Could not find a part of the path '${show(dest)}'.` : `Copy-Item: Cannot overwrite the item ${show(src)} with itself.`);
          continue;
        }
        // restore the original source (we only blanked it to copy an empty folder)
        const restored = setNode(r.value, src, node.value, ci);
        s = { ...s, root: restored.ok ? restored.value : r.value };
      }
    }
    return { state: s, out: [], errors };
  },
};

const moveItem: Cmdlet = {
  name: 'Move-Item',
  params: [P.path, P.literal, { name: 'Destination', kind: 'value', position: 1 }, P.force, P.filter, P.include, P.exclude, P.passThru, P.whatIf, P.confirm],
  run: (b, _i, state) => {
    const raws = strs(b, 'Path') ?? strs(b, 'LiteralPath');
    if (raws === undefined) return fail(state, 'Move-Item: Cannot process command because of one or more missing mandatory parameters: Path.');
    const destRaw = str(b, 'Destination') ?? '.';
    let s = state;
    const errors: string[] = [];
    for (const raw of raws) {
      for (const src of expandPath(raw, s)) {
        if (!getNode(s.root, src, ci).ok) {
          errors.push(notFound('Move-Item', src));
          continue;
        }
        const dest = resolve(destRaw, s);
        const destNode = getNode(s.root, dest, ci);
        if (destNode.ok && destNode.value.kind === 'file' && !has(b, 'Force')) {
          errors.push('Move-Item: Cannot create a file when that file already exists.');
          continue;
        }
        const r = move(s.root, src, dest, ci);
        if (!r.ok) {
          errors.push(`Move-Item: Could not find a part of the path '${show(dest)}'.`);
          continue;
        }
        s = { ...s, root: r.value };
      }
    }
    return { state: s, out: [], errors };
  },
};

const renameItem: Cmdlet = {
  name: 'Rename-Item',
  params: [P.path, P.literal, { name: 'NewName', kind: 'value', position: 1 }, P.force, P.passThru, P.whatIf, P.confirm],
  run: (b, _i, state) => {
    const raw = pathArg(b);
    const newName = str(b, 'NewName');
    if (raw === undefined || newName === undefined) {
      return fail(state, `Rename-Item: Cannot process command because of one or more missing mandatory parameters: ${raw === undefined ? 'Path' : 'NewName'}.`);
    }
    if (/[\\/]/.test(newName)) return fail(state, 'Rename-Item: Cannot rename the specified target, because it represents a path or device name.');
    const src = resolve(raw, state);
    if (!getNode(state.root, src, ci).ok) return fail(state, `Rename-Item: Cannot rename because item at '${show(src)}' does not exist.`);
    const dest = [...src.slice(0, -1), newName];
    if (getNode(state.root, dest, ci).ok && dest[dest.length - 1]?.toLowerCase() !== src[src.length - 1]?.toLowerCase()) {
      return fail(state, 'Rename-Item: Cannot create a file when that file already exists.');
    }
    const r = move(state.root, src, dest, ci);
    if (!r.ok) return fail(state, `Rename-Item: Cannot rename because item at '${show(src)}' does not exist.`);
    return ok({ ...state, root: r.value });
  },
};

const removeItem: Cmdlet = {
  name: 'Remove-Item',
  params: [P.path, P.literal, P.filter, P.include, P.exclude, P.recurse, P.force, { name: 'Stream', kind: 'value' }, P.whatIf, P.confirm],
  run: (b, _i, state) => {
    const raws = strs(b, 'Path') ?? strs(b, 'LiteralPath');
    if (raws === undefined) return fail(state, 'Remove-Item: Cannot process command because of one or more missing mandatory parameters: Path.');
    let s = state;
    const errors: string[] = [];
    const effects: Effect[] = [];
    for (const raw of raws) {
      const paths = expandPath(raw, s);
      for (const path of paths) {
        if (path.length <= 1) {
          effects.push({ kind: 'easterEgg', id: 'nuke' });
          errors.push(`Remove-Item: Nice try. This is a simulation, and Shellby has hidden the drive.`);
          continue;
        }
        const node = getNode(s.root, path, ci);
        if (!node.ok) {
          errors.push(notFound('Remove-Item', path));
          continue;
        }
        if (node.value.kind === 'dir' && Object.keys(node.value.children).length > 0 && !has(b, 'Recurse')) {
          errors.push(
            `Remove-Item: The item at ${show(path)} has children and the Recurse parameter was not specified. If you continue, all children will be removed with the item.`,
          );
          continue;
        }
        if (node.value.hidden && !has(b, 'Force')) {
          errors.push(`Remove-Item: You do not have sufficient access rights to perform this operation or the item is hidden, system, or read only.`);
          continue;
        }
        const r = remove(s.root, path, { recursive: true }, ci);
        if (r.ok) s = { ...s, root: r.value };
      }
    }
    return { state: s, out: [], errors, effects };
  },
};

const writeOutput: Cmdlet = {
  name: 'Write-Output',
  params: [{ name: 'InputObject', kind: 'value', position: 0, remaining: true, type: 'System.Management.Automation.PSObject[]' }, { name: 'NoEnumerate', kind: 'switch' }],
  run: (b, input, state) => ok(state, b.values['InputObject'] ?? input),
};

const writeHost: Cmdlet = {
  name: 'Write-Host',
  params: [{ name: 'Object', kind: 'value', position: 0, remaining: true }, { name: 'ForegroundColor', kind: 'value' }, { name: 'BackgroundColor', kind: 'value' }, { name: 'NoNewline', kind: 'switch' }],
  run: (b, _i, state) => ok(state, [{ type: 'string', value: (b.values['Object'] ?? []).map(objectToString).join(' ') }]),
};

const clearHost: Cmdlet = { name: 'Clear-Host', params: [], run: (_b, _i, state) => ok(state, [], [{ kind: 'clear' }]) };

/** `mkdir` in PowerShell is a function wrapping New-Item -ItemType Directory. */
const mkdirFn: Cmdlet = {
  name: 'mkdir',
  params: [P.path, { name: 'Name', kind: 'value' }, P.force, P.whatIf, P.confirm],
  run: (b, input, state) => {
    const r = newItem.run({ switches: b.switches, values: { ...b.values, ItemType: [{ type: 'string', value: 'Directory' }] } }, input, state);
    return { ...r, errors: r.errors.map((e) => e.replace(/^New-Item:/, 'New-Item:')) };
  },
};

const getHelp: Cmdlet = {
  name: 'Get-Help',
  params: [{ name: 'Name', kind: 'value', position: 0 }, { name: 'Examples', kind: 'switch' }, { name: 'Full', kind: 'switch' }, { name: 'Online', kind: 'switch' }],
  run: (b, _i, state) => {
    const name = str(b, 'Name') ?? 'Get-Help';
    return ok(state, [{ type: 'string', value: `\nNAME\n    ${name}\n\nSYNOPSIS\n    Hermit's offline help is short: try the lesson hints, or Shellby.\n` }]);
  },
};

export const cmdlets: readonly Cmdlet[] = [
  getLocation,
  setLocation,
  getChildItem,
  newItem,
  getContent,
  writeContent('Set-Content'),
  writeContent('Add-Content'),
  copyItem,
  moveItem,
  renameItem,
  removeItem,
  writeOutput,
  writeHost,
  clearHost,
  mkdirFn,
  getHelp,
];

export const psAliases: Readonly<Record<string, string>> = {
  ls: 'Get-ChildItem',
  dir: 'Get-ChildItem',
  gci: 'Get-ChildItem',
  cd: 'Set-Location',
  sl: 'Set-Location',
  chdir: 'Set-Location',
  pwd: 'Get-Location',
  gl: 'Get-Location',
  cat: 'Get-Content',
  type: 'Get-Content',
  gc: 'Get-Content',
  rm: 'Remove-Item',
  del: 'Remove-Item',
  erase: 'Remove-Item',
  ri: 'Remove-Item',
  rd: 'Remove-Item',
  rmdir: 'Remove-Item',
  cp: 'Copy-Item',
  copy: 'Copy-Item',
  cpi: 'Copy-Item',
  mv: 'Move-Item',
  move: 'Move-Item',
  mi: 'Move-Item',
  ren: 'Rename-Item',
  rni: 'Rename-Item',
  echo: 'Write-Output',
  write: 'Write-Output',
  cls: 'Clear-Host',
  clear: 'Clear-Host',
  md: 'mkdir',
  ni: 'New-Item',
  ac: 'Add-Content',
  sc: 'Set-Content',
  help: 'Get-Help',
};

export const findCmdlet = (name: string): Cmdlet | undefined => {
  const lower = name.toLowerCase();
  const target = Object.entries(psAliases).find(([a]) => a === lower)?.[1]?.toLowerCase() ?? lower;
  return cmdlets.find((c) => c.name.toLowerCase() === target);
};

export const bindAndRun = (cmdlet: Cmdlet, args: readonly BoundArg[], input: readonly PsObject[], state: MachineState): PsResult => {
  const b = bind(cmdlet.name, cmdlet.params, args);
  if (!b.ok) return fail(state, b.error);
  return cmdlet.run(b.bound, input, state);
};

export { formatObjects, getProperty, walk };
