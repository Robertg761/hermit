/**
 * POSIX-ish tokenizer used by the Bash and zsh dialects.
 * Produces words (as quoted/unquoted parts, so expansion can respect quoting) and operators.
 */

export type Quote = 'none' | 'single' | 'double';
export type WordPart = { readonly text: string; readonly quote: Quote };
export type Operator = '|' | '>' | '>>' | '<' | '&&' | '||' | ';' | '2>' | '2>>' | '&>' | '&';

export type Token =
  | { readonly kind: 'word'; readonly parts: readonly WordPart[] }
  | { readonly kind: 'op'; readonly op: Operator };

export type TokenizeResult =
  | { readonly ok: true; readonly tokens: readonly Token[] }
  | { readonly ok: false; readonly error: string };

const OPERATORS: readonly Operator[] = ['2>>', '>>', '&&', '||', '2>', '&>', '|', '>', '<', ';', '&'];

export const tokenize = (line: string): TokenizeResult => {
  const tokens: Token[] = [];
  let parts: WordPart[] = [];
  let buf = '';
  let inWord = false;

  const flushPart = (quote: Quote): void => {
    if (buf.length > 0 || quote !== 'none') parts.push({ text: buf, quote });
    buf = '';
  };
  const flushWord = (): void => {
    flushPart('none');
    if (inWord) tokens.push({ kind: 'word', parts: parts.filter((p) => p.text.length > 0 || p.quote !== 'none') });
    parts = [];
    inWord = false;
  };

  let i = 0;
  while (i < line.length) {
    const c = line[i] ?? '';

    if (c === ' ' || c === '\t') {
      flushWord();
      i++;
      continue;
    }

    if (c === '#' && !inWord) break; // comment

    // `2>` only counts as an operator at the start of a word.
    const op = OPERATORS.find((o) => line.startsWith(o, i) && (!/^\d/.test(o) || !inWord));
    if (op !== undefined) {
      flushWord();
      tokens.push({ kind: 'op', op });
      i += op.length;
      continue;
    }

    if (c === '\\') {
      inWord = true;
      const next = line[i + 1];
      if (next !== undefined) {
        flushPart('none');
        parts.push({ text: next, quote: 'single' });
      }
      i += 2;
      continue;
    }

    if (c === "'" || c === '"') {
      inWord = true;
      flushPart('none');
      const close = findClose(line, i + 1, c);
      if (close === -1) return { ok: false, error: `unexpected EOF while looking for matching \`${c}'` };
      let text = line.slice(i + 1, close);
      if (c === '"') text = text.replace(/\\(["\\$`])/g, '$1');
      parts.push({ text, quote: c === "'" ? 'single' : 'double' });
      i = close + 1;
      continue;
    }

    inWord = true;
    buf += c;
    i++;
  }
  flushWord();
  return { ok: true, tokens };
};

const findClose = (line: string, from: number, q: string): number => {
  for (let j = from; j < line.length; j++) {
    if (q === '"' && line[j] === '\\') {
      j++;
      continue;
    }
    if (line[j] === q) return j;
  }
  return -1;
};
