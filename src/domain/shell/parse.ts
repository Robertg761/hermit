import type { Operator, Token, WordPart } from './tokenize';

export type Redirect = { readonly op: '>' | '>>' | '<' | '2>' | '2>>' | '&>'; readonly target: readonly WordPart[] };

export type SimpleCommand = { readonly words: readonly (readonly WordPart[])[]; readonly redirects: readonly Redirect[] };

export type Pipeline = { readonly commands: readonly SimpleCommand[] };

/** A list of pipelines joined by `&&`, `||` or `;`. The first item has connector `;`. */
export type CommandList = readonly { readonly connector: ';' | '&&' | '||'; readonly pipeline: Pipeline }[];

export type ParseResult = { readonly ok: true; readonly list: CommandList } | { readonly ok: false; readonly error: string };

const isRedirect = (op: Operator): op is Redirect['op'] =>
  op === '>' || op === '>>' || op === '<' || op === '2>' || op === '2>>' || op === '&>';

const syntaxError = (tok: string): ParseResult => ({ ok: false, error: `syntax error near unexpected token \`${tok}'` });

export const parse = (tokens: readonly Token[]): ParseResult => {
  const list: { connector: ';' | '&&' | '||'; pipeline: Pipeline }[] = [];
  let connector: ';' | '&&' | '||' = ';';
  let commands: SimpleCommand[] = [];
  let words: (readonly WordPart[])[] = [];
  let redirects: Redirect[] = [];

  const endCommand = (tok: string): ParseResult | null => {
    if (words.length === 0 && redirects.length === 0) return syntaxError(tok);
    commands.push({ words, redirects });
    words = [];
    redirects = [];
    return null;
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === undefined) break;
    if (t.kind === 'word') {
      words.push(t.parts);
      continue;
    }
    const op = t.op;
    if (isRedirect(op)) {
      const target = tokens[i + 1];
      if (target === undefined || target.kind !== 'word') return syntaxError(target?.kind === 'op' ? target.op : 'newline');
      redirects.push({ op, target: target.parts });
      i++;
      continue;
    }
    if (op === '|') {
      const err = endCommand('|');
      if (err) return err;
      continue;
    }
    if (op === '&') return { ok: false, error: 'background jobs (&) are not simulated' };
    // ; && ||
    const err = endCommand(op);
    if (err) return err;
    list.push({ connector, pipeline: { commands } });
    commands = [];
    connector = op;
  }

  if (words.length > 0 || redirects.length > 0) {
    commands.push({ words, redirects });
  } else if (commands.length > 0) {
    return syntaxError('newline'); // trailing pipe
  }
  if (commands.length > 0) list.push({ connector, pipeline: { commands } });
  else if (connector === '&&' || connector === '||') return syntaxError('newline');
  return { ok: true, list };
};
