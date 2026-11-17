import { FitAddon } from '@xterm/addon-fit';
import { Terminal as XTerm } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef } from 'react';
import type { OS } from '../../domain/types';
import { applyInput, emptyEditor, setLine, type EditorState } from './lineEditor';
import { terminalThemes } from './themes';

export type TerminalReply = {
  readonly stdout: string;
  readonly stderr: string;
  readonly clear?: boolean;
  /** Extra line(s) from Hermit itself, shown in a dim colour after the command output. */
  readonly note?: string;
};

type Props = {
  readonly os: OS;
  /** Changing this clears the screen and starts a fresh session (new challenge). */
  readonly sessionKey: string;
  readonly prompt: () => string;
  readonly onLine: (line: string) => TerminalReply;
  readonly banner?: string;
  readonly prefill?: string;
  readonly disabled?: boolean;
  /** Type along: grey text shown after what the learner has typed so far. */
  readonly ghost?: string;
};

/** Break text at spaces so narrow terminals don't split words. */
const wrapWords = (text: string, cols: number): string =>
  text
    .split('\n')
    .map((line) => {
      const out: string[] = [];
      let cur = '';
      for (const word of line.split(' ')) {
        if (cur !== '' && cur.length + 1 + word.length > cols) {
          out.push(cur);
          cur = word;
        } else cur = cur === '' ? word : `${cur} ${word}`;
      }
      out.push(cur);
      return out.join('\n');
    })
    .join('\n');

const toCrlf = (s: string): string => s.replace(/\r?\n/g, '\r\n');
const ESC = String.fromCharCode(27);

const DIM = `${ESC}[2m`;
const RED = `${ESC}[31m`;
const RESET = `${ESC}[0m`;
const ANSI = new RegExp(`${ESC}\\[[0-9;]*[A-Za-z]`, 'g');

export function Terminal({ os, sessionKey, prompt, onLine, banner, prefill, disabled, ghost }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const editorRef = useRef<EditorState>(emptyEditor());
  // Latest callbacks, so the xterm listener (registered once) never goes stale.
  const onLineRef = useRef(onLine);
  const promptRef = useRef(prompt);
  const disabledRef = useRef(disabled ?? false);
  const ghostRef = useRef(ghost);
  useEffect(() => {
    onLineRef.current = onLine;
    promptRef.current = prompt;
    disabledRef.current = disabled ?? false;
    ghostRef.current = disabled ? undefined : ghost;
  });

  /** Rows the input line wraps onto: where the cursor sits, and the last row drawn. */
  const rowsRef = useRef({ cursor: 0, end: 0 });

  /**
   * Draw the prompt and input line. Long lines wrap onto several rows on narrow screens,
   * so this climbs back to the line's first row, clears below, and places the cursor by row and column.
   */
  const redraw = (term: XTerm): void => {
    const p = promptRef.current();
    const e = editorRef.current;
    const g = ghostRef.current;
    const showGhost = g !== undefined && e.cursor === e.buffer.length && g.length > e.buffer.length && g.startsWith(e.buffer);
    const rest = showGhost ? g.slice(e.buffer.length) : '';
    const up = rowsRef.current.cursor;
    term.write(`${up > 0 ? `${ESC}[${up}A` : ''}\r${ESC}[J${p}${e.buffer}${rest ? `${DIM}${rest}${RESET}` : ''}`);
    const cols = Math.max(1, term.cols);
    const promptLen = p.replace(ANSI, '').length;
    const total = promptLen + e.buffer.length + rest.length;
    const end = total === 0 ? 0 : total % cols === 0 ? total / cols - 1 : Math.floor(total / cols);
    const target = promptLen + e.cursor;
    let row = Math.floor(target / cols);
    const col = target % cols;
    if (row > end) {
      // The cursor belongs at the start of a row that doesn't exist yet: make it.
      term.write('\r\n');
      row = end + 1;
      rowsRef.current = { cursor: row, end: row };
      return;
    }
    term.write(`${end - row > 0 ? `${ESC}[${end - row}A` : ''}\r${col > 0 ? `${ESC}[${col}C` : ''}`);
    rowsRef.current = { cursor: row, end };
  };

  /** Leave the input line: move below its last row, ready for output. */
  const newline = (term: XTerm): void => {
    const down = rowsRef.current.end - rowsRef.current.cursor;
    term.write(`${down > 0 ? `${ESC}[${down}B` : ''}\r\n`);
    rowsRef.current = { cursor: 0, end: 0 };
  };

  // Create the terminal once.
  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;
    const term = new XTerm({
      fontFamily: "ui-monospace, 'Cascadia Mono', 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
      fontSize: 15,
      lineHeight: 1.25,
      cursorBlink: true,
      convertEol: false,
      scrollback: 1000,
      allowProposedApi: false,
      theme: terminalThemes[os],
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();
    termRef.current = term;

    const onResize = (): void => fit.fit();
    const observer = new ResizeObserver(onResize);
    observer.observe(host);

    const sub = term.onData((data) => {
      if (disabledRef.current) return;
      const { state, actions } = applyInput(editorRef.current, data);
      editorRef.current = state;
      for (const action of actions) {
        switch (action.kind) {
          case 'redraw':
            redraw(term);
            break;
          case 'submit': {
            newline(term);
            const reply = onLineRef.current(action.line);
            if (reply.clear) term.clear();
            if (reply.stdout) term.write(toCrlf(reply.stdout.endsWith('\n') ? reply.stdout : reply.stdout + '\n'));
            if (reply.stderr) term.write(RED + toCrlf(reply.stderr) + RESET + '\r\n');
            if (reply.note) term.write(DIM + toCrlf(reply.note) + RESET + '\r\n');
            if (reply.clear) term.write(`${ESC}[2J${ESC}[H`);
            rowsRef.current = { cursor: 0, end: 0 };
            redraw(term);
            break;
          }
          case 'cancel':
            term.write('^C');
            newline(term);
            redraw(term);
            break;
          case 'clearScreen':
            rowsRef.current = { cursor: 0, end: 0 };
            term.write(`${ESC}[2J${ESC}[H`);
            term.clear();
            redraw(term);
            break;
          case 'tab':
          case 'none':
            break;
        }
      }
    });
    return () => {
      sub.dispose();
      observer.disconnect();
      term.dispose();
      termRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start a fresh session whenever the challenge changes.
  useEffect(() => {
    const term = termRef.current;
    if (term === null) return;
    term.reset();
    rowsRef.current = { cursor: 0, end: 0 };
    editorRef.current = setLine(emptyEditor(editorRef.current.history), prefill ?? '');
    if (banner) term.write(DIM + toCrlf(wrapWords(banner, term.cols)) + RESET + '\r\n');
    redraw(term);
    term.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  useEffect(() => {
    const term = termRef.current;
    if (term === null) return;
    term.options.theme = terminalThemes[os];
  }, [os]);

  useEffect(() => {
    const term = termRef.current;
    if (term === null) return;
    term.options.cursorBlink = !disabled;
    ghostRef.current = disabled ? undefined : ghost;
    redraw(term);
    if (!disabled) term.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  return <div className="terminal-host" ref={hostRef} onClick={() => termRef.current?.focus()} />;
}
