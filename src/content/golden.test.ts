import { describe, expect, it } from 'vitest';
import { dialects } from '../domain/dialects/registry';
import { goalMet } from '../domain/lessons/goal';
import { startChallenge, step } from '../domain/lessons/runner';
import type { Challenge, SkillId } from '../domain/lessons/types';
import type { OS } from '../domain/types';
import { units } from './units';

/**
 * The golden-solution test: every challenge must be solvable on every OS by each of its
 * listed solutions, and must not already be solved by its seed. Plus the teaching rules
 * from docs/PEDAGOGY.md: nothing is used before a Learn card teaches it.
 */
const OSES: readonly OS[] = ['linux', 'mac', 'windows'];
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');
const RUNNABLE = new Set(['do', 'fix', 'typeAlong', 'build', 'fill', 'predict', 'translate']);

/** Can `line` be assembled from the bank, each token used at most once, joined by spaces? */
const buildable = (line: string, bank: readonly string[]): boolean => {
  const go = (rest: string, left: readonly string[]): boolean => {
    if (rest === '') return true;
    return left.some((t, i) => {
      if (!rest.startsWith(t)) return false;
      const after = rest.slice(t.length);
      if (after !== '' && !after.startsWith(' ')) return false;
      return go(after.trimStart(), [...left.slice(0, i), ...left.slice(i + 1)]);
    });
  };
  return go(line.trim(), bank);
};

const checkRunnable = (challenge: Challenge, os: OS): void => {
  const dialect = dialects[os];
  if (dialect === undefined) throw new Error(`no dialect for ${os}`);
  const start = startChallenge(challenge, os);
  expect(goalMet(challenge.goal[os], os, start.machine, null), 'seed already meets goal').toBe(false);
  const solutions = challenge.solutions[os];
  expect(solutions.length, 'needs at least one solution').toBeGreaterThan(0);
  expect(challenge.hints[os].length, 'needs at least one hint').toBeGreaterThan(0);
  expect(challenge.explain[os].length).toBeGreaterThan(0);
  for (const solution of solutions) {
    let attempt = start;
    let solved = false;
    for (const line of solution) {
      const r = step(attempt, line, dialect);
      expect(r.outcome, `"${line}" failed: ${r.result.stderr}`).not.toBe('error');
      expect(r.outcome, `"${line}" touched a protected file`).not.toBe('protected');
      attempt = r.attempt;
      solved = r.outcome === 'solved';
    }
    expect(solved, `solution ${JSON.stringify(solution)} does not meet the goal`).toBe(true);
  }
  if (challenge.type === 'predict') {
    // The marked answer must be a real line of output, and no distractor may be.
    let state = start.machine;
    let stdout = '';
    for (const line of challenge.command?.[os] ?? []) {
      const r = dialect.run(line, state);
      state = r.state;
      stdout = r.stdout;
    }
    const lines = stdout.replace(ANSI, '').split('\n').map((l) => l.trim());
    const options = challenge.options?.[os] ?? [];
    const answer = challenge.answer?.[os] ?? -1;
    options.forEach((opt, i) => {
      expect(lines.includes(opt), `option "${opt}" vs output ${JSON.stringify(lines)}`).toBe(i === answer);
    });
  }
  if (challenge.type === 'fix') {
    const prefill = challenge.prefill?.[os];
    expect(prefill, 'fix challenges need a prefill').toBeDefined();
    const r = step(start, prefill ?? '', dialect);
    expect(r.outcome, `prefill "${prefill}" should not already solve it`).not.toBe('solved');
  }
  if (challenge.type === 'build') {
    const first = solutions[0];
    expect(first?.length, 'build solutions are one line').toBe(1);
    expect(buildable(first?.[0] ?? '', challenge.tokens?.[os] ?? []), `"${first?.[0] ?? ''}" can't be built from the tiles`).toBe(true);
  }
  if (challenge.type === 'fill') {
    const template = challenge.template?.[os] ?? '';
    expect(template.split('___').length, 'fill needs exactly one gap').toBe(2);
    (challenge.options?.[os] ?? []).forEach((opt, i) => {
      if (i === challenge.answer?.[os]) return;
      const r = step(start, template.replace('___', opt), dialect);
      expect(r.outcome, `wrong tile "${opt}" also solves it`).not.toBe('solved');
    });
  }
};

const checkCard = (challenge: Challenge, os: OS): void => {
  const dialect = dialects[os];
  if (dialect === undefined) throw new Error(`no dialect for ${os}`);
  if (challenge.type === 'learn') {
    const card = challenge.card?.[os];
    expect(card, 'learn needs a card').toBeDefined();
    expect(challenge.teaches?.length ?? 0, 'learn must teach something').toBeGreaterThan(0);
    expect(card?.body.length ?? 0).toBeGreaterThan(0);
    // Every example runs cleanly, except the card about errors (whose example is the error).
    if (card?.example !== undefined && !(challenge.teaches ?? []).includes('errors')) {
      const r = dialect.run(card.example, startChallenge(challenge, os).machine);
      expect(r.exitCode, `example "${card.example}" failed: ${r.stderr}`).toBe(0);
    }
  }
  if (challenge.type === 'pick') {
    const options = challenge.options?.[os] ?? [];
    const answer = challenge.answer?.[os] ?? -1;
    expect(options.length).toBeGreaterThanOrEqual(3);
    expect(new Set(options).size, 'options are distinct').toBe(options.length);
    expect(answer >= 0 && answer < options.length, 'answer in range').toBe(true);
    const reasons = challenge.optionReasons?.[os];
    if (reasons !== undefined) expect(reasons.length).toBe(options.length);
  }
  if (challenge.type === 'match') {
    const pairs = challenge.pairs?.[os] ?? [];
    expect(pairs.length).toBeGreaterThanOrEqual(3);
    expect(new Set(pairs.map((p) => p[0])).size).toBe(pairs.length);
    expect(new Set(pairs.map((p) => p[1])).size).toBe(pairs.length);
  }
};

describe('golden solutions', () => {
  for (const unit of units) {
    for (const lesson of unit.lessons) {
      describe(`${unit.id} / ${lesson.id}`, () => {
        for (const challenge of lesson.challenges) {
          for (const os of OSES) {
            it(`${challenge.id} (${challenge.type}) on ${os}`, () => {
              if (RUNNABLE.has(challenge.type)) checkRunnable(challenge, os);
              else checkCard(challenge, os);
            });
          }
        }
      });
    }
  }
});

describe('teaching rules', () => {
  it('never tests a skill before a Learn card has taught it', () => {
    const taught = new Set<SkillId>();
    const problems: string[] = [];
    for (const unit of units) {
      for (const lesson of unit.lessons) {
        for (const c of lesson.challenges) {
          for (const skill of c.uses) if (!taught.has(skill)) problems.push(`${c.id} uses "${skill}" before it is taught`);
          for (const skill of c.teaches ?? []) taught.add(skill);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('every non-Learn challenge says which skills it uses', () => {
    const missing = units.flatMap((u) => u.lessons.flatMap((l) => l.challenges.filter((c) => c.type !== 'learn' && c.uses.length === 0).map((c) => c.id)));
    expect(missing).toEqual([]);
  });

  it('introduces at most 2 new skills per lesson', () => {
    for (const unit of units) {
      for (const lesson of unit.lessons) {
        const taught = lesson.challenges.flatMap((c) => c.teaches ?? []).filter((s) => s !== 'prompt' && s !== 'errors');
        expect(taught.length, `${lesson.id} teaches ${taught.join(', ')}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('every lesson after the first has at least 2 review challenges', () => {
    const lessons = units.flatMap((u) => u.lessons).slice(1);
    for (const lesson of lessons) {
      expect(lesson.challenges.filter((c) => c.review === true).length, lesson.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('challenge ids are unique', () => {
    const ids = units.flatMap((u) => u.lessons.flatMap((l) => l.challenges.map((c) => c.id)));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
