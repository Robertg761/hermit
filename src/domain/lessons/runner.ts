import type { Dialect } from '../dialects/dialect';
import { buildMachine, seedPath } from '../machine';
import type { CommandResult, MachineState, OS } from '../types';
import { caseInsensitive, caseSensitive, getNode } from '../vfs/vfs';
import { goalMet } from './goal';
import type { Challenge, ChallengeType } from './types';

export const HEARTS_PER_LESSON = 3;

export type ChallengeAttempt = {
  readonly challenge: Challenge;
  readonly os: OS;
  readonly machine: MachineState;
  /** Failed commands on this challenge. Drives the hint button. */
  readonly failures: number;
  readonly lostHeart: boolean;
  readonly usedHint: boolean;
  readonly solved: boolean;
  /** Fix only: the untouched prefill has been run once (free, so the learner can read the error). */
  readonly freeRunUsed: boolean;
};

export type StepOutcome =
  /** The command ran and the goal is now met. */
  | 'solved'
  /** The command ran without error; keep going. */
  | 'ok'
  /** The command failed: costs a heart. */
  | 'error'
  /** A protected file was deleted or overwritten: costs a heart and resets the challenge. */
  | 'protected';

export type StepResult = {
  readonly attempt: ChallengeAttempt;
  readonly result: CommandResult;
  readonly outcome: StepOutcome;
};

export const startChallenge = (challenge: Challenge, os: OS): ChallengeAttempt => ({
  challenge,
  os,
  machine: buildMachine(os, challenge.seed[os]),
  failures: 0,
  lostHeart: false,
  usedHint: false,
  solved: false,
  freeRunUsed: false,
});

const fileSnapshot = (state: MachineState, os: OS, rel: string): string | null => {
  const r = getNode(state.root, seedPath(os, rel), os === 'windows' ? caseInsensitive : caseSensitive);
  if (!r.ok) return null;
  return r.value.kind === 'file' ? r.value.content : JSON.stringify(r.value);
};

/** Run one line in a challenge: dialect → hearts rules → goal check. */
export const step = (attempt: ChallengeAttempt, line: string, dialect: Dialect): StepResult => {
  const { challenge, os } = attempt;
  const result = dialect.run(line, attempt.machine);

  const touchedProtected = (challenge.protectedPaths ?? []).some(
    (p) => fileSnapshot(attempt.machine, os, p) !== fileSnapshot(result.state, os, p),
  );
  if (touchedProtected) {
    return {
      attempt: { ...attempt, machine: buildMachine(os, challenge.seed[os]), failures: attempt.failures + 1, lostHeart: true },
      result,
      outcome: 'protected',
    };
  }

  const failed = result.exitCode !== 0 && result.stderr.length > 0 && result.free !== true;
  const next: ChallengeAttempt = {
    ...attempt,
    machine: result.state,
    failures: failed ? attempt.failures + 1 : attempt.failures,
    lostHeart: attempt.lostHeart || failed,
  };
  if (goalMet(challenge.goal[os], os, result.state, result)) {
    return { attempt: { ...next, solved: true }, result, outcome: 'solved' };
  }
  return { attempt: next, result, outcome: failed ? 'error' : 'ok' };
};

export const useHint = (attempt: ChallengeAttempt): ChallengeAttempt => ({ ...attempt, usedHint: true });

/** Hints unlock after 2 failures; the last hint (which may give the answer) after 3. */
export const availableHints = (attempt: ChallengeAttempt): readonly string[] => {
  const hints = attempt.challenge.hints[attempt.os];
  const failures = attempt.failures + (attempt.challenge.openHint === true ? 2 : 0);
  if (failures < 2) return [];
  if (failures < 3) return hints.slice(0, Math.max(1, hints.length - 1));
  return hints;
};

export const XP_PER_CHALLENGE = 10;
export const XP_CLEAN_BONUS = 5;

/** Types that are about meeting something new, not testing it. */
export const isIntro = (type: ChallengeType): boolean => type === 'learn' || type === 'typeAlong';

export const challengeXp = (attempt: ChallengeAttempt): number =>
  attempt.challenge.type === 'learn'
    ? 0
    : XP_PER_CHALLENGE + (attempt.usedHint || attempt.lostHeart ? 0 : XP_CLEAN_BONUS);
