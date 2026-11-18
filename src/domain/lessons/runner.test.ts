import { describe, expect, it } from 'vitest';
import { bash } from '../dialects/bash';
import { buildMachine } from '../machine';
import { goalMet } from './goal';
import { answerChoice, answerLine, completeCard, isLastChallenge, nextChallenge, restartStep, startLesson, submitLine } from './lesson-run';
import { availableHints, challengeXp, startChallenge, step, stuckLevel } from './runner';
import { dialects } from '../dialects/registry';
import { same, type Challenge, type Lesson } from './types';

const challenge: Challenge = {
  id: 't1',
  type: 'do',
  uses: [],
  prompt: same('Delete junk.txt but keep keep.txt.'),
  seed: same({ files: { 'junk.txt': 'x', 'keep.txt': 'precious' } }),
  goal: same({ kind: 'notExists', path: 'junk.txt' }),
  solutions: same([['rm junk.txt']]),
  protectedPaths: ['keep.txt'],
  hints: same(['First hint.', 'Type `rm junk.txt`.']),
  explain: same('rm removes files.'),
};
const lesson: Lesson = { id: 'l', title: 'Test', challenges: [challenge, { ...challenge, id: 't2' }] };

describe('goal evaluation', () => {
  const m = buildMachine('linux', { files: { 'a/b.txt': 'hello world' } });
  it('checks existence and type', () => {
    expect(goalMet({ kind: 'exists', path: 'a', type: 'dir' }, 'linux', m, null)).toBe(true);
    expect(goalMet({ kind: 'exists', path: 'a', type: 'file' }, 'linux', m, null)).toBe(false);
    expect(goalMet({ kind: 'notExists', path: 'zzz' }, 'linux', m, null)).toBe(true);
  });
  it('checks file content', () => {
    expect(goalMet({ kind: 'fileContains', path: 'a/b.txt', text: 'world' }, 'linux', m, null)).toBe(true);
    expect(goalMet({ kind: 'fileEquals', path: 'a/b.txt', text: 'hello world\n' }, 'linux', m, null)).toBe(true);
  });
  it('checks cwd and combinations', () => {
    expect(goalMet({ kind: 'cwdIs', path: '' }, 'linux', m, null)).toBe(true);
    expect(goalMet({ kind: 'all', goals: [{ kind: 'cwdIs', path: '' }, { kind: 'exists', path: 'nope' }] }, 'linux', m, null)).toBe(false);
  });
  it('is case-insensitive on Windows', () => {
    const w = buildMachine('windows', { files: { 'Notes.txt': '' } });
    expect(goalMet({ kind: 'exists', path: 'notes.TXT' }, 'windows', w, null)).toBe(true);
  });
});

describe('challenge runner', () => {
  it('solves with a valid command and awards the clean bonus', () => {
    const r = step(startChallenge(challenge, 'linux'), 'rm junk.txt', bash);
    expect(r.outcome).toBe('solved');
    expect(challengeXp(r.attempt)).toBe(15);
  });
  it('accepts any command that reaches the goal state', () => {
    const r = step(startChallenge(challenge, 'linux'), 'mv junk.txt /tmp/', bash);
    expect(r.outcome).toBe('solved');
  });
  it('counts errors and drops the bonus', () => {
    const a = step(startChallenge(challenge, 'linux'), 'rm nope.txt', bash);
    expect(a.outcome).toBe('error');
    const b = step(a.attempt, 'rm junk.txt', bash);
    expect(b.outcome).toBe('solved');
    expect(challengeXp(b.attempt)).toBe(10);
  });
  it('read-only commands never count as errors', () => {
    const a = step(startChallenge(challenge, 'linux'), 'ls', bash);
    expect(a.outcome).toBe('ok');
    expect(a.attempt.failures).toBe(0);
  });
  it('touching a protected path costs a heart and resets the seed', () => {
    const a = step(startChallenge(challenge, 'linux'), 'rm keep.txt junk.txt', bash);
    expect(a.outcome).toBe('protected');
    const again = step(a.attempt, 'cat keep.txt', bash);
    expect(again.result.stdout).toBe('precious');
  });
  it('unlocks hints after 2 failures and the answer after 3', () => {
    let a = startChallenge(challenge, 'linux');
    expect(availableHints(a)).toEqual([]);
    a = step(a, 'nope', bash).attempt;
    a = step(a, 'nope', bash).attempt;
    expect(availableHints(a)).toEqual(['First hint.']);
    a = step(a, 'nope', bash).attempt;
    expect(availableHints(a)).toEqual(['First hint.', 'Type `rm junk.txt`.']);
  });
});

describe('a learner who is stuck without errors', () => {
  const run = (lines: readonly string[], c: Challenge = challenge) => lines.reduce((a, line) => step(a, line, bash).attempt, startChallenge(c, 'linux'));
  it('valid commands that miss the goal unlock the first hint after 3, and the answer after 6', () => {
    expect(availableHints(run(['ls', 'pwd']))).toEqual([]);
    const stuck = run(['ls', 'pwd', 'ls']);
    expect(stuckLevel(stuck)).toBe(1);
    expect(availableHints(stuck)).toEqual(['First hint.']);
    expect(stuck.lostHeart).toBe(false);
    expect(stuck.failures).toBe(0);
    const veryStuck = run(['ls', 'pwd', 'ls', 'cat keep.txt', 'ls', 'pwd']);
    expect(stuckLevel(veryStuck)).toBe(2);
    expect(availableHints(veryStuck)).toHaveLength(2);
  });
  it('empty lines and free commands are not counted', () => {
    const linux = dialects.linux;
    if (linux === undefined) throw new Error('linux');
    const a = ['', '   ', 'man ls', 'export A=1', 'ls'].reduce((at, line) => step(at, line, linux).attempt, startChallenge(challenge, 'linux'));
    expect(a.strays).toBe(1);
  });
  it('steps a long solution needs are not held against the learner', () => {
    const long: Challenge = { ...challenge, solutions: same([['ls', 'pwd', 'ls', 'rm junk.txt']]) };
    expect(stuckLevel(run(['ls', 'pwd', 'ls', 'ls', 'ls'], long))).toBe(0);
    expect(stuckLevel(run(['ls', 'pwd', 'ls', 'ls', 'ls', 'ls'], long))).toBe(1);
  });
  it('solving still earns the clean bonus when no hint was taken', () => {
    const r = step(run(['ls', 'pwd', 'ls']), 'rm junk.txt', bash);
    expect(r.outcome).toBe('solved');
    expect(challengeXp(r.attempt)).toBe(15);
  });
});

describe('lesson run', () => {
  it('start over puts the files back and keeps hearts and mistakes', () => {
    const free: Lesson = { id: 'f', title: 'Free', challenges: [{ ...challenge, protectedPaths: [], goal: same({ kind: 'fileContains', path: 'junk.txt', text: 'done' }) }] };
    let run = startLesson(free, 'linux');
    run = submitLine(run, 'rm nope.txt', bash).run;
    run = submitLine(run, 'rm junk.txt', bash).run;
    expect(goalMet({ kind: 'exists', path: 'junk.txt' }, 'linux', run.attempt.machine, null)).toBe(false);
    const again = restartStep(run);
    expect(goalMet({ kind: 'exists', path: 'junk.txt' }, 'linux', again.attempt.machine, null)).toBe(true);
    expect(again.hearts).toBe(2);
    expect(again.attempt.failures).toBe(1);
    expect(again.attempt.lostHeart).toBe(true);
    expect(again.restarts).toBe(run.restarts + 1);
    expect(again.index).toBe(run.index);
  });
  it('at 0 hearts, refills them and retries the same challenge', () => {
    const solved = submitLine(startLesson(lesson, 'linux'), 'rm junk.txt', bash).run;
    const second = nextChallenge(solved);
    if (second === null) throw new Error('expected a second challenge');
    let run = second;
    for (const bad of ['bad1', 'bad2']) run = submitLine(run, bad, bash).run;
    const r = submitLine(run, 'bad3', bash);
    expect(r.event.kind).toBe('outOfHearts');
    expect(r.run.hearts).toBe(3);
    expect(r.run.index).toBe(1);
    expect(r.run.restarts).toBe(1);
    expect(r.run.attempt.failures).toBe(0);
  });
  it('out of hearts on the first challenge stays on it', () => {
    let run = startLesson(lesson, 'linux');
    run = submitLine(run, 'bad1', bash).run;
    run = submitLine(run, 'bad2', bash).run;
    expect(run.hearts).toBe(1);
    const r = submitLine(run, 'bad3', bash);
    expect(r.event.kind).toBe('outOfHearts');
    expect(r.run.hearts).toBe(3);
    expect(r.run.index).toBe(0);
  });
  it('advances and finishes', () => {
    let run = startLesson(lesson, 'linux');
    const r1 = submitLine(run, 'rm junk.txt', bash);
    expect(r1.event.kind).toBe('solved');
    const n = nextChallenge(r1.run);
    expect(n?.index).toBe(1);
    if (n === null) return;
    run = submitLine(n, 'rm junk.txt', bash).run;
    expect(run.xp).toBe(30);
    expect(nextChallenge(run)).toBeNull();
  });

  it('re-queues a missed challenge once at the end', () => {
    let run = startLesson(lesson, 'linux');
    run = submitLine(run, 'bad', bash).run;
    run = submitLine(run, 'rm junk.txt', bash).run;
    expect(isLastChallenge(run)).toBe(false);
    const n1 = nextChallenge(run);
    expect(n1?.queue.length).toBe(3);
    if (n1 === null) return;
    const n2 = nextChallenge(submitLine(n1, 'rm junk.txt', bash).run);
    expect(n2?.attempt.challenge.id).toBe('t1');
    if (n2 === null) return;
    const done = submitLine(n2, 'bad', bash).run;
    // Missed again on the retry: it does not come back a second time.
    expect(isLastChallenge(done)).toBe(true);
  });
});

describe('new challenge types', () => {
  const typeAlong: Challenge = { ...challenge, id: 'ta', type: 'typeAlong' };
  const fix: Challenge = { ...challenge, id: 'fx', type: 'fix', prefill: same('rm junk') };
  const pickC: Challenge = { ...challenge, id: 'pk', type: 'pick', options: same(['a', 'b', 'c']), answer: same(2) };
  const buildC: Challenge = { ...challenge, id: 'bd', type: 'build', tokens: same(['rm', 'junk.txt']) };
  const learnC: Challenge = { ...challenge, id: 'ln', type: 'learn', teaches: ['rm'] };
  const one = (c: Challenge): Lesson => ({ id: 'l', title: 'T', challenges: [c] });

  it('type along never costs hearts', () => {
    const run = submitLine(startLesson(one(typeAlong), 'linux'), 'nonsense', bash).run;
    expect(run.hearts).toBe(3);
    expect(run.attempt.lostHeart).toBe(false);
  });

  it('running the untouched Fix prefill once is free', () => {
    let run = submitLine(startLesson(one(fix), 'linux'), 'rm junk', bash).run;
    expect(run.hearts).toBe(3);
    run = submitLine(run, 'rm junk', bash).run;
    expect(run.hearts).toBe(2); // only the first run is free
  });

  it('pick: right answers earn XP, wrong ones cost a heart and move on', () => {
    const right = answerChoice(startLesson(one(pickC), 'linux'), 2);
    expect(right.event).toBe('solved');
    expect(right.xp).toBe(15);
    const wrong = answerChoice(startLesson(one(pickC), 'linux'), 0);
    expect(wrong.event).toBe('wrong');
    expect(wrong.run.hearts).toBe(2);
    expect(isLastChallenge(wrong.run)).toBe(false);
  });

  it('build runs the assembled line for real', () => {
    expect(answerLine(startLesson(one(buildC), 'linux'), 'rm junk.txt', bash).event).toBe('solved');
    const wrong = answerLine(startLesson(one(buildC), 'linux'), 'junk.txt rm', bash);
    expect(wrong.event).toBe('wrong');
    expect(wrong.step.result.stderr).toContain('command not found');
  });

  it('learn cards give no XP and are never re-queued', () => {
    const r = completeCard(startLesson(one(learnC), 'linux'));
    expect(r.xp).toBe(0);
    expect(nextChallenge(r.run)).toBeNull();
  });
});
