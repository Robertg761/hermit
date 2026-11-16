import type { DirNode, FileNode, VNode } from '../types';

export type Path = readonly string[];

export type VfsError =
  | { readonly code: 'ENOENT'; readonly path: Path }
  | { readonly code: 'ENOTDIR'; readonly path: Path }
  | { readonly code: 'EISDIR'; readonly path: Path }
  | { readonly code: 'EEXIST'; readonly path: Path }
  | { readonly code: 'ENOTEMPTY'; readonly path: Path }
  | { readonly code: 'EINVAL'; readonly path: Path };

export type VfsResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: VfsError };

const ok = <T>(value: T): VfsResult<T> => ({ ok: true, value });
const fail = <T>(error: VfsError): VfsResult<T> => ({ ok: false, error });

export const emptyDir = (): DirNode => ({ kind: 'dir', children: {} });
export const file = (content: string, extra: Partial<Omit<FileNode, 'kind' | 'content'>> = {}): FileNode => ({
  kind: 'file',
  content,
  ...extra,
});
export const dir = (children: Record<string, VNode> = {}, hidden?: boolean): DirNode =>
  hidden ? { kind: 'dir', children, hidden } : { kind: 'dir', children };

export type NameCompare = (a: string, b: string) => boolean;
export const caseSensitive: NameCompare = (a, b) => a === b;
export const caseInsensitive: NameCompare = (a, b) => a.toLowerCase() === b.toLowerCase();

/** Find the real key of a child, honouring the dialect's case rules. */
export const findChildKey = (parent: DirNode, name: string, eq: NameCompare = caseSensitive): string | undefined => {
  if (Object.prototype.hasOwnProperty.call(parent.children, name)) return name;
  return Object.keys(parent.children).find((k) => eq(k, name));
};

/** Normalise a path: resolve `.` and `..` segments. `..` at root stays at root. */
export const normalize = (segments: Path): Path => {
  const out: string[] = [];
  for (const s of segments) {
    if (s === '' || s === '.') continue;
    if (s === '..') out.pop();
    else out.push(s);
  }
  return out;
};

/** Resolve a path to its canonical spelling (real key names) when it exists. */
export const canonical = (root: DirNode, path: Path, eq: NameCompare = caseSensitive): Path | null => {
  const out: string[] = [];
  let node: VNode = root;
  for (const seg of path) {
    if (node.kind !== 'dir') return null;
    const key = findChildKey(node, seg, eq);
    if (key === undefined) return null;
    const next: VNode | undefined = node.children[key];
    if (next === undefined) return null;
    out.push(key);
    node = next;
  }
  return out;
};

export const getNode = (root: DirNode, path: Path, eq: NameCompare = caseSensitive): VfsResult<VNode> => {
  let node: VNode = root;
  for (let i = 0; i < path.length; i++) {
    const seg = path[i] ?? '';
    if (node.kind !== 'dir') return fail({ code: 'ENOTDIR', path: path.slice(0, i) });
    const key = findChildKey(node, seg, eq);
    const next: VNode | undefined = key === undefined ? undefined : node.children[key];
    if (next === undefined) return fail({ code: 'ENOENT', path: path.slice(0, i + 1) });
    node = next;
  }
  return ok(node);
};

export const exists = (root: DirNode, path: Path, eq: NameCompare = caseSensitive): boolean => getNode(root, path, eq).ok;

export const isDir = (root: DirNode, path: Path, eq: NameCompare = caseSensitive): boolean => {
  const r = getNode(root, path, eq);
  return r.ok && r.value.kind === 'dir';
};

export const readFile = (root: DirNode, path: Path, eq: NameCompare = caseSensitive): VfsResult<string> => {
  const r = getNode(root, path, eq);
  if (!r.ok) return r;
  if (r.value.kind === 'dir') return fail({ code: 'EISDIR', path });
  return ok(r.value.content);
};

export const listDir = (
  root: DirNode,
  path: Path,
  eq: NameCompare = caseSensitive,
): VfsResult<readonly (readonly [string, VNode])[]> => {
  const r = getNode(root, path, eq);
  if (!r.ok) return r;
  if (r.value.kind !== 'dir') return fail({ code: 'ENOTDIR', path });
  const entries = Object.entries(r.value.children).sort(([a], [b]) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  return ok(entries);
};

/**
 * Replace (or delete, when `node` is undefined) the entry at `path`.
 * The parent directory must exist. Returns a new root.
 */
export const setNode = (
  root: DirNode,
  path: Path,
  node: VNode | undefined,
  eq: NameCompare = caseSensitive,
): VfsResult<DirNode> => {
  if (path.length === 0) {
    if (node === undefined || node.kind !== 'dir') return fail({ code: 'EINVAL', path });
    return ok(node);
  }
  const [head, ...rest] = path;
  if (head === undefined) return fail({ code: 'EINVAL', path });
  const key = findChildKey(root, head, eq);
  if (rest.length === 0) {
    const children = Object.fromEntries(Object.entries(root.children).filter(([k]) => k !== key));
    if (node !== undefined) children[key ?? head] = node;
    return ok({ ...root, children });
  }
  const child = key === undefined ? undefined : root.children[key];
  if (child === undefined || key === undefined) return fail({ code: 'ENOENT', path: [head] });
  if (child.kind !== 'dir') return fail({ code: 'ENOTDIR', path: [head] });
  const sub = setNode(child, rest, node, eq);
  if (!sub.ok) return fail({ ...sub.error, path: [head, ...sub.error.path] });
  return ok({ ...root, children: { ...root.children, [key]: sub.value } });
};

const parentOf = (path: Path): Path => path.slice(0, -1);

const requireParentDir = (root: DirNode, path: Path, eq: NameCompare): VfsError | null => {
  const parent = getNode(root, parentOf(path), eq);
  if (!parent.ok) return parent.error;
  if (parent.value.kind !== 'dir') return { code: 'ENOTDIR', path: parentOf(path) };
  return null;
};

export const writeFile = (
  root: DirNode,
  path: Path,
  content: string,
  opts: { append?: boolean } = {},
  eq: NameCompare = caseSensitive,
): VfsResult<DirNode> => {
  if (path.length === 0) return fail({ code: 'EISDIR', path });
  const parentErr = requireParentDir(root, path, eq);
  if (parentErr) return fail(parentErr);
  const existing = getNode(root, path, eq);
  if (existing.ok && existing.value.kind === 'dir') return fail({ code: 'EISDIR', path });
  const prev = existing.ok && existing.value.kind === 'file' ? existing.value : undefined;
  const next: FileNode = { ...(prev ?? { kind: 'file' as const }), content: opts.append && prev ? prev.content + content : content };
  return setNode(root, path, next, eq);
};

/** Create an empty file if missing; leaves existing files unchanged (like `touch`). */
export const touch = (root: DirNode, path: Path, eq: NameCompare = caseSensitive): VfsResult<DirNode> => {
  const existing = getNode(root, path, eq);
  if (existing.ok) return ok(root);
  return writeFile(root, path, '', {}, eq);
};

export const mkdir = (
  root: DirNode,
  path: Path,
  opts: { parents?: boolean } = {},
  eq: NameCompare = caseSensitive,
): VfsResult<DirNode> => {
  if (path.length === 0) return fail({ code: 'EEXIST', path });
  const existing = getNode(root, path, eq);
  if (existing.ok) {
    if (opts.parents && existing.value.kind === 'dir') return ok(root);
    return fail({ code: 'EEXIST', path });
  }
  if (opts.parents) {
    let current = root;
    for (let i = 1; i <= path.length; i++) {
      const sub = path.slice(0, i);
      const node = getNode(current, sub, eq);
      if (node.ok) {
        if (node.value.kind !== 'dir') return fail({ code: 'ENOTDIR', path: sub });
        continue;
      }
      const r = setNode(current, sub, emptyDir(), eq);
      if (!r.ok) return r;
      current = r.value;
    }
    return ok(current);
  }
  const parentErr = requireParentDir(root, path, eq);
  if (parentErr) return fail(parentErr);
  return setNode(root, path, emptyDir(), eq);
};

export const remove = (
  root: DirNode,
  path: Path,
  opts: { recursive?: boolean } = {},
  eq: NameCompare = caseSensitive,
): VfsResult<DirNode> => {
  const existing = getNode(root, path, eq);
  if (!existing.ok) return existing;
  if (path.length === 0) return fail({ code: 'EINVAL', path });
  if (existing.value.kind === 'dir' && !opts.recursive) {
    return fail({ code: 'EISDIR', path });
  }
  return setNode(root, path, undefined, eq);
};

/** Remove an empty directory (`rmdir`). */
export const rmdir = (root: DirNode, path: Path, eq: NameCompare = caseSensitive): VfsResult<DirNode> => {
  const existing = getNode(root, path, eq);
  if (!existing.ok) return existing;
  if (existing.value.kind !== 'dir') return fail({ code: 'ENOTDIR', path });
  if (Object.keys(existing.value.children).length > 0) return fail({ code: 'ENOTEMPTY', path });
  return setNode(root, path, undefined, eq);
};

const isInside = (inner: Path, outer: Path): boolean =>
  inner.length >= outer.length && outer.every((s, i) => inner[i] === s);

/**
 * Copy `src` to `dest`. If `dest` is an existing directory, the copy goes inside it with the same name.
 * Copying a directory requires `recursive`.
 */
export const copy = (
  root: DirNode,
  src: Path,
  dest: Path,
  opts: { recursive?: boolean } = {},
  eq: NameCompare = caseSensitive,
): VfsResult<DirNode> => {
  const s = getNode(root, src, eq);
  if (!s.ok) return s;
  if (s.value.kind === 'dir' && !opts.recursive) return fail({ code: 'EISDIR', path: src });
  const target = resolveTarget(root, src, dest, eq);
  const canonSrc = canonical(root, src, eq) ?? src;
  if (s.value.kind === 'dir' && isInside(canonical(root, parentOf(target), eq) ?? target, canonSrc)) {
    return fail({ code: 'EINVAL', path: dest });
  }
  const existing = getNode(root, target, eq);
  if (existing.ok && existing.value.kind === 'dir' && s.value.kind === 'file') return fail({ code: 'EISDIR', path: target });
  const parentErr = requireParentDir(root, target, eq);
  if (parentErr) return fail(parentErr);
  return setNode(root, target, s.value, eq);
};

export const move = (root: DirNode, src: Path, dest: Path, eq: NameCompare = caseSensitive): VfsResult<DirNode> => {
  const s = getNode(root, src, eq);
  if (!s.ok) return s;
  if (src.length === 0) return fail({ code: 'EINVAL', path: src });
  const target = resolveTarget(root, src, dest, eq);
  const canonSrc = canonical(root, src, eq) ?? src;
  if (s.value.kind === 'dir' && isInside(target, canonSrc)) return fail({ code: 'EINVAL', path: dest });
  const parentErr = requireParentDir(root, target, eq);
  if (parentErr) return fail(parentErr);
  const existing = getNode(root, target, eq);
  if (existing.ok && existing.value.kind === 'dir') return fail({ code: 'EISDIR', path: target });
  const removed = setNode(root, canonSrc, undefined, eq);
  if (!removed.ok) return removed;
  return setNode(removed.value, target, s.value, eq);
};

/** If `dest` is an existing directory, the target is `dest/<basename(src)>`. */
const resolveTarget = (root: DirNode, src: Path, dest: Path, eq: NameCompare): Path => {
  const base = src[src.length - 1];
  if (base !== undefined && isDir(root, dest, eq)) return [...(canonical(root, dest, eq) ?? dest), base];
  return dest;
};

/** Visit every node under a directory, depth first, in name order. */
export const walk = (node: VNode, path: Path = []): readonly (readonly [Path, VNode])[] => {
  const out: (readonly [Path, VNode])[] = [[path, node]];
  if (node.kind === 'dir') {
    for (const [name, child] of Object.entries(node.children).sort(([a], [b]) => a.localeCompare(b))) {
      out.push(...walk(child, [...path, name]));
    }
  }
  return out;
};
