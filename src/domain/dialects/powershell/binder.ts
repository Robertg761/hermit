import type { PsObject } from '../dialect';
import { objectToString } from './format';

export type ParamSpec = {
  readonly name: string;
  readonly kind: 'switch' | 'value';
  readonly position?: number;
  readonly aliases?: readonly string[];
  /** Takes all remaining positional values (like Write-Output's InputObject). */
  readonly remaining?: boolean;
  /** .NET type shown in "Missing an argument" errors. */
  readonly type?: string;
};

export type BoundArg = { readonly kind: 'param'; readonly name: string; readonly value?: readonly PsObject[] } | { readonly kind: 'value'; readonly value: readonly PsObject[] };

export type Bound = {
  readonly switches: ReadonlySet<string>;
  readonly values: Readonly<Record<string, readonly PsObject[]>>;
};

export type BindResult = { readonly ok: true; readonly bound: Bound } | { readonly ok: false; readonly error: string };

/** Bind evaluated arguments to a cmdlet's parameters: prefix matching, case-insensitive, positional. */
export const bind = (cmdlet: string, params: readonly ParamSpec[], args: readonly BoundArg[]): BindResult => {
  const switches = new Set<string>();
  const values: Record<string, readonly PsObject[]> = {};
  const positional: (readonly PsObject[])[] = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === undefined) continue;
    if (a.kind === 'value') {
      positional.push(a.value);
      continue;
    }
    const lower = a.name.toLowerCase();
    const exact = params.find((p) => p.name.toLowerCase() === lower || p.aliases?.some((al) => al.toLowerCase() === lower));
    const matches = exact ? [exact] : params.filter((p) => p.name.toLowerCase().startsWith(lower));
    if (matches.length === 0) {
      return { ok: false, error: `${cmdlet}: A parameter cannot be found that matches parameter name '${a.name}'.` };
    }
    if (matches.length > 1) {
      return {
        ok: false,
        error: `${cmdlet}: Parameter cannot be processed because the parameter name '${a.name}' is ambiguous. Possible matches include: ${matches.map((m) => `-${m.name}`).join(' ')}.`,
      };
    }
    const p = matches[0];
    if (p === undefined) continue;
    if (p.kind === 'switch') {
      switches.add(p.name);
      continue;
    }
    if (a.value !== undefined) {
      values[p.name] = a.value;
      continue;
    }
    const next = args[i + 1];
    if (next === undefined || next.kind !== 'value') {
      return {
        ok: false,
        error: `${cmdlet}: Missing an argument for parameter '${p.name}'. Specify a parameter of type '${p.type ?? 'System.String'}' and try again.`,
      };
    }
    values[p.name] = next.value;
    i++;
  }

  const byPosition = params.filter((p) => p.position !== undefined && values[p.name] === undefined).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  for (const p of byPosition) {
    if (positional.length === 0) break;
    if (p.remaining) {
      values[p.name] = positional.splice(0).flat();
      break;
    }
    const v = positional.shift();
    if (v !== undefined) values[p.name] = v;
  }
  if (positional.length > 0) {
    const extra = positional[0]?.map(objectToString).join(' ') ?? '';
    return { ok: false, error: `${cmdlet}: A positional parameter cannot be found that accepts argument '${extra}'.` };
  }
  return { ok: true, bound: { switches, values } };
};

export const str = (b: Bound, name: string): string | undefined => {
  const v = b.values[name];
  if (v === undefined || v.length === 0) return undefined;
  return v.map(objectToString).join(' ');
};

export const strs = (b: Bound, name: string): readonly string[] | undefined => b.values[name]?.map(objectToString);

export const has = (b: Bound, name: string): boolean => b.switches.has(name);
