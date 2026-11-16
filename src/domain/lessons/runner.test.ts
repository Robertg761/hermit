import { describe, expect, it } from 'vitest';
import { bash } from '../dialects/bash';
import { buildMachine } from '../machine';
import { goalMet } from './goal';
import { submitLine, startLesson, nextChallenge } from './lesson-run';
import { availableHints, challengeXp, startChallenge, step } from './runner';
import { same, type Challenge, type Lesson } from './types';

const challenge: Challenge = {
  id: 't1',
  type: 'do',
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

describe('lesson run', () => {
  it('restarts the lesson at 0 hearts', () => {
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
});
