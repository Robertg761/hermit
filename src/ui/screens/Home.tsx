import { useEffect, useRef, useState } from 'react';
import type { Lesson, Unit } from '../../domain/lessons/types';
import type { OS } from '../../domain/types';
import { SHELLS, Herme, type ShellKind, type HermeMood } from '../mascot/Herme';
import { SECRET_HINTS } from '../mascot/lines';
import { SECRET_IDS } from '../../domain/dialects/eggs';
import { StatsBar } from '../components/StatsBar';

type Upcoming = { readonly id: string; readonly title: string; readonly blurb: string };

type Props = {
  readonly os: OS;
  readonly units: readonly Unit[];
  readonly upcoming: readonly Upcoming[];
  readonly completed: readonly string[];
  /** Lessons that can be started now: the next one, plus the next in any unit skipped ahead to. */
  readonly playable: readonly string[];
  readonly unlocked: readonly string[];
  readonly shell: ShellKind;
  readonly shells: readonly ShellKind[];
  readonly secrets: readonly string[];
  readonly onWear: (kind: ShellKind) => void;
  readonly onSkipAhead: (unitId: string) => void;
  readonly xp: number;
  readonly streak: number;
  readonly streakToday: boolean;
  readonly greeting: { readonly text: string; readonly mood: HermeMood } | null;
  readonly onStart: (lessonId: string) => void;
  readonly onSwitchOs: () => void;
};

/** Horizontal offsets that make the path wind like a trail through the tide pools. */
const WIGGLE = [0, 56, 84, 56, 0, -56, -84, -56];
const UNIT_COLOURS = ['coral', 'sea', 'violet', 'amber', 'rose', 'teal', 'indigo', 'lime'] as const;

type NodeState = 'done' | 'current' | 'locked';

export function Home({ os, units, upcoming, completed, playable, unlocked, shell, shells, secrets, onWear, onSkipAhead, xp, streak, streakToday, greeting, onStart, onSwitchOs }: Props) {
  const ordered: Lesson[] = units.flatMap((u) => [...u.lessons]);
  const currentId = playable[0] ?? null;
  const [open, setOpen] = useState<string | null>(null);
  const currentRef = useRef<HTMLButtonElement>(null);

  const currentIndex = currentId === null ? 0 : ordered.findIndex((l) => l.id === currentId);
  useEffect(() => {
    // Early on, keep Herme's greeting in view instead of scrolling it under the header.
    if (currentIndex >= 3) currentRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stateOf = (lesson: Lesson): NodeState => {
    if (completed.includes(lesson.id)) return 'done';
    if (playable.includes(lesson.id)) return 'current';
    return 'locked';
  };

  let globalIndex = 0;
  const totalDone = ordered.filter((l) => completed.includes(l.id)).length;

  return (
    <div className="home" onClick={() => setOpen(null)}>
      <StatsBar os={os} xp={xp} streak={streak} streakToday={streakToday} onSwitchOs={onSwitchOs} />
      <main className="path-wrap">
        {greeting && (
          <div className="greeting">
            <Herme mood={greeting.mood} size={84} shell={shell} />
            <p className="speech speech-left">{greeting.text}</p>
          </div>
        )}
        <div className="extras">
          {shells.length > 1 && (
            <div className="wardrobe" aria-label="Herme's shells">
              <span className="extras-label">Shells</span>
              {SHELLS.map((sh) =>
                shells.includes(sh.kind) ? (
                  <button
                    key={sh.kind}
                    type="button"
                    className={`wardrobe-item${sh.kind === shell ? ' is-worn' : ''}`}
                    title={`${sh.name}: ${sh.line}`}
                    aria-pressed={sh.kind === shell}
                    onClick={() => onWear(sh.kind)}
                  >
                    <Herme size={44} shell={sh.kind} title={sh.name} />
                  </button>
                ) : (
                  <span key={sh.kind} className="wardrobe-item is-locked" title="Finish a unit to earn this shell">
                    ?
                  </span>
                ),
              )}
            </div>
          )}
          <p className="secrets">
            <span className="extras-label">Secrets found</span> {secrets.length}/{SECRET_IDS.length}
            {secrets.length < SECRET_IDS.length && (
              <span className="secrets-hint"> · {SECRET_HINTS[SECRET_IDS.find((id) => !secrets.includes(id)) ?? ''] ?? ''}</span>
            )}
          </p>
        </div>
        {units.map((unit, ui) => {
          const colour = UNIT_COLOURS[ui % UNIT_COLOURS.length] ?? 'coral';
          const unitDone = unit.lessons.filter((l) => completed.includes(l.id)).length;
          return (
            <section key={unit.id} className={`unit unit-${colour}`}>
              <div className="unit-banner">
                <div>
                  <p className="unit-kicker">Unit {ui + 1}</p>
                  <h2 className="unit-title">{unit.title}</h2>
                  <p className="unit-blurb">{unit.blurb}</p>
                </div>
                <span className="unit-count">
                  {unitDone}/{unit.lessons.length}
                </span>
              </div>
              {ui > 0 && unitDone === 0 && !unlocked.includes(unit.id) && !unit.lessons.some((l) => playable.includes(l.id)) && (
                <button type="button" className="skip-ahead" onClick={() => onSkipAhead(unit.id)}>
                  Know this already? Skip ahead
                </button>
              )}
              <ol className="path">
                {unit.lessons.map((lesson, li) => {
                  const state = stateOf(lesson);
                  const offset = WIGGLE[globalIndex % WIGGLE.length] ?? 0;
                  globalIndex++;
                  const isOpen = open === lesson.id;
                  return (
                    <li key={lesson.id} className={`path-step${isOpen ? ' is-open' : ''}`} style={{ transform: `translateX(${offset}px)` }}>
                      {state === 'current' && !isOpen && <span className="start-bubble">{totalDone === 0 ? 'Start' : 'Next'}</span>}
                      <button
                        type="button"
                        ref={lesson.id === currentId ? currentRef : undefined}
                        className={`node node-${state}`}
                        disabled={state === 'locked'}
                        aria-label={`${lesson.title}${state === 'done' ? ', complete' : state === 'locked' ? ', locked' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(isOpen ? null : lesson.id);
                        }}
                      >
                        <NodeIcon state={state} index={li} />
                      </button>
                      {state === 'current' && <span className="node-ring" aria-hidden="true" />}
                      {isOpen && (
                        <div className="node-pop" onClick={(e) => e.stopPropagation()}>
                          <p className="node-pop-title">{lesson.title}</p>
                          <p className="node-pop-meta">
                            Lesson {li + 1} of {unit.lessons.length} · {lesson.challenges.length} steps
                          </p>
                          <button type="button" className="primary-button" autoFocus onClick={() => onStart(lesson.id)}>
                            {state === 'done' ? 'Practice again +XP' : `Start +${lesson.challenges.filter((c) => c.type !== 'learn').length * 15} XP`}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
                {ui === 0 && (
                  <li className="path-mascot" aria-hidden="true">
                    <Herme mood={totalDone === 0 ? 'idle' : 'smug'} size={110} shell={shell} />
                  </li>
                )}
              </ol>
            </section>
          );
        })}
        {upcoming.map((u, i) => {
          const colour = UNIT_COLOURS[(units.length + i) % UNIT_COLOURS.length] ?? 'coral';
          return (
            <section key={u.id} className={`unit unit-${colour} unit-locked`}>
              <div className="unit-banner">
                <div>
                  <p className="unit-kicker">Unit {units.length + i + 1}</p>
                  <h2 className="unit-title">{u.title}</h2>
                  <p className="unit-blurb">{u.blurb}</p>
                </div>
                <span className="unit-count">🔒</span>
              </div>
              <ol className="path">
                {[0, 1].map((k) => {
                  const offset = WIGGLE[globalIndex % WIGGLE.length] ?? 0;
                  globalIndex++;
                  return (
                    <li key={k} className="path-step" style={{ transform: `translateX(${offset}px)` }}>
                      <button type="button" className="node node-locked" disabled aria-label="Coming soon">
                        <NodeIcon state="locked" index={k} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
        <p className="path-end">More units are crawling in. Herme is writing them by claw.</p>
      </main>
    </div>
  );
}

function NodeIcon({ state, index }: { state: NodeState; index: number }) {
  if (state === 'done') {
    return (
      <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (state === 'locked') {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
        <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.6" />
      </svg>
    );
  }
  // current: a prompt glyph
  return (
    <span className="node-glyph" aria-hidden="true">
      {index % 2 === 0 ? '>_' : '$_'}
    </span>
  );
}
