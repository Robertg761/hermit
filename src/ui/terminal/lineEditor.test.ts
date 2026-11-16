import { describe, expect, it } from 'vitest';
import { applyInput, emptyEditor, type EditorState } from './lineEditor';

const type = (s: EditorState, ...chunks: string[]) => {
  let state = s;
  const actions = [];
  for (const c of chunks) {
    const r = applyInput(state, c);
    state = r.state;
    actions.push(...r.actions);
  }
  return { state, actions };
};

describe('line editor', () => {
  it('types and submits', () => {
    const r = type(emptyEditor(), 'l', 's', '\r');
    expect(r.actions.filter((a) => a.kind === 'submit')).toEqual([{ kind: 'submit', line: 'ls' }]);
    expect(r.state.buffer).toBe('');
    expect(r.state.history).toEqual(['ls']);
  });
  it('backspaces and moves the cursor', () => {
    const r = type(emptyEditor(), 'lx', '\x7f', 's', '\x1b[D', '\x1b[D', 'a');
    expect(r.state.buffer).toBe('als');
    expect(r.state.cursor).toBe(1);
  });
  it('walks history up and down, keeping the draft', () => {
    let s = type(emptyEditor(), 'pwd\r', 'ls\r').state;
    s = type(s, 'cd').state;
    s = type(s, '\x1b[A').state;
    expect(s.buffer).toBe('ls');
    s = type(s, '\x1b[A').state;
    expect(s.buffer).toBe('pwd');
    s = type(s, '\x1b[A').state;
    expect(s.buffer).toBe('pwd');
    s = type(s, '\x1b[B', '\x1b[B').state;
    expect(s.buffer).toBe('cd');
  });
  it('does not store blank lines or repeats in history', () => {
    const s = type(emptyEditor(), '\r', 'ls\r', 'ls\r').state;
    expect(s.history).toEqual(['ls']);
  });
  it('Ctrl+C cancels the line', () => {
    const r = type(emptyEditor(), 'rm -rf', '\x03');
    expect(r.actions).toContainEqual({ kind: 'cancel', line: 'rm -rf' });
    expect(r.state.buffer).toBe('');
  });
  it('Ctrl+L asks for a clear screen', () => {
    expect(type(emptyEditor(), '\x0c').actions).toContainEqual({ kind: 'clearScreen' });
  });
  it('pastes several lines as several submissions', () => {
    const r = type(emptyEditor(), 'mkdir a\r\ncd a\npwd');
    expect(r.actions.filter((a) => a.kind === 'submit')).toEqual([
      { kind: 'submit', line: 'mkdir a' },
      { kind: 'submit', line: 'cd a' },
    ]);
    expect(r.state.buffer).toBe('pwd');
  });
  it('Home, End, Ctrl+U and Ctrl+W edit the line', () => {
    let s = type(emptyEditor(), 'echo hello world').state;
    s = type(s, '\x17').state;
    expect(s.buffer).toBe('echo hello ');
    s = type(s, '\x1b[H').state;
    expect(s.cursor).toBe(0);
    s = type(s, '\x1b[F', '\x15').state;
    expect(s.buffer).toBe('');
  });
  it('ignores unknown escape sequences', () => {
    expect(type(emptyEditor(), 'a\x1b[15~b').state.buffer).toBe('ab');
  });
});
