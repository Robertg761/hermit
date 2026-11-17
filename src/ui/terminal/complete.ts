import type { Dialect } from '../../domain/dialects/dialect';
import type { MachineState, VNode } from '../../domain/types';

/**
 * Tab completion, like a real shell: the word under the cursor is finished from the names in
 * its folder (or from command names, for the first word). One match completes it; several
 * extend it to what they share, and a second Tab lists them.
 */
export type Completion = {
  /** The line with the word completed (unchanged if nothing could be added). */
  readonly line: string;
  /** Every match, for listing when the word could not be extended. */
  readonly matches: readonly string[];
};

const commonPrefix = (words: readonly string[], ci: boolean): string => {
  const first = words[0] ?? '';
  let n = first.length;
  for (const w of words.slice(1)) {
    let i = 0;
    while (i < n && i < w.length && (ci ? w[i]?.toLowerCase() === first[i]?.toLowerCase() : w[i] === first[i])) i++;
    n = i;
  }
  return first.slice(0, n);
};

export const completeLine = (line: string, dialect: Dialect, state: MachineState): Completion => {
  const ci = dialect.caseInsensitive;
  const sep = dialect.os === 'windows' ? '\\' : '/';
  const start = line.lastIndexOf(' ') + 1;
  const word = line.slice(start);
  const head = line.slice(0, start);
  const starts = (name: string, prefix: string): boolean => (ci ? name.toLowerCase().startsWith(prefix.toLowerCase()) : name.startsWith(prefix));

  if (head.trim() === '' && !/[\\/]/.test(word)) {
    if (word === '') return { line, matches: [] };
    const names = [...new Set([...Object.keys(dialect.commands), ...Object.keys(dialect.aliases)])].filter((n) => starts(n, word) && !n.startsWith('_')).sort();
    return finish(head, '', word, names.map((n) => ({ name: n, dir: false })), ci, sep);
  }

  const cut = Math.max(word.lastIndexOf('/'), word.lastIndexOf('\\')) + 1;
  const dirPart = word.slice(0, cut);
  const prefix = word.slice(cut);
  const dirPath = dialect.parsePath(dirPart === '' ? '.' : dirPart, state);
  if (dirPath === null) return { line, matches: [] };
  let node: VNode | undefined = state.root;
  for (const seg of dirPath) {
    if (node?.kind !== 'dir') return { line, matches: [] };
    const key: string | undefined = ci ? Object.keys(node.children).find((k) => k.toLowerCase() === seg.toLowerCase()) : seg;
    node = key === undefined ? undefined : node.children[key];
  }
  if (node?.kind !== 'dir') return { line, matches: [] };
  const entries = Object.entries(node.children)
    .filter(([name, child]) => starts(name, prefix) && (prefix.startsWith('.') || !(name.startsWith('.') && dialect.os !== 'windows')) && (child.hidden !== true || prefix !== ''))
    .map(([name, child]) => ({ name, dir: child.kind === 'dir' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return finish(head, dirPart, prefix, entries, ci, sep);
};

const finish = (
  head: string,
  dirPart: string,
  prefix: string,
  entries: readonly { readonly name: string; readonly dir: boolean }[],
  ci: boolean,
  sep: string,
): Completion => {
  const original = head + dirPart + prefix;
  if (entries.length === 0) return { line: original, matches: [] };
  const only = entries.length === 1 ? entries[0] : undefined;
  if (only !== undefined) {
    const quoted = only.name.includes(' ') ? `"${dirPart}${only.name}` : `${dirPart}${only.name}`;
    const tail = only.dir ? sep : only.name.includes(' ') ? '" ' : ' ';
    return { line: head + quoted + tail, matches: [only.name] };
  }
  const shared = commonPrefix(entries.map((e) => e.name), ci);
  const extended = shared.length > prefix.length ? head + dirPart + shared : original;
  return { line: extended, matches: entries.map((e) => (e.dir ? e.name + sep : e.name)) };
};
