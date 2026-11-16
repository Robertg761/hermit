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

/** A command, flag or symbol the learner can be taught, like `pwd`, `ls-a` or `cd-up`. */
export type SkillId = string;

export type ChallengeType =
  /** A short card that introduces a new skill. Never costs hearts. */
  | 'learn'
  /** The command is shown as ghost text; the learner types over it. Never costs hearts. */
  | 'typeAlong'
  /** Choose the right command or meaning. */
  | 'pick'
  /** Tap pairs of commands and meanings. Wrong taps only shake. */
  | 'match'
  /** Tap tokens to assemble a command, which then runs for real. */
  | 'build'
  /** A command with one gap, filled from tiles, which then runs for real. */
  | 'fill'
  | 'do'
  | 'predict'
  | 'fix'
  | 'translate';

export type LearnCard = {
  readonly title: string;
  /** One or two sentences. */
  readonly body: string;
  /** A command run on the seed so the card shows real output. */
  readonly example?: string;
};

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
  /** Skills a Learn card introduces. */
  readonly teaches?: readonly SkillId[];
  /** Skills needed to answer. The golden test checks each was taught by an earlier Learn card. */
  readonly uses: readonly SkillId[];
  /** Practice of an earlier lesson's skill. Shows a "Review" tag. */
  readonly review?: boolean;
  /** Learn only. */
  readonly card?: PerOs<LearnCard>;
  /** Pick only: why each option is right or wrong, shown after answering. */
  readonly optionReasons?: PerOs<readonly string[]>;
  /** Match only: [command, meaning] pairs. */
  readonly pairs?: PerOs<readonly (readonly [string, string])[]>;
  /** Build only: the token bank, including distractors. */
  readonly tokens?: PerOs<readonly string[]>;
  /** Fill only: the command with one `___` gap, filled from `options`. */
  readonly template?: PerOs<string>;
  /** Show the first hint from the start (the first Do for a new skill). */
  readonly openHint?: boolean;
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
