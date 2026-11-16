/**
 * A minimal readline: pure state transitions for one editable input line plus history.
 * The xterm wrapper feeds it raw key data and renders the result.
 */
export type EditorState = {
  readonly buffer: string;
  readonly cursor: number;
  readonly history: readonly string[];
  /** Position while browsing history; equals history.length when editing a fresh line. */
  readonly historyIndex: number;
  /** The fresh line being typed before the user started browsing history. */
  readonly draft: string;
};

export type EditorAction =
  | { readonly kind: 'none' }
  | { readonly kind: 'redraw' }
  | { readonly kind: 'submit'; readonly line: string }
  | { readonly kind: 'cancel'; readonly line: string }
  | { readonly kind: 'clearScreen' }
  | { readonly kind: 'tab' };

export const emptyEditor = (history: readonly string[] = []): EditorState => ({
  buffer: '',
  cursor: 0,
  history,
  historyIndex: history.length,
  draft: '',
});

const insert = (s: EditorState, text: string): EditorState => ({
  ...s,
  buffer: s.buffer.slice(0, s.cursor) + text + s.buffer.slice(s.cursor),
  cursor: s.cursor + text.length,
});

const fresh = (s: EditorState, line: string): EditorState => {
  const trimmed = line.trim();
  const history = trimmed.length > 0 && s.history[s.history.length - 1] !== line ? [...s.history, line] : s.history;
  return emptyEditor(history);
};

const recall = (s: EditorState, index: number): EditorState => {
  const draft = s.historyIndex === s.history.length ? s.buffer : s.draft;
  const buffer = index === s.history.length ? draft : (s.history[index] ?? '');
  return { ...s, historyIndex: index, buffer, cursor: buffer.length, draft };
};

const wordLeft = (s: EditorState): number => {
  let i = s.cursor;
  while (i > 0 && s.buffer[i - 1] === ' ') i--;
  while (i > 0 && s.buffer[i - 1] !== ' ') i--;
  return i;
};

/**
 * Apply one chunk of terminal input. Pasted text may contain several lines; every line
 * but the last is submitted, so the caller gets a list of actions.
 */
export const applyInput = (state: EditorState, data: string): { state: EditorState; actions: readonly EditorAction[] } => {
  const actions: EditorAction[] = [];
  let s = state;
  let i = 0;
  let dirty = false;
  const push = (a: EditorAction): void => {
    if (dirty) actions.push({ kind: 'redraw' });
    dirty = false;
    actions.push(a);
  };
  while (i < data.length) {
    const rest = data.slice(i);
    const seq = ESCAPES.find(([code]) => rest.startsWith(code));
    if (seq !== undefined) {
      s = seq[1](s);
      dirty = true;
      i += seq[0].length;
      continue;
    }
    const c = data[i] ?? '';
    i++;
    switch (c) {
      case '\r':
      case '\n': {
        if (c === '\n' && data[i - 2] === '\r') break; // \r\n from paste
        const line = s.buffer;
        s = fresh(s, line);
        dirty = false;
        actions.push({ kind: 'submit', line });
        break;
      }
      case '\x7f':
      case '\b':
        if (s.cursor > 0) {
          s = { ...s, buffer: s.buffer.slice(0, s.cursor - 1) + s.buffer.slice(s.cursor), cursor: s.cursor - 1 };
          dirty = true;
        }
        break;
      case '\x03': {
        const line = s.buffer;
        s = { ...emptyEditor(s.history) };
        dirty = false;
        actions.push({ kind: 'cancel', line });
        break;
      }
      case '\x0c':
        push({ kind: 'clearScreen' });
        break;
      case '\x01':
        s = { ...s, cursor: 0 };
        dirty = true;
        break;
      case '\x05':
        s = { ...s, cursor: s.buffer.length };
        dirty = true;
        break;
      case '\x15':
        s = { ...s, buffer: s.buffer.slice(s.cursor), cursor: 0 };
        dirty = true;
        break;
      case '\x17': {
        const to = wordLeft(s);
        s = { ...s, buffer: s.buffer.slice(0, to) + s.buffer.slice(s.cursor), cursor: to };
        dirty = true;
        break;
      }
      case '\t':
        push({ kind: 'tab' });
        break;
      default:
        if (c >= ' ' && c !== '\x7f') {
          s = insert(s, c);
          dirty = true;
        } else if (c === '\x1b') {
          // unknown escape sequence: skip the rest of it
          const m = /^\[[0-9;]*[A-Za-z~]|^O[A-Za-z]/.exec(data.slice(i));
          if (m) i += m[0].length;
        }
    }
  }
  if (dirty) actions.push({ kind: 'redraw' });
  return { state: s, actions };
};

const ESCAPES: readonly (readonly [string, (s: EditorState) => EditorState])[] = [
  ['\x1b[D', (s) => ({ ...s, cursor: Math.max(0, s.cursor - 1) })],
  ['\x1b[C', (s) => ({ ...s, cursor: Math.min(s.buffer.length, s.cursor + 1) })],
  ['\x1b[A', (s) => (s.historyIndex > 0 ? recall(s, s.historyIndex - 1) : s)],
  ['\x1b[B', (s) => (s.historyIndex < s.history.length ? recall(s, s.historyIndex + 1) : s)],
  ['\x1b[H', (s) => ({ ...s, cursor: 0 })],
  ['\x1b[F', (s) => ({ ...s, cursor: s.buffer.length })],
  ['\x1bOH', (s) => ({ ...s, cursor: 0 })],
  ['\x1bOF', (s) => ({ ...s, cursor: s.buffer.length })],
  ['\x1b[1~', (s) => ({ ...s, cursor: 0 })],
  ['\x1b[4~', (s) => ({ ...s, cursor: s.buffer.length })],
  ['\x1b[3~', (s) => ({ ...s, buffer: s.buffer.slice(0, s.cursor) + s.buffer.slice(s.cursor + 1) })],
  ['\x1b[1;5D', (s) => ({ ...s, cursor: wordLeft(s) })],
  ['\x1b[1;5C', (s) => {
    let i = s.cursor;
    while (i < s.buffer.length && s.buffer[i] === ' ') i++;
    while (i < s.buffer.length && s.buffer[i] !== ' ') i++;
    return { ...s, cursor: i };
  }],
];

/** Replace the current line (used for Fix challenges and tab completion). */
export const setLine = (s: EditorState, line: string): EditorState => ({ ...s, buffer: line, cursor: line.length });
