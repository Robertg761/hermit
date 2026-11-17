import type { Dialect } from '../dialects/dialect';
import type { OS } from '../types';
import { HEARTS_PER_LESSON, challengeXp, isIntro, startChallenge, step, type ChallengeAttempt, type StepResult } from './runner';
import type { Challenge, Lesson } from './types';

export type LessonRun = {
  readonly lesson: Lesson;
  readonly os: OS;
  /** The lesson's challenges, plus missed ones re-queued at the end. */
  readonly queue: readonly Challenge[];
  /** Ids already re-queued once. */
  readonly retried: readonly string[];
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
  return {
    lesson,
    os,
    queue: lesson.challenges,
    retried: [],
    index: 0,
    hearts: HEARTS_PER_LESSON,
    attempt: startChallenge(first, os),
    xp: 0,
    clean: 0,
    restarts,
  };
};

/** A challenge you lost a heart on, or needed a hint for, comes back once at the end. */
const shouldRequeue = (run: LessonRun): boolean => {
  const a = run.attempt;
  if (isIntro(a.challenge.type) || a.challenge.type === 'match') return false;
  if (run.retried.includes(a.challenge.id)) return false;
  return a.lostHeart || a.usedHint;
};

export const isLastChallenge = (run: LessonRun): boolean => run.index >= run.queue.length - 1 && !shouldRequeue(run);

/** How far through the lesson the learner is, 0 to 1. */
export const lessonProgress = (run: LessonRun, finishedCurrent: boolean): number =>
  (run.index + (finishedCurrent ? 1 : 0)) / (run.queue.length + (finishedCurrent && shouldRequeue(run) ? 1 : 0));

const solvedRun = (run: LessonRun, attempt: ChallengeAttempt): { run: LessonRun; xp: number } => {
  const xp = challengeXp(attempt);
  const clean = attempt.challenge.type !== 'learn' && !attempt.lostHeart && !attempt.usedHint;
  return { run: { ...run, attempt, xp: run.xp + xp, clean: run.clean + (clean ? 1 : 0) }, xp };
};

/**
 * Out of hearts: refill them and retry the current challenge from scratch.
 * No timers and no restart from step 1. The cost is the lesson's Flawless result.
 */
export const refillAtCurrent = (run: LessonRun): LessonRun => ({
  ...run,
  hearts: HEARTS_PER_LESSON,
  restarts: run.restarts + 1,
  attempt: startChallenge(run.attempt.challenge, run.os),
});

const loseHeart = (run: LessonRun): LessonRun | null => {
  const hearts = run.hearts - 1;
  return hearts <= 0 ? null : { ...run, hearts };
};

/** Submit a line typed in the terminal (Do, Fix, Type along). */
export const submitLine = (run: LessonRun, line: string, dialect: Dialect): { run: LessonRun; event: LessonEvent } => {
  if (run.attempt.solved) return { run, event: { kind: 'ran', step: { attempt: run.attempt, result: dialect.run('', run.attempt.machine), outcome: 'ok' } } };
  const { challenge, os } = run.attempt;
  const freeRun = challenge.type === 'fix' && !run.attempt.freeRunUsed && line.trim() === (challenge.prefill?.[os] ?? '').trim();
  const s0 = step(run.attempt, line, dialect);
  const forgiving = isIntro(challenge.type) || freeRun;
  const s: StepResult = forgiving
    ? { ...s0, attempt: { ...s0.attempt, lostHeart: run.attempt.lostHeart, freeRunUsed: s0.attempt.freeRunUsed || freeRun } }
    : s0;
  const lostHeart = !forgiving && (s.outcome === 'error' || s.outcome === 'protected');
  const after = lostHeart ? loseHeart(run) : run;
  if (after === null) {
    return { run: refillAtCurrent(run), event: { kind: 'outOfHearts', step: s } };
  }
  if (s.outcome === 'solved') {
    const r = solvedRun(after, s.attempt);
    return { run: r.run, event: { kind: 'solved', step: s, xp: r.xp } };
  }
  return { run: { ...after, attempt: s.attempt }, event: { kind: 'ran', step: s } };
};

export type AnswerResult = {
  readonly run: LessonRun;
  readonly correct: boolean;
  readonly event: 'solved' | 'wrong' | 'outOfHearts';
  readonly xp: number;
};

/** Mark a Pick, Predict, Build or Fill answer. A wrong answer costs a heart and moves on. */
export const answer = (run: LessonRun, correct: boolean): AnswerResult => {
  if (correct) {
    const r = solvedRun(run, { ...run.attempt, solved: true });
    return { run: r.run, correct, event: 'solved', xp: r.xp };
  }
  const after = loseHeart(run);
  if (after === null) return { run: refillAtCurrent(run), correct, event: 'outOfHearts', xp: 0 };
  const attempt = { ...run.attempt, solved: true, lostHeart: true, failures: run.attempt.failures + 1 };
  return { run: { ...after, attempt }, correct, event: 'wrong', xp: 0 };
};

/** Answer a Predict or Pick challenge by option index. */
export const answerChoice = (run: LessonRun, choice: number): AnswerResult => answer(run, choice === run.attempt.challenge.answer?.[run.os]);

/** @deprecated use answerChoice */
export const answerPredict = answerChoice;

/** Run an assembled Build or Fill line for real, and mark it by the goal check. */
export const answerLine = (run: LessonRun, line: string, dialect: Dialect): AnswerResult & { readonly step: StepResult } => {
  const s = step({ ...run.attempt, failures: 0 }, line, dialect);
  const marked = answer({ ...run, attempt: { ...run.attempt, machine: s.attempt.machine } }, s.outcome === 'solved');
  return { ...marked, step: s };
};

/** Finish a Learn card or a Match. `mistakes` only affects the clean bonus. */
export const completeCard = (run: LessonRun, mistakes = 0): { run: LessonRun; xp: number } =>
  solvedRun(run, { ...run.attempt, solved: true, lostHeart: run.attempt.lostHeart || mistakes > 0 });

/** Move to the next challenge. Returns null when the lesson is complete. */
export const nextChallenge = (run: LessonRun): LessonRun | null => {
  const requeue = shouldRequeue(run);
  const queue = requeue ? [...run.queue, run.attempt.challenge] : run.queue;
  const retried = requeue ? [...run.retried, run.attempt.challenge.id] : run.retried;
  const next = queue[run.index + 1];
  if (next === undefined) return null;
  return { ...run, queue, retried, index: run.index + 1, attempt: startChallenge(next, run.os) };
};

export const markHintUsed = (run: LessonRun): LessonRun => ({ ...run, attempt: { ...run.attempt, usedHint: true } });
