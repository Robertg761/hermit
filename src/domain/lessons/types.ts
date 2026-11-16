import type { SeedState } from '../machine';
import type { OS } from '../types';

export type PerOs<T> = Readonly<Record<OS, T>>;

/** Paths in goals are relative to the learner's home folder and use `/`. `''` means home itself. */
export type Goal =
  | { readonly kind: 'exists'; readonly path: string; readonly type?: 'file' | 'dir' }
  | { readonly kind: 'notExists'; readonly path: string }
  | { readonly kind: 'fileContains'; readonly path: string; readonly text: string }
  | { readonly kind: 'fileEquals'; readonly path: string; readonly text: string }
  | { readonly kind: 'cwdIs'; readonly path: string }
  | { readonly kind: 'stdoutIncludes'; readonly text: string }
  | { readonly kind: 'envIs'; readonly name: string; readonly value: string }
  | { readonly kind: 'processGone'; readonly name: string }
  | { readonly kind: 'installed'; readonly pkg: string }
  | { readonly kind: 'all'; readonly goals: readonly Goal[] };

export type ChallengeType = 'do' | 'predict' | 'fix' | 'translate';

export type Challenge = {
  readonly id: string;
  readonly type: ChallengeType;
  readonly prompt: PerOs<string>;
  readonly seed: PerOs<SeedState>;
  readonly goal: PerOs<Goal>;
  /** One or more command sequences that pass. */
  readonly solutions: PerOs<readonly (readonly string[])[]>;
  readonly protectedPaths?: readonly string[];
  readonly hints: PerOs<readonly string[]>;
  readonly explain: PerOs<string>;
  /** Predict only: the command(s) shown. The learner predicts the output of the last line. */
  readonly command?: PerOs<readonly string[]>;
  /** Predict only: answer options. The golden test checks `options[answer]` against the real output. */
  readonly options?: PerOs<readonly string[]>;
  readonly answer?: PerOs<number>;
  /** Fix only: the broken command pre-typed at the prompt. */
  readonly prefill?: PerOs<string>;
};

export type Lesson = {
  readonly id: string;
  readonly title: string;
  readonly challenges: readonly Challenge[];
};

export type Unit = {
  readonly id: string;
  readonly title: string;
  /** One line under the unit banner. */
  readonly blurb: string;
  readonly lessons: readonly Lesson[];
};

/** Helper for content that is identical on every OS. */
export const same = <T>(value: T): PerOs<T> => ({ linux: value, mac: value, windows: value });
