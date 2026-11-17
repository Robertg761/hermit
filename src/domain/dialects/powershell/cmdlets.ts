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
    // `-r` is everyday shorthand for -Recurse, not ambiguous with -ReadOnly.
    { ...P.recurse, aliases: ['s', 'r'] },
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
    /** With -Name, each item's path relative to the folder listed (just the name without -Recurse). */
    const rels: string[] = [];
    const push = (item: PsObject, rel: string): void => {
      out.push(item);
      rels.push(rel);
    };
    for (const rawPath of raws) {
      // `Get-ChildItem *.txt -Recurse`: a wildcard in the last part filters every folder below.
      const split = has(b, 'Recurse') ? /^(.*?)([^\\/]*[*?[][^\\/]*)$/.exec(rawPath) : null;
      const leafGlob = split !== null && !hasGlob(split[1] ?? '') ? (split[2] ?? undefined) : undefined;
      const raw = leafGlob !== undefined ? (split?.[1] ?? '').replace(/[\\/]$/, '') || '.' : rawPath;
      const paths = expandPath(raw, state);
      if (paths.length === 0 && hasGlob(raw)) continue;
      for (const path of paths) {
        const node = getNode(state.root, path, ci);
        if (!node.ok) {
          errors.push(notFound('Get-ChildItem', path));
          continue;
        }
        if (node.value.kind === 'file') {
          push(fileObject(path, node.value), path[path.length - 1] ?? '');
          continue;
        }
        const keepHere = (name: string, child: VNode): boolean => keep(name, child) && (leafGlob === undefined || globMatch(leafGlob, name, true));
        if (has(b, 'Recurse')) {
          const visit = (dirPath: Path, dir: VNode, prefix: string): void => {
            if (dir.kind !== 'dir') return;
            const entries = sortEntries(Object.entries(dir.children));
            for (const [name, child] of entries) if (keepHere(name, child)) push(fileObject([...dirPath, name], child), prefix + name);
            for (const [name, child] of entries) {
              if (child.kind === 'dir' && (!child.hidden || force)) visit([...dirPath, name], child, `${prefix}${name}\\`);
            }
          };
          visit(path, node.value, '');
        } else {
          for (const [name, child] of sortEntries(Object.entries(node.value.children))) {
            if (keepHere(name, child)) push(fileObject([...path, name], child), name);
          }
        }
      }
    }
    const result = has(b, 'Name') ? rels.map((rel): PsObject => ({ type: 'string', value: rel })) : out;
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
          errors.push(`Remove-Item: Nice try. This is a simulation, and Herme has hidden the drive.`);
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
    return ok(state, [{ type: 'string', value: `\nNAME\n    ${name}\n\nSYNOPSIS\n    Hermit's offline help is short: try the lesson hints, or Herme.\n` }]);
  },
};


// ---------------- Units 3 to 5: searching, pipelines, processes ----------------

const num = (o: PsObject | null): number | null => {
  if (o === null) return null;
  if (o.type === 'number') return o.value;
  if (o.type === 'string' && /^-?\d+(\.\d+)?$/.test(o.value.trim())) return Number(o.value);
  return null;
};

const wildcard = (pattern: string): RegExp =>
  new RegExp(`^${pattern.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');

/** PowerShell comparison operators, case-insensitive like the real ones. */
const compare = (op: string, left: PsObject | null, right: string): boolean | null => {
  const l = left === null ? '' : objectToString(left);
  const ln = num(left);
  const rn = /^-?\d+(\.\d+)?$/.test(right) ? Number(right) : null;
  const cmp = ln !== null && rn !== null ? ln - rn : l.localeCompare(right, 'en', { sensitivity: 'base' });
  switch (op.toLowerCase()) {
    case 'eq':
      return cmp === 0;
    case 'ne':
      return cmp !== 0;
    case 'gt':
      return cmp > 0;
    case 'ge':
      return cmp >= 0;
    case 'lt':
      return cmp < 0;
    case 'le':
      return cmp <= 0;
    case 'like':
      return wildcard(right).test(l);
    case 'notlike':
      return !wildcard(right).test(l);
    case 'match':
      try {
        return new RegExp(right, 'i').test(l);
      } catch {
        return null;
      }
    case 'notmatch':
      try {
        return !new RegExp(right, 'i').test(l);
      } catch {
        return null;
      }
    default:
      return null;
  }
};

const OPS = ['EQ', 'NE', 'GT', 'GE', 'LT', 'LE', 'Like', 'NotLike', 'Match', 'NotMatch'];

/** `$_.Length -gt 100`, `$_ -like "*.txt"`: the filters lessons use. */
const parseFilter = (text: string): { prop: string | null; op: string; value: string } | null => {
  const m = /^\$_(?:\.(\w+))?\s+-(\w+)\s+(?:"([^"]*)"|'([^']*)'|(\S+))$/.exec(text.trim());
  if (m === null) return null;
  return { prop: m[1] ?? null, op: m[2] ?? '', value: m[3] ?? m[4] ?? m[5] ?? '' };
};

const SIMPLE_ONLY = "Hermit only understands simple filters, like { $_.Length -gt 100 } or { $_.Name -like '*.txt' }.";

const whereObject: Cmdlet = {
  name: 'Where-Object',
  params: [{ name: 'Property', kind: 'value', position: 0 }, { name: 'Value', kind: 'value', position: 1, type: 'System.Object' }, { name: 'FilterScript', kind: 'value' }, ...OPS.map((o): ParamSpec => ({ name: o, kind: 'switch' }))],
  run: (b, input, state) => {
    const first = b.values['FilterScript']?.[0] ?? b.values['Property']?.[0];
    if (first?.type === 'scriptblock') {
      const f = parseFilter(first.text);
      if (f === null) return fail(state, `Where-Object: ${SIMPLE_ONLY}`);
      const out = input.filter((o) => compare(f.op, f.prop === null ? o : getProperty(o, f.prop), f.value) === true);
      return ok(state, out);
    }
    const prop = str(b, 'Property');
    if (prop === undefined) return fail(state, 'Where-Object: Cannot process command because of one or more missing mandatory parameters: Property.');
    const op = OPS.find((o) => has(b, o));
    const value = str(b, 'Value') ?? '';
    if (op === undefined) return ok(state, input.filter((o) => { const v = getProperty(o, prop); return v !== null && objectToString(v) !== '' && objectToString(v) !== '0'; }));
    return ok(state, input.filter((o) => compare(op, getProperty(o, prop), value) === true));
  },
};

const forEachObject: Cmdlet = {
  name: 'ForEach-Object',
  params: [{ name: 'MemberName', kind: 'value', position: 0 }, { name: 'Process', kind: 'value' }],
  run: (b, input, state) => {
    const first = b.values['Process']?.[0] ?? b.values['MemberName']?.[0];
    let prop: string | null = null;
    if (first?.type === 'scriptblock') {
      const m = /^\$_(?:\.(\w+))?$/.exec(first.text.trim());
      if (m === null) return fail(state, `ForEach-Object: Hermit only understands { $_.Name }-style blocks here.`);
      prop = m[1] ?? null;
    } else if (first !== undefined) prop = objectToString(first);
    if (prop === null) return ok(state, input);
    const p = prop;
    return ok(state, input.flatMap((o) => { const v = getProperty(o, p); return v === null ? [] : [v]; }));
  },
};

const sortKey = (o: PsObject, props: readonly string[] | undefined): PsObject | null =>
  props === undefined || props.length === 0 ? (o.type === 'file' ? { type: 'string', value: o.name } : o) : getProperty(o, props[0] ?? '');

const compareObjects = (a: PsObject | null, b: PsObject | null): number => {
  if (a === null || b === null) return a === null ? (b === null ? 0 : -1) : 1;
  const an = num(a);
  const bn = num(b);
  if (an !== null && bn !== null) return an - bn;
  return objectToString(a).localeCompare(objectToString(b), 'en', { sensitivity: 'base' });
};

const sortObject: Cmdlet = {
  name: 'Sort-Object',
  params: [{ name: 'Property', kind: 'value', position: 0, type: 'System.Object[]' }, { name: 'Descending', kind: 'switch' }, { name: 'Unique', kind: 'switch' }, { name: 'CaseSensitive', kind: 'switch' }, { name: 'Top', kind: 'value' }, { name: 'Bottom', kind: 'value' }],
  run: (b, input, state) => {
    const props = strs(b, 'Property');
    const sorted = [...input].sort((x, y) => compareObjects(sortKey(x, props), sortKey(y, props)) * (has(b, 'Descending') ? -1 : 1));
    const out = has(b, 'Unique')
      ? sorted.filter((o, i) => i === 0 || compareObjects(sortKey(o, props), sortKey(sorted[i - 1] ?? o, props)) !== 0)
      : sorted;
    const top = str(b, 'Top');
    return ok(state, top === undefined ? out : out.slice(0, Number(top)));
  },
};

const groupObject: Cmdlet = {
  name: 'Group-Object',
  params: [{ name: 'Property', kind: 'value', position: 0, type: 'System.Object[]' }, { name: 'NoElement', kind: 'switch' }, { name: 'CaseSensitive', kind: 'switch' }],
  run: (b, input, state) => {
    const props = strs(b, 'Property');
    const groups: { key: string; items: PsObject[] }[] = [];
    for (const o of input) {
      const k = sortKey(o, props);
      const key = k === null ? '' : objectToString(k);
      const g = groups.find((x) => (has(b, 'CaseSensitive') ? x.key === key : x.key.toLowerCase() === key.toLowerCase()));
      if (g === undefined) groups.push({ key, items: [o] });
      else g.items.push(o);
    }
    return ok(
      state,
      groups.map((g): PsObject => ({
        type: 'record',
        props: [
          ['Count', { type: 'number', value: g.items.length }],
          ['Name', { type: 'string', value: g.key }],
          ...(has(b, 'NoElement') ? [] : [['Group', { type: 'string', value: `{${g.items.map((o) => objectToString(o)).join(', ')}}` }] as const]),
        ],
      })),
    );
  },
};

const getUnique: Cmdlet = {
  name: 'Get-Unique',
  params: [{ name: 'AsString', kind: 'switch' }],
  run: (_b, input, state) => ok(state, input.filter((o, i) => i === 0 || objectToString(o) !== objectToString(input[i - 1] ?? o))),
};

const selectObject: Cmdlet = {
  name: 'Select-Object',
  params: [{ name: 'Property', kind: 'value', position: 0, type: 'System.Object[]' }, { name: 'First', kind: 'value', type: 'System.Int32' }, { name: 'Last', kind: 'value', type: 'System.Int32' }, { name: 'Skip', kind: 'value', type: 'System.Int32' }, { name: 'Unique', kind: 'switch' }, { name: 'ExpandProperty', kind: 'value' }],
  run: (b, input, state) => {
    let out = [...input];
    if (has(b, 'Unique')) out = out.filter((o, i) => out.findIndex((x) => objectToString(x) === objectToString(o)) === i);
    const skip = str(b, 'Skip');
    if (skip !== undefined) out = out.slice(Number(skip));
    const first = str(b, 'First');
    const last = str(b, 'Last');
    if (first !== undefined) out = out.slice(0, Number(first));
    if (last !== undefined) out = out.slice(Math.max(0, out.length - Number(last)));
    const expand = str(b, 'ExpandProperty');
    if (expand !== undefined) return ok(state, out.flatMap((o) => { const v = getProperty(o, expand); return v === null ? [] : [v]; }));
    const props = strs(b, 'Property');
    if (props !== undefined && props.length > 0) {
      return ok(state, out.map((o): PsObject => ({ type: 'record', props: props.map((p) => [canonicalProp(p), getProperty(o, p)] as const) })));
    }
    return ok(state, out);
  },
};

const PROP_NAMES = ['Name', 'Length', 'FullName', 'Extension', 'BaseName', 'Id', 'CPU', 'ProcessName', 'Path', 'Line', 'LineNumber', 'Count', 'Lines'];
const canonicalProp = (p: string): string => PROP_NAMES.find((n) => n.toLowerCase() === p.toLowerCase()) ?? p;

/** Paths in Select-String output are relative to where you are, like PowerShell 7. */
const relativeTo = (cwd: Path, path: Path): string => {
  const inside = cwd.every((seg, i) => path[i]?.toLowerCase() === seg.toLowerCase());
  return inside ? path.slice(cwd.length).join('\\') : show(path);
};

const selectString: Cmdlet = {
  name: 'Select-String',
  params: [{ name: 'Pattern', kind: 'value', position: 0, type: 'System.String[]' }, { name: 'Path', kind: 'value', position: 1, type: 'System.String[]' }, { name: 'SimpleMatch', kind: 'switch' }, { name: 'CaseSensitive', kind: 'switch' }, { name: 'NotMatch', kind: 'switch' }, { name: 'List', kind: 'switch' }, { name: 'Quiet', kind: 'switch' }, { name: 'Raw', kind: 'switch' }],
  run: (b, input, state) => {
    const patterns = strs(b, 'Pattern');
    if (patterns === undefined) return fail(state, 'Select-String: Cannot process command because of one or more missing mandatory parameters: Pattern.');
    const flags = has(b, 'CaseSensitive') ? '' : 'i';
    const tests = patterns.map((p) => {
      if (has(b, 'SimpleMatch')) return (l: string): boolean => (flags === 'i' ? l.toLowerCase().includes(p.toLowerCase()) : l.includes(p));
      try {
        const re = new RegExp(p, flags);
        return (l: string): boolean => re.test(l);
      } catch {
        return (l: string): boolean => l.includes(p);
      }
    });
    const hit = (l: string): boolean => tests.some((t) => t(l)) !== has(b, 'NotMatch');
    const out: PsObject[] = [];
    const errors: string[] = [];
    const scan = (label: string, text: string): void => {
      const lines = text.replace(/\r\n/g, '\n').split('\n');
      if (lines[lines.length - 1] === '') lines.pop();
      lines.forEach((line, i) => {
        if (hit(line)) out.push(has(b, 'Raw') ? { type: 'string', value: line } : { type: 'matchInfo', path: label, lineNumber: i + 1, line });
      });
    };
    const paths = strs(b, 'Path');
    if (paths !== undefined) {
      for (const raw of paths) {
        const expanded = expandPath(raw, state);
        if (expanded.length === 0) errors.push(`Select-String: Cannot find path '${show(resolve(raw, state))}' because it does not exist.`);
        for (const path of expanded) {
          const node = getNode(state.root, path, ci);
          if (!node.ok) errors.push(`Select-String: Cannot find path '${show(path)}' because it does not exist.`);
          else if (node.value.kind === 'file') scan(relativeTo(state.cwd, path), node.value.content);
        }
      }
    } else {
      for (const o of input) {
        if (o.type === 'file') {
          const node = getNode(state.root, o.path, ci);
          if (node.ok && node.value.kind === 'file') scan(relativeTo(state.cwd, o.path), node.value.content);
        } else scan('', objectToString(o));
      }
    }
    if (has(b, 'Quiet')) return { state, out: [{ type: 'string', value: out.length > 0 ? 'True' : 'False' }], errors };
    return { state, out, errors };
  },
};

const measureObject: Cmdlet = {
  name: 'Measure-Object',
  params: [{ name: 'Property', kind: 'value', position: 0 }, { name: 'Line', kind: 'switch' }, { name: 'Word', kind: 'switch' }, { name: 'Character', kind: 'switch' }, { name: 'Sum', kind: 'switch' }, { name: 'Average', kind: 'switch' }],
  run: (b, input, state) => {
    if (has(b, 'Line') || has(b, 'Word') || has(b, 'Character')) {
      const texts = input.map(objectToString);
      const lines = texts.reduce((n, t) => n + t.split('\n').filter((l) => l !== '').length, 0);
      const words = texts.reduce((n, t) => n + t.split(/\s+/).filter((w) => w !== '').length, 0);
      const chars = texts.reduce((n, t) => n + t.length, 0);
      return ok(state, [{ type: 'measure', mode: 'text', lines: has(b, 'Line') ? lines : 0, words: has(b, 'Word') ? words : 0, chars: has(b, 'Character') ? chars : 0, count: input.length }]);
    }
    return ok(state, [{ type: 'measure', mode: 'count', lines: 0, words: 0, chars: 0, count: input.length }]);
  },
};

const procObject = (p: { pid: number; name: string; cpu: number }): PsObject => ({ type: 'process', name: p.name, pid: p.pid, cpu: p.cpu });

const getProcess: Cmdlet = {
  name: 'Get-Process',
  params: [{ name: 'Name', kind: 'value', position: 0, aliases: ['ProcessName'], type: 'System.String[]' }, { name: 'Id', kind: 'value', type: 'System.Int32[]' }],
  run: (b, _i, state) => {
    const ids = strs(b, 'Id');
    if (ids !== undefined) {
      const out: PsObject[] = [];
      const errors: string[] = [];
      for (const id of ids) {
        const p = state.processes.find((x) => String(x.pid) === id);
        if (p === undefined) errors.push(`Get-Process: Cannot find a process with the process identifier ${id}.`);
        else out.push(procObject(p));
      }
      return { state, out, errors };
    }
    const names = strs(b, 'Name');
    if (names === undefined) return ok(state, [...state.processes].sort((x, y) => x.name.localeCompare(y.name, 'en', { sensitivity: 'base' })).map(procObject));
    const out: PsObject[] = [];
    const errors: string[] = [];
    for (const n of names) {
      const hits = state.processes.filter((p) => wildcard(n).test(p.name));
      if (hits.length === 0 && !hasGlob(n)) errors.push(`Get-Process: Cannot find a process with the name "${n}". Verify the process name and call the cmdlet again.`);
      out.push(...hits.map(procObject));
    }
    return { state, out, errors };
  },
};

const stopProcess: Cmdlet = {
  name: 'Stop-Process',
  params: [{ name: 'Id', kind: 'value', position: 0, type: 'System.Int32[]' }, { name: 'Name', kind: 'value', aliases: ['ProcessName'], type: 'System.String[]' }, { name: 'InputObject', kind: 'value' }, P.force, P.passThru, P.whatIf, P.confirm],
  run: (b, input, state) => {
    const errors: string[] = [];
    const targets: number[] = [];
    for (const id of strs(b, 'Id') ?? []) {
      if (!/^\d+$/.test(id)) {
        errors.push(`Stop-Process: Cannot bind parameter 'Id'. Cannot convert value "${id}" to type "System.Int32". Error: "The input string '${id}' was not in a correct format."`);
        continue;
      }
      if (state.processes.some((p) => String(p.pid) === id)) targets.push(Number(id));
      else errors.push(`Stop-Process: Cannot find a process with the process identifier ${id}.`);
    }
    for (const n of strs(b, 'Name') ?? []) {
      const hits = state.processes.filter((p) => wildcard(n).test(p.name));
      if (hits.length === 0) errors.push(`Stop-Process: Cannot find a process with the name "${n}". Verify the process name and call the cmdlet again.`);
      targets.push(...hits.map((p) => p.pid));
    }
    for (const o of input) if (o.type === 'process') targets.push(o.pid);
    if (targets.length === 0 && errors.length === 0) return fail(state, 'Stop-Process: Cannot process command because of one or more missing mandatory parameters: Id.');
    const allowed = targets.filter((pid) => {
      const p = state.processes.find((x) => x.pid === pid);
      if (p !== undefined && p.admin === true && !state.isAdmin) {
        errors.push(`Stop-Process: Cannot stop process "${p.name} (${pid})" because of the following error: Access is denied.`);
        return false;
      }
      return true;
    });
    return { state: { ...state, processes: state.processes.filter((p) => !allowed.includes(p.pid)) }, out: [], errors };
  },
};

const POLICIES = ['Restricted', 'RemoteSigned', 'Unrestricted', 'Bypass', 'AllSigned'] as const;

const setExecutionPolicy: Cmdlet = {
  name: 'Set-ExecutionPolicy',
  params: [{ name: 'ExecutionPolicy', kind: 'value', position: 0, type: 'Microsoft.PowerShell.ExecutionPolicy' }, { name: 'Scope', kind: 'value', position: 1 }, P.force, P.whatIf, P.confirm],
  run: (b, _i, state) => {
    const raw = str(b, 'ExecutionPolicy');
    if (raw === undefined) return fail(state, 'Set-ExecutionPolicy: Cannot process command because of one or more missing mandatory parameters: ExecutionPolicy.');
    const policy = POLICIES.find((p) => p.toLowerCase() === raw.toLowerCase());
    if (policy === undefined) {
      return fail(state, `Set-ExecutionPolicy: Cannot bind parameter 'ExecutionPolicy'. Cannot convert value "${raw}" to type "Microsoft.PowerShell.ExecutionPolicy". Error: "Unable to match the identifier name ${raw} to a valid enumerator name. Specify one of the following enumerator names and try again:\nUnrestricted, RemoteSigned, AllSigned, Restricted, Default, Bypass, Undefined"`);
    }
    const scope = (str(b, 'Scope') ?? 'LocalMachine').toLowerCase();
    if (!['currentuser', 'localmachine', 'process'].includes(scope)) return fail(state, `Set-ExecutionPolicy: Cannot bind parameter 'Scope'. Cannot convert value "${str(b, 'Scope') ?? ''}" to type "Microsoft.PowerShell.ExecutionPolicyScope".`);
    if (scope === 'localmachine' && !state.isAdmin) {
      return fail(
        state,
        `Set-ExecutionPolicy: Access to the path 'C:\\Program Files\\PowerShell\\7\\powershell.config.json' is denied.\nTo change the execution policy for the default (LocalMachine) scope, start PowerShell with the "Run as administrator" option. To change the execution policy for the current user, run "Set-ExecutionPolicy -Scope CurrentUser".`,
      );
    }
    return ok({ ...state, executionPolicy: policy });
  },
};

const getExecutionPolicy: Cmdlet = {
  name: 'Get-ExecutionPolicy',
  params: [{ name: 'Scope', kind: 'value' }, { name: 'List', kind: 'switch' }],
  run: (_b, _i, state) => ok(state, [{ type: 'string', value: state.executionPolicy ?? 'Restricted' }]),
};

const KNOWN_APPS = ['pwsh', 'powershell', 'notepad', 'explorer', 'calc', 'mspaint', 'cmd', 'wt'];

const startProcess: Cmdlet = {
  name: 'Start-Process',
  params: [{ name: 'FilePath', kind: 'value', position: 0 }, { name: 'ArgumentList', kind: 'value', position: 1, type: 'System.String[]' }, { name: 'Verb', kind: 'value' }, { name: 'Wait', kind: 'switch' }, P.passThru, { name: 'WindowStyle', kind: 'value' }],
  run: (b, _i, state) => {
    const file = str(b, 'FilePath');
    if (file === undefined) return fail(state, 'Start-Process: Cannot process command because of one or more missing mandatory parameters: FilePath.');
    const base = file.toLowerCase().replace(/\.exe$/, '');
    const exists = getNode(state.root, resolve(file, state), ci).ok;
    if (!KNOWN_APPS.includes(base) && !exists) {
      return fail(state, 'Start-Process: This command cannot be run due to the error: The system cannot find the file specified.');
    }
    const runAs = (str(b, 'Verb') ?? '').toLowerCase() === 'runas';
    if (runAs && (base === 'pwsh' || base === 'powershell' || base === 'wt')) {
      return ok({ ...state, isAdmin: true }, [{ type: 'string', value: '(Windows asked "Do you want to allow this app to make changes?" and you said Yes. Hermit moved you into the new Administrator window.)' }]);
    }
    return ok(state);
  },
};

export const cmdlets: readonly Cmdlet[] = [
  groupObject,
  getUnique,
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
  whereObject,
  forEachObject,
  sortObject,
  selectObject,
  selectString,
  measureObject,
  getProcess,
  stopProcess,
  setExecutionPolicy,
  getExecutionPolicy,
  startProcess,
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
  where: 'Where-Object',
  '?': 'Where-Object',
  foreach: 'ForEach-Object',
  '%': 'ForEach-Object',
  sort: 'Sort-Object',
  group: 'Group-Object',
  gu: 'Get-Unique',
  select: 'Select-Object',
  sls: 'Select-String',
  measure: 'Measure-Object',
  ps: 'Get-Process',
  gps: 'Get-Process',
  kill: 'Stop-Process',
  spps: 'Stop-Process',
  start: 'Start-Process',
  saps: 'Start-Process',
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
