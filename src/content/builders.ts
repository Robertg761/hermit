import type { SeedState } from '../domain/machine';
import { same, type Challenge, type PerOs } from '../domain/lessons/types';

type PredictSpec = {
  readonly id: string;
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
export const predict = (spec: PredictSpec): Challenge => {
  const pick = <T>(f: (os: 'linux' | 'mac' | 'windows') => T): PerOs<T> => ({ linux: f('linux'), mac: f('mac'), windows: f('windows') });
  return {
    ...spec,
    type: 'predict',
    goal: pick((os) => ({ kind: 'stdoutIncludes', text: spec.options[os][spec.answer[os]] ?? '' })),
    solutions: pick((os) => [spec.command[os]]),
  };
};

export { same };
