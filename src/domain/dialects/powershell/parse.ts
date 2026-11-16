/**
 * A small PowerShell parser: enough for the curriculum's commands, pipelines,
 * redirects, strings, variables and `(pipeline).Property`.
 */

export type StringPart = { readonly text: string; readonly expand: boolean };

export type Expr =
  | { readonly kind: 'bare'; readonly text: string }
  | { readonly kind: 'string'; readonly text: string; readonly expand: boolean }
  | { readonly kind: 'var'; readonly name: string }
  | { readonly kind: 'sub'; readonly body: StatementList; readonly members: readonly string[] }
  | { readonly kind: 'array'; readonly items: readonly Expr[] }
  /** `{ ... }`: kept as source text; only Where-Object and ForEach-Object read it. */
  | { readonly kind: 'block'; readonly text: string };

export type Arg = { readonly kind: 'param'; readonly name: string; readonly value?: Expr } | { readonly kind: 'value'; readonly expr: Expr };

export type Element =
  | { readonly kind: 'command'; readonly name: string; readonly args: readonly Arg[]; readonly invoke?: boolean }
  | { readonly kind: 'expr'; readonly expr: Expr }
  | { readonly kind: 'assign'; readonly target: string; readonly value: Pipeline };

export type Redirect = { readonly op: '>' | '>>' | '2>' | '2>>'; readonly target: Expr };

export type Pipeline = { readonly elements: readonly Element[]; readonly redirects: readonly Redirect[] };

export type StatementList = readonly { readonly connector: ';' | '&&' | '||'; readonly pipeline: Pipeline }[];

export type ParseResult = { readonly ok: true; readonly list: StatementList } | { readonly ok: false; readonly error: string };

class ParseError extends Error {}

const isSpace = (c: string | undefined): boolean => c === ' ' || c === '\t';
const BARE_STOP = new Set([' ', '\t', '|', ';', '>', '(', ')', ',', '{', '}', '&']);

export const parsePowerShell = (line: string): ParseResult => {
  let i = 0;
  const peek = (o = 0): string | undefined => line[i + o];
  const skip = (): void => {
    while (isSpace(peek())) i++;
  };
  const at = (s: string): boolean => line.startsWith(s, i);

  const readQuoted = (): Expr => {
    const q = peek();
    i++;
    let text = '';
    for (;;) {
      const c = peek();
      if (c === undefined) throw new ParseError(`The string is missing the terminator: ${q ?? ''}.`);
      if (c === q) {
        if (peek(1) === q) {
          text += q;
          i += 2;
          continue;
        }
        i++;
        break;
      }
      if (q === '"' && c === '`') {
        const n = peek(1) ?? '';
        text += n === 'n' ? '\n' : n === 't' ? '\t' : n;
        i += 2;
        continue;
      }
      text += c;
      i++;
    }
    return { kind: 'string', text, expand: q === '"' };
  };

  const readVariable = (): Expr => {
    i++; // $
    const m = /^(?:env:[A-Za-z_][A-Za-z0-9_]*|[A-Za-z_][A-Za-z0-9_]*|\?|_)/.exec(line.slice(i));
    if (m === null) return { kind: 'bare', text: '$' };
    i += m[0].length;
    return { kind: 'var', name: m[0] };
  };

  const readMembers = (): string[] => {
    const members: string[] = [];
    while (peek() === '.' && /[A-Za-z_]/.test(peek(1) ?? '')) {
      i++;
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(line.slice(i));
      if (m === null) break;
      members.push(m[0]);
      i += m[0].length;
    }
    return members;
  };

  const readBare = (): string => {
    let text = '';
    while (i < line.length) {
      const c = peek() ?? '';
      if (BARE_STOP.has(c)) {
        // `2>` is only a redirect at the start of a token
        break;
      }
      if (c === '`') {
        text += peek(1) ?? '';
        i += 2;
        continue;
      }
      if (c === '"' || c === "'") {
        const s = readQuoted();
        if (s.kind === 'string') text += s.text;
        continue;
      }
      text += c;
      i++;
    }
    return text;
  };

  const readPrimary = (): Expr => {
    const c = peek();
    if (c === '"' || c === "'") return readQuoted();
    if (c === '$' && peek(1) !== '(') {
      const v = readVariable();
      if (v.kind === 'var') {
        const members = readMembers();
        if (members.length > 0) return { kind: 'sub', body: [{ connector: ';', pipeline: { elements: [{ kind: 'expr', expr: v }], redirects: [] } }], members };
      }
      return v;
    }
    if (c === '(' || (c === '$' && peek(1) === '(')) {
      i += c === '$' ? 2 : 1;
      const body = readStatements(')');
      if (peek() !== ')') throw new ParseError("Missing closing ')' in expression.");
      i++;
      return { kind: 'sub', body, members: readMembers() };
    }
    if (c === '{') {
      let depth = 0;
      const start = i;
      for (; i < line.length; i++) {
        const ch = line[i];
        if (ch === '{') depth++;
        if (ch === '}') {
          depth--;
          if (depth === 0) break;
        }
      }
      if (depth !== 0) throw new ParseError("Missing closing '}' in statement block or type definition.");
      i++;
      return { kind: 'block', text: line.slice(start + 1, i - 1).trim() };
    }
    return { kind: 'bare', text: readBare() };
  };

  const readExpr = (): Expr => {
    const first = readPrimary();
    skip();
    if (peek() !== ',') return first;
    const items = [first];
    while (peek() === ',') {
      i++;
      skip();
      items.push(readPrimary());
      skip();
    }
    return { kind: 'array', items };
  };

  const readElement = (): Element => {
    skip();
    const c = peek();
    if (c === '{') throw new ParseError('SCRIPTBLOCK');
    if (c === '&') {
      i++;
      skip();
      const target = readPrimary();
      const name = target.kind === 'bare' || target.kind === 'string' ? target.text : '';
      return { kind: 'command', name, args: readArgs(), invoke: true };
    }
    if (c === '"' || c === "'" || c === '(' || c === '$' || /[0-9]/.test(c ?? '')) {
      if (c === '$') {
        // assignment: $env:NAME = value
        const save = i;
        const v = readVariable();
        skip();
        if (v.kind === 'var' && peek() === '=' && peek(1) !== '=') {
          i++;
          skip();
          const value = readPipeline(new Set([';', '&&', '||', ')']));
          return { kind: 'assign', target: v.name, value };
        }
        i = save;
      }
      if (/[0-9]/.test(c ?? '') && !/^[0-9]+(\s|$|[|;)])/.test(line.slice(i))) {
        // something like 7zip: treat as a command name
      } else {
        return { kind: 'expr', expr: readExpr() };
      }
    }
    const name = readBare();
    if (name === '') throw new ParseError(`An empty pipe element is not allowed.`);
    return { kind: 'command', name, args: readArgs() };
  };

  const readArgs = (): Arg[] => {
    const args: Arg[] = [];
    for (;;) {
      skip();
      const c = peek();
      if (c === undefined || c === '|' || c === ';' || c === ')' || c === '}' || at('&&') || at('||') || at('>') || at('2>')) break;
      if (c === '-' && /[A-Za-z?]/.test(peek(1) ?? '')) {
        i++;
        let name = '';
        while (i < line.length && !BARE_STOP.has(peek() ?? '') && peek() !== ':') {
          name += peek();
          i++;
        }
        if (peek() === ':') {
          i++;
          args.push({ kind: 'param', name, value: readPrimary() });
        } else args.push({ kind: 'param', name });
        continue;
      }
      args.push({ kind: 'value', expr: readExpr() });
    }
    return args;
  };

  const readPipeline = (stops: ReadonlySet<string>): Pipeline => {
    const elements: Element[] = [];
    const redirects: Redirect[] = [];
    for (;;) {
      skip();
      elements.push(readElement());
      skip();
      while (at('>') || at('2>')) {
        const op = at('2>>') ? '2>>' : at('2>') ? '2>' : at('>>') ? '>>' : '>';
        i += op.length;
        skip();
        redirects.push({ op, target: readPrimary() });
        skip();
      }
      if (peek() === '|' && peek(1) !== '|') {
        i++;
        skip();
        if (peek() === undefined) throw new ParseError('An empty pipe element is not allowed.');
        continue;
      }
      break;
    }
    void stops;
    return { elements, redirects };
  };

  const readStatements = (close?: string): StatementList => {
    const list: { connector: ';' | '&&' | '||'; pipeline: Pipeline }[] = [];
    let connector: ';' | '&&' | '||' = ';';
    for (;;) {
      skip();
      if (peek() === undefined || peek() === close) break;
      if (peek() === '#') {
        i = line.length;
        break;
      }
      list.push({ connector, pipeline: readPipeline(new Set()) });
      skip();
      if (peek() === ';') {
        i++;
        connector = ';';
        continue;
      }
      if (at('&&') || at('||')) {
        connector = at('&&') ? '&&' : '||';
        i += 2;
        skip();
        if (peek() === undefined) throw new ParseError(`Missing expression after '${connector}' in pipeline chain.`);
        continue;
      }
      if (peek() === undefined || peek() === close) break;
      throw new ParseError(`Unexpected token '${line.slice(i).split(' ')[0] ?? ''}' in expression or statement.`);
    }
    return list;
  };

  try {
    const list = readStatements();
    if (i < line.length && line[i] === ')') throw new ParseError("Unexpected token ')' in expression or statement.");
    return { ok: true, list };
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e.message };
    throw e;
  }
};
