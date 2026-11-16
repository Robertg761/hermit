import { useEffect, useRef, useState } from 'react';
import type { Lesson, Unit } from '../../domain/lessons/types';
import type { OS } from '../../domain/types';
import { Shellby, type ShellbyMood } from '../mascot/Shellby';
import { StatsBar } from '../components/StatsBar';

type Upcoming = { readonly id: string; readonly title: string; readonly blurb: string };

type Props = {
  readonly os: OS;
  readonly units: readonly Unit[];
  readonly upcoming: readonly Upcoming[];
  readonly completed: readonly string[];
  readonly xp: number;
  readonly streak: number;
  readonly streakToday: boolean;
  readonly greeting: { readonly text: string; readonly mood: ShellbyMood } | null;
  readonly onStart: (lessonId: string) => void;
  readonly onSwitchOs: () => void;
};

/** Horizontal offsets that make the path wind like a trail through the tide pools. */
const WIGGLE = [0, 56, 84, 56, 0, -56, -84, -56];
const UNIT_COLOURS = ['coral', 'sea', 'violet', 'amber', 'rose', 'teal', 'indigo', 'lime'] as const;

type NodeState = 'done' | 'current' | 'locked';

export function Home({ os, units, upcoming, completed, xp, streak, streakToday, greeting, onStart, onSwitchOs }: Props) {
  const ordered: Lesson[] = units.flatMap((u) => [...u.lessons]);
  const currentId = ordered.find((l) => !completed.includes(l.id))?.id ?? null;
  const [open, setOpen] = useState<string | null>(null);
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, []);

  const stateOf = (lesson: Lesson): NodeState => {
    if (completed.includes(lesson.id)) return 'done';
    if (lesson.id === currentId) return 'current';
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
            <Shellby mood={greeting.mood} size={84} />
            <p className="speech speech-left">{greeting.text}</p>
          </div>
        )}
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
                        ref={state === 'current' ? currentRef : undefined}
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
                            Lesson {li + 1} of {unit.lessons.length} · {lesson.challenges.length} challenges
                          </p>
                          <button type="button" className="primary-button" autoFocus onClick={() => onStart(lesson.id)}>
                            {state === 'done' ? 'Practice again +XP' : `Start +${lesson.challenges.length * 15} XP`}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
                {ui === 0 && (
                  <li className="path-mascot" aria-hidden="true">
                    <Shellby mood={totalDone === 0 ? 'idle' : 'smug'} size={110} />
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
        <p className="path-end">More units are crawling in. Shellby is writing them by claw.</p>
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
