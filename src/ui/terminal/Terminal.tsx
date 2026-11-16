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
};

const toCrlf = (s: string): string => s.replace(/\r?\n/g, '\r\n');
const ESC = String.fromCharCode(27);

const DIM = `${ESC}[2m`;
const RED = `${ESC}[31m`;
const RESET = `${ESC}[0m`;

export function Terminal({ os, sessionKey, prompt, onLine, banner, prefill, disabled }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const editorRef = useRef<EditorState>(emptyEditor());
  // Latest callbacks, so the xterm listener (registered once) never goes stale.
  const onLineRef = useRef(onLine);
  const promptRef = useRef(prompt);
  const disabledRef = useRef(disabled ?? false);
  useEffect(() => {
    onLineRef.current = onLine;
    promptRef.current = prompt;
    disabledRef.current = disabled ?? false;
  });

  const redraw = (term: XTerm): void => {
    const p = promptRef.current();
    const e = editorRef.current;
    term.write(`\r${ESC}[K${p}${e.buffer}`);
    const back = e.buffer.length - e.cursor;
    if (back > 0) term.write(`${ESC}[${back}D`);
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
            term.write('\r\n');
            const reply = onLineRef.current(action.line);
            if (reply.clear) term.clear();
            if (reply.stdout) term.write(toCrlf(reply.stdout.endsWith('\n') ? reply.stdout : reply.stdout + '\n'));
            if (reply.stderr) term.write(RED + toCrlf(reply.stderr) + RESET + '\r\n');
            if (reply.note) term.write(DIM + toCrlf(reply.note) + RESET + '\r\n');
            if (reply.clear) term.write(`${ESC}[2J${ESC}[H`);
            redraw(term);
            break;
          }
          case 'cancel':
            term.write('^C\r\n');
            redraw(term);
            break;
          case 'clearScreen':
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
    editorRef.current = setLine(emptyEditor(editorRef.current.history), prefill ?? '');
    if (banner) term.write(DIM + toCrlf(banner) + RESET + '\r\n');
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
    if (!disabled) term.focus();
  }, [disabled]);

  return <div className="terminal-host" ref={hostRef} onClick={() => termRef.current?.focus()} />;
}
