import type { MachineState } from '../../types';
import { globMatch, hasGlob } from '../../shell/glob';
import type { WordPart } from '../../shell/tokenize';
import { getNode } from '../../vfs/vfs';
import { formatPosixPath, parsePosixPath } from './paths';

const expandVars = (text: string, state: MachineState, lastExit: number): string =>
  text.replace(/\$(\?|[A-Za-z_][A-Za-z0-9_]*|\{[A-Za-z_][A-Za-z0-9_]*\})/g, (_m, name: string) => {
    if (name === '?') return String(lastExit);
    const key = name.startsWith('{') ? name.slice(1, -1) : name;
    return state.env[key] ?? '';
  });

/** Expand one word: tilde, variables, then (for unquoted glob characters) pathname expansion. */
export const expandWord = (parts: readonly WordPart[], state: MachineState, lastExit = 0): readonly string[] =>
  expandWordDetailed(parts, state, lastExit).words;

/** Like expandWord, but also reports an unmatched glob (zsh treats that as an error). */
export const expandWordDetailed = (
  parts: readonly WordPart[],
  state: MachineState,
  lastExit = 0,
): { readonly words: readonly string[]; readonly nomatch?: string } => {
  let text = '';
  // pattern keeps glob chars only where they were unquoted
  let pattern = '';
  let globbable = false;
  parts.forEach((p, i) => {
    if (p.quote === 'single') {
      text += p.text;
      pattern += p.text.replace(/[*?[]/g, '\\$&');
      return;
    }
    let t = p.text;
    if (p.quote === 'none' && i === 0 && (t === '~' || t.startsWith('~/'))) {
      t = formatPosixPath(state.home) + t.slice(1);
    }
    t = expandVars(t, state, lastExit);
    text += t;
    if (p.quote === 'none' && hasGlob(t)) {
      globbable = true;
      pattern += t;
    } else {
      pattern += t.replace(/[*?[]/g, '\\$&');
    }
  });
  const quotedEmpty = text === '' && parts.some((p) => p.quote !== 'none');
  if (text === '' && !quotedEmpty) return { words: [] };
  if (!globbable) return { words: [text] };
  const matches = expandGlob(pattern, state);
  return matches.length > 0 ? { words: matches } : { words: [text], nomatch: text };
};

/** Pathname expansion, segment by segment. Hidden files only match patterns starting with `.`. */
const expandGlob = (pattern: string, state: MachineState): readonly string[] => {
  const absolute = pattern.startsWith('/');
  const segs = pattern.split('/').filter((s, i) => s.length > 0 || i === 0);
  let candidates: { display: string[]; }[] = [{ display: absolute ? [''] : [] }];
  for (const seg of segs) {
    if (seg === '') continue;
    const next: { display: string[] }[] = [];
    for (const c of candidates) {
      if (!hasGlobUnescaped(seg)) {
        next.push({ display: [...c.display, unescape(seg)] });
        continue;
      }
      const dirPath = parsePosixPath(c.display.length === 0 ? '.' : c.display.join('/') || '/', state);
      if (dirPath === null) continue;
      const node = getNode(state.root, dirPath);
      if (!node.ok || node.value.kind !== 'dir') continue;
      const names = Object.keys(node.value.children).sort((a, b) => a.localeCompare(b));
      for (const name of names) {
        if (name.startsWith('.') && !seg.startsWith('.')) continue;
        if (globMatch(seg, name)) next.push({ display: [...c.display, name] });
      }
    }
    candidates = next;
  }
  return candidates.map((c) => c.display.join('/') || '/');
};

const hasGlobUnescaped = (s: string): boolean => /(^|[^\\])[*?[]/.test(s);
const unescape = (s: string): string => s.replace(/\\([*?[])/g, '$1');
