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
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');

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
          });
        }
      }
    });
  }
}
