export type ParsedArgs = {
  readonly flags: ReadonlySet<string>;
  /** Flags that take a value, e.g. `-n 5` → `{ n: '5' }`. */
  readonly values: Readonly<Record<string, string>>;
  readonly operands: readonly string[];
};

export type FlagSpec = {
  /** Single-letter boolean flags, e.g. 'alrR'. */
  readonly short?: string;
  /** Single-letter flags that take a value, e.g. 'n'. */
  readonly shortValue?: string;
  /** Long flags mapped to a canonical short letter (or kept as the long name). */
  readonly long?: Readonly<Record<string, string>>;
};

export type FlagResult = { readonly ok: true; readonly args: ParsedArgs } | { readonly ok: false; readonly error: string };

/** GNU-style option parsing: clustered short flags, `--long`, `--` ends options. */
export const parseFlags = (cmd: string, argv: readonly string[], spec: FlagSpec, flavor: 'gnu' | 'bsd' = 'gnu'): FlagResult => {
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  const operands: string[] = [];
  const short = spec.short ?? '';
  const shortValue = spec.shortValue ?? '';
  let endOfOptions = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (endOfOptions || a === '-' || !a.startsWith('-')) {
      operands.push(a);
      continue;
    }
    if (a === '--') {
      endOfOptions = true;
      continue;
    }
    if (a.startsWith('--')) {
      const name = a.slice(2).split('=')[0] ?? '';
      const mapped = spec.long?.[name];
      if (mapped === undefined) {
        return {
          ok: false,
          error: flavor === 'gnu' ? `${cmd}: unrecognized option '${a}'\nTry '${cmd} --help' for more information.` : `${cmd}: unrecognized option \`${a}'`,
        };
      }
      flags.add(mapped);
      continue;
    }
    for (let j = 1; j < a.length; j++) {
      const f = a[j] ?? '';
      if (shortValue.includes(f)) {
        const rest = a.slice(j + 1);
        const value = rest.length > 0 ? rest : argv[++i];
        if (value === undefined) {
          return { ok: false, error: `${cmd}: option requires an argument -- '${f}'\nTry '${cmd} --help' for more information.` };
        }
        values[f] = value;
        break;
      }
      if (/\d/.test(f) && shortValue.includes('n')) {
        // `head -5` shorthand
        values['n'] = a.slice(j);
        break;
      }
      if (!short.includes(f)) {
        return {
          ok: false,
          error:
            flavor === 'gnu'
              ? `${cmd}: invalid option -- '${f}'\nTry '${cmd} --help' for more information.`
              : `${cmd}: invalid option -- ${f}\nusage: ${cmd} [-${spec.short ?? ''}] [file ...]`,
        };
      }
      flags.add(f);
    }
  }
  return { ok: true, args: { flags, values, operands } };
};
