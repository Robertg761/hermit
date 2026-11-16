import type { SeedState } from '../domain/machine';
import { same, type Challenge, type Goal, type LearnCard, type PerOs, type SkillId } from '../domain/lessons/types';
import type { OS } from '../domain/types';

export { same };

const OSES: readonly OS[] = ['linux', 'mac', 'windows'];
const perOs = <T>(f: (os: OS) => T): PerOs<T> => ({ linux: f('linux'), mac: f('mac'), windows: f('windows') });

/** Same value on Linux and macOS, another on Windows. */
export const px = <T>(posix: T, windows: T): PerOs<T> => ({ linux: posix, mac: posix, windows });

/** Linux and macOS differ only in the home folder: `/home/you` vs `/Users/you`. */
export const byHome = (f: (home: string) => string, windows: string): PerOs<string> => ({
  linux: f('/home/you'),
  mac: f('/Users/you'),
  windows,
});

const NO_GOAL: Goal = { kind: 'all', goals: [] };
const EMPTY_SEED: PerOs<SeedState> = same({});

type Base = {
  readonly id: string;
  readonly uses?: readonly SkillId[];
  readonly review?: boolean;
};

/** A Learn card: one new skill, a sentence or two, and a live example. */
export const learn = (spec: {
  readonly id: string;
  readonly teaches: readonly SkillId[];
  readonly uses?: readonly SkillId[];
  readonly seed?: PerOs<SeedState>;
  readonly card: PerOs<LearnCard>;
}): Challenge => ({
  id: spec.id,
  type: 'learn',
  teaches: spec.teaches,
  uses: spec.uses ?? [],
  card: spec.card,
  prompt: perOs((os) => spec.card[os].title),
  seed: spec.seed ?? EMPTY_SEED,
  goal: same(NO_GOAL),
  solutions: same([]),
  hints: same([]),
  explain: perOs((os) => spec.card[os].body),
});

type Runnable = Base & {
  readonly prompt: PerOs<string>;
  readonly seed: PerOs<SeedState>;
  readonly goal: PerOs<Goal>;
  readonly explain: PerOs<string>;
  readonly protectedPaths?: readonly string[];
};

/** Type along: the first solution is shown as ghost text. No hearts at stake. */
export const typeAlong = (spec: Runnable & { readonly line: PerOs<string>; readonly also?: PerOs<readonly (readonly string[])[]> }): Challenge => ({
  ...spec,
  uses: spec.uses ?? [],
  type: 'typeAlong',
  solutions: perOs((os) => [[spec.line[os]], ...(spec.also?.[os] ?? [])]),
  hints: perOs((os) => [`Type \`${spec.line[os]}\` exactly, then press Enter.`]),
});

/** A free-typing task (Do) or a broken command to repair (Fix). */
export const task = (
  spec: Runnable & {
    readonly solutions: PerOs<readonly (readonly string[])[]>;
    readonly hints: PerOs<readonly string[]>;
    readonly prefill?: PerOs<string>;
    readonly protectedPaths?: readonly string[];
    readonly openHint?: boolean;
  },
): Challenge => ({ ...spec, uses: spec.uses ?? [], type: spec.prefill === undefined ? 'do' : 'fix' });

/** Pick: a question with 3 or 4 options. Wrong options should be real misconceptions. */
export const pick = (
  spec: Base & {
    readonly prompt: PerOs<string>;
    readonly options: PerOs<readonly string[]>;
    readonly answer: PerOs<number>;
    readonly reasons?: PerOs<readonly string[]>;
    readonly explain: PerOs<string>;
  },
): Challenge => ({
  id: spec.id,
  type: 'pick',
  uses: spec.uses ?? [],
  ...(spec.review === true ? { review: true } : {}),
  prompt: spec.prompt,
  options: spec.options,
  answer: spec.answer,
  ...(spec.reasons ? { optionReasons: spec.reasons } : {}),
  seed: EMPTY_SEED,
  goal: same(NO_GOAL),
  solutions: same([]),
  hints: same([]),
  explain: spec.explain,
});

/** Match: tap commands to their meanings. */
export const match = (
  spec: Base & { readonly prompt?: PerOs<string>; readonly pairs: PerOs<readonly (readonly [string, string])[]>; readonly explain: PerOs<string> },
): Challenge => ({
  id: spec.id,
  type: 'match',
  uses: spec.uses ?? [],
  ...(spec.review === true ? { review: true } : {}),
  prompt: spec.prompt ?? same('Match each command to what it does.'),
  pairs: spec.pairs,
  seed: EMPTY_SEED,
  goal: same(NO_GOAL),
  solutions: same([]),
  hints: same([]),
  explain: spec.explain,
});

/** Build: tap tokens to assemble a command, which then runs for real. */
export const build = (
  spec: Runnable & {
    readonly tokens: PerOs<readonly string[]>;
    readonly solutions: PerOs<readonly (readonly string[])[]>;
    readonly hints: PerOs<readonly string[]>;
  },
): Challenge => ({ ...spec, uses: spec.uses ?? [], type: 'build' });

/** Fill: a command with one `___` gap and tiles for it. The line runs for real. */
export const fill = (
  spec: Runnable & {
    readonly template: PerOs<string>;
    readonly options: PerOs<readonly string[]>;
    readonly answer: PerOs<number>;
    readonly hints: PerOs<readonly string[]>;
  },
): Challenge => ({
  ...spec,
  uses: spec.uses ?? [],
  type: 'fill',
  solutions: perOs((os) => [[spec.template[os].replace('___', spec.options[os][spec.answer[os]] ?? '')]]),
});

type PredictSpec = Base & {
  readonly prompt: PerOs<string>;
  readonly seed: PerOs<SeedState>;
  readonly command: PerOs<readonly string[]>;
  readonly options: PerOs<readonly string[]>;
  readonly answer: PerOs<number>;
  readonly hints: PerOs<readonly string[]>;
  readonly explain: PerOs<string>;
};

/**
 * A Predict challenge: "what does this print?". Its goal and solution are derived from the
 * command, so the golden-solution test proves the marked answer is the real output.
 */
export const predict = (spec: PredictSpec): Challenge => ({
  ...spec,
  uses: spec.uses ?? [],
  type: 'predict',
  goal: perOs((os) => ({ kind: 'stdoutIncludes', text: spec.options[os][spec.answer[os]] ?? '' })),
  solutions: perOs((os) => [spec.command[os]]),
});

export { OSES };
