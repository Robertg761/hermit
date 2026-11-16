import { describe, expect, it } from 'vitest';
import { globMatch } from './glob';
import { parse } from './parse';
import { tokenize, type Token } from './tokenize';

const words = (line: string): string[] => {
  const r = tokenize(line);
  if (!r.ok) throw new Error(r.error);
  return r.tokens.map((t: Token) => (t.kind === 'word' ? t.parts.map((p) => p.text).join('') : `<${t.op}>`));
};

describe('tokenize', () => {
  it('splits on whitespace', () => {
    expect(words('ls  -la   projects')).toEqual(['ls', '-la', 'projects']);
  });
  it('keeps quoted spaces', () => {
    expect(words(`echo "hello world" 'it is'`)).toEqual(['echo', 'hello world', 'it is']);
  });
  it('joins adjacent quoted parts', () => {
    expect(words(`echo a"b c"'d'`)).toEqual(['echo', 'ab cd']);
  });
  it('recognises operators without spaces', () => {
    expect(words('ls|grep txt>out.txt&&cd ..;pwd')).toEqual(['ls', '<|>', 'grep', 'txt', '<>>', 'out.txt', '<&&>', 'cd', '..', '<;>', 'pwd']);
  });
  it('distinguishes > and >>', () => {
    expect(words('echo hi >> log.txt')).toEqual(['echo', 'hi', '<>>>', 'log.txt']);
  });
  it('handles backslash escapes', () => {
    expect(words('touch my\\ file.txt')).toEqual(['touch', 'my file.txt']);
  });
  it('reports unterminated quotes', () => {
    const r = tokenize('echo "oops');
    expect(r.ok).toBe(false);
  });
  it('ignores comments', () => {
    expect(words('ls # list')).toEqual(['ls']);
  });
  it('records quote kinds', () => {
    const r = tokenize(`echo '$HOME' "$HOME" $HOME`);
    if (!r.ok) throw new Error();
    const quotes = r.tokens.slice(1).map((t) => (t.kind === 'word' ? t.parts[0]?.quote : null));
    expect(quotes).toEqual(['single', 'double', 'none']);
  });
});

describe('parse', () => {
  const p = (line: string) => {
    const t = tokenize(line);
    if (!t.ok) throw new Error(t.error);
    return parse(t.tokens);
  };
  it('builds pipelines and lists', () => {
    const r = p('mkdir out && cd out; ls | grep x');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.list.map((i) => i.connector)).toEqual([';', '&&', ';']);
    expect(r.list[2]?.pipeline.commands.length).toBe(2);
  });
  it('attaches redirects to commands', () => {
    const r = p('ls > files.txt');
    if (!r.ok) throw new Error();
    expect(r.list[0]?.pipeline.commands[0]?.redirects[0]?.op).toBe('>');
  });
  it('rejects a dangling pipe', () => {
    const r = p('ls |');
    expect(r.ok).toBe(false);
  });
  it('rejects a leading operator', () => {
    const r = p('&& ls');
    expect(!r.ok && r.error).toBe("syntax error near unexpected token `&&'");
  });
  it('rejects a redirect without a target', () => {
    expect(p('ls >').ok).toBe(false);
  });
});

describe('glob', () => {
  it('matches * and ?', () => {
    expect(globMatch('*.txt', 'notes.txt')).toBe(true);
    expect(globMatch('*.txt', 'notes.md')).toBe(false);
    expect(globMatch('file?.log', 'file1.log')).toBe(true);
  });
  it('matches classes', () => {
    expect(globMatch('[ab]*', 'apple')).toBe(true);
    expect(globMatch('[!ab]*', 'apple')).toBe(false);
  });
  it('treats regex characters literally', () => {
    expect(globMatch('a.b', 'axb')).toBe(false);
  });
  it('supports case-insensitive matching', () => {
    expect(globMatch('*.TXT', 'a.txt', true)).toBe(true);
  });
});
