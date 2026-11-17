import { useState } from 'react';
import type { DirNode, MachineState, OS, VNode } from '../../domain/types';

/**
 * The burrow map: the folders under home as a tree, with Herme marking where you are.
 * Folders only, never files, so it helps with `cd` and paths without giving away
 * what `ls` would show. Hidden folders stay hidden too.
 */

type Row = { readonly name: string; readonly depth: number; readonly path: readonly string[] };

const MAX_DEPTH = 4;
const STORE_KEY = 'hermit:map';

const isHidden = (name: string, node: VNode, os: OS): boolean => node.hidden === true || (os !== 'windows' && name.startsWith('.'));

const folderRows = (dir: DirNode, os: OS, path: readonly string[], depth: number): Row[] => {
  if (depth > MAX_DEPTH) return [];
  return Object.entries(dir.children)
    .filter(([name, node]) => node.kind === 'dir' && !isHidden(name, node, os))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .flatMap(([name, node]) => [{ name, depth, path: [...path, name] }, ...(node.kind === 'dir' ? folderRows(node, os, [...path, name], depth + 1) : [])]);
};

const dirAt = (root: DirNode, path: readonly string[], os: OS): DirNode | null => {
  let node: VNode = root;
  for (const seg of path) {
    if (node.kind !== 'dir') return null;
    const key: string | undefined = os === 'windows' ? Object.keys(node.children).find((k) => k.toLowerCase() === seg.toLowerCase()) : seg;
    const next: VNode | undefined = key === undefined ? undefined : node.children[key];
    if (next === undefined) return null;
    node = next;
  }
  return node.kind === 'dir' ? node : null;
};

const samePath = (a: readonly string[], b: readonly string[], os: OS): boolean =>
  a.length === b.length && a.every((s, i) => (os === 'windows' ? s.toLowerCase() === (b[i] ?? '').toLowerCase() : s === b[i]));

const readOpen = (fallback: boolean): boolean => {
  try {
    const v = window.localStorage.getItem(STORE_KEY);
    return v === null ? fallback : v === 'open';
  } catch {
    return fallback;
  }
};

export function BurrowMap({ machine, os, defaultOpen }: { readonly machine: MachineState; readonly os: OS; readonly defaultOpen: boolean }) {
  const [open, setOpen] = useState(() => readOpen(defaultOpen));
  const home = dirAt(machine.root, machine.home, os);
  if (home === null) return null;
  const rows = folderRows(home, os, machine.home, 1);
  const inHome = machine.cwd.length >= machine.home.length && samePath(machine.cwd.slice(0, machine.home.length), machine.home, os);
  const atHome = samePath(machine.cwd, machine.home, os);
  const homeLabel = os === 'windows' ? 'you (home)' : '~ (home)';
  const where = inHome ? [os === 'windows' ? 'home' : '~', ...machine.cwd.slice(machine.home.length)].join(os === 'windows' ? '\\' : '/') : 'outside your home folder';

  const toggle = (next: boolean): void => {
    setOpen(next);
    try {
      window.localStorage.setItem(STORE_KEY, next ? 'open' : 'closed');
    } catch {
      // the map just won't remember
    }
  };

  return (
    <details className="burrow-map" open={open} onToggle={(e) => toggle(e.currentTarget.open)}>
      <summary>
        <span className="burrow-map-title">Map</span>
        <span className="burrow-map-where">
          🦀 <code>{where}</code>
        </span>
      </summary>
      <ul aria-label="Folders in your home folder">
        <li className={atHome ? 'is-here' : undefined} aria-current={atHome ? 'location' : undefined}>
          <span className="burrow-map-icon" aria-hidden="true">
            🏠
          </span>
          {homeLabel}
          {atHome && <span className="burrow-map-crab"> ← you are here</span>}
        </li>
        {rows.map((row) => {
          const here = samePath(machine.cwd, row.path, os);
          return (
            <li key={row.path.join('/')} className={here ? 'is-here' : undefined} style={{ paddingLeft: `${row.depth * 16}px` }} aria-current={here ? 'location' : undefined}>
              <span className="burrow-map-icon" aria-hidden="true">
                📁
              </span>
              {row.name}
              {here && <span className="burrow-map-crab"> ← you are here</span>}
            </li>
          );
        })}
      </ul>
      {!inHome && <p className="burrow-map-note">You are outside your home folder.</p>}
    </details>
  );
}
