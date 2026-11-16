import { describe, expect, it } from 'vitest';
import { dialects } from '../domain/dialects/registry';
import { goalMet } from '../domain/lessons/goal';
import { startChallenge, step } from '../domain/lessons/runner';
import type { OS } from '../domain/types';
import { units } from './units';

/**
 * The golden-solution test: every challenge must be solvable on every OS by each of its
 * listed solutions, and must not already be solved by its seed.
 */
const OSES: readonly OS[] = ['linux', 'mac', 'windows'];

for (const unit of units) {
  for (const lesson of unit.lessons) {
    describe(`${unit.id} / ${lesson.id}`, () => {
      for (const challenge of lesson.challenges) {
        for (const os of OSES) {
          const dialect = dialects[os];
          it.skipIf(dialect === undefined)(`${challenge.id} on ${os}`, () => {
            if (dialect === undefined) return;
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
                attempt = r.attempt;
                solved = r.outcome === 'solved';
              }
              expect(solved, `solution ${JSON.stringify(solution)} does not meet the goal`).toBe(true);
            }
          });
        }
      }
    });
  }
}
