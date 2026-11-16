import type { Dialect } from '../dialects/dialect';
import type { OS } from '../types';
import { HEARTS_PER_LESSON, challengeXp, startChallenge, step, type ChallengeAttempt, type StepResult } from './runner';
import type { Lesson } from './types';

export type LessonRun = {
  readonly lesson: Lesson;
  readonly os: OS;
  readonly index: number;
  readonly hearts: number;
  readonly attempt: ChallengeAttempt;
  readonly xp: number;
  /** Challenges solved with no hint and no lost heart. */
  readonly clean: number;
  readonly restarts: number;
};

export type LessonEvent =
  | { readonly kind: 'ran'; readonly step: StepResult }
  | { readonly kind: 'solved'; readonly step: StepResult; readonly xp: number }
  | { readonly kind: 'outOfHearts'; readonly step: StepResult };

export const startLesson = (lesson: Lesson, os: OS, restarts = 0): LessonRun => {
  const first = lesson.challenges[0];
  if (first === undefined) throw new Error(`lesson ${lesson.id} has no challenges`);
  return { lesson, os, index: 0, hearts: HEARTS_PER_LESSON, attempt: startChallenge(first, os), xp: 0, clean: 0, restarts };
};

export const isLastChallenge = (run: LessonRun): boolean => run.index >= run.lesson.challenges.length - 1;

/** Submit a line. Returns the new run plus what happened, for the UI to react to. */
export const submitLine = (run: LessonRun, line: string, dialect: Dialect): { run: LessonRun; event: LessonEvent } => {
  if (run.attempt.solved) return { run, event: { kind: 'ran', step: { attempt: run.attempt, result: dialect.run('', run.attempt.machine), outcome: 'ok' } } };
  const s = step(run.attempt, line, dialect);
  const lostHeart = s.outcome === 'error' || s.outcome === 'protected';
  const hearts = lostHeart ? run.hearts - 1 : run.hearts;
  if (hearts <= 0) {
    return { run: { ...startLesson(run.lesson, run.os, run.restarts + 1) }, event: { kind: 'outOfHearts', step: s } };
  }
  if (s.outcome === 'solved') {
    const xp = challengeXp(s.attempt);
    return {
      run: { ...run, hearts, attempt: s.attempt, xp: run.xp + xp, clean: run.clean + (xp > 10 ? 1 : 0) },
      event: { kind: 'solved', step: s, xp },
    };
  }
  return { run: { ...run, hearts, attempt: s.attempt }, event: { kind: 'ran', step: s } };
};

/** Move to the next challenge after a solve. Returns null when the lesson is complete. */
export const nextChallenge = (run: LessonRun): LessonRun | null => {
  const next = run.lesson.challenges[run.index + 1];
  if (next === undefined) return null;
  return { ...run, index: run.index + 1, attempt: startChallenge(next, run.os) };
};

export const markHintUsed = (run: LessonRun): LessonRun => ({ ...run, attempt: { ...run.attempt, usedHint: true } });
