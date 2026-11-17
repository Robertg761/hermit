import { useEffect, useState } from 'react';
import { Confetti } from '../components/Confetti';
import { CountUp } from '../components/CountUp';
import { Flame } from '../components/StatsBar';
import { pickLine } from '../mascot/lines';
import { SHELLS, Herme, type ShellKind } from '../mascot/Herme';
import { sounds } from '../sound';

type Props = {
  readonly xp: number;
  readonly clean: number;
  readonly total: number;
  readonly streak: number;
  readonly lessonsToday: number;
  readonly onContinue: () => void;
  readonly shell: ShellKind;
  /** Set when this lesson finished a unit: Herme moves into this shell. */
  readonly newShell: ShellKind | null;
  readonly nextTitle: string | null;
  readonly onNext: () => void;
};

export function LessonComplete({ xp, clean, total, streak, lessonsToday, onContinue, shell, newShell, nextTitle, onNext }: Props) {
  const [line] = useState(() => (lessonsToday >= 3 ? pickLine('hatTrick') : pickLine('lessonComplete')));
  useEffect(() => sounds.complete(), []);
  const accuracy = total === 0 ? 100 : Math.round((clean / total) * 100);
  const reward = newShell === null ? undefined : SHELLS.find((x) => x.kind === newShell);
  return (
    <main className="complete">
      <Confetti />
      <div className={`complete-hero${reward !== undefined ? ' is-new-shell' : ''}`}>
        <Herme mood="happy" size={200} shell={shell} />
      </div>
      {reward !== undefined ? (
        <>
          <h1>Unit complete!</h1>
          <p className="complete-line">
            New shell unlocked: <strong>{reward.name}</strong>. {reward.line} Herme has already moved in.
          </p>
        </>
      ) : (
        <>
          <h1>Lesson complete!</h1>
          <p className="complete-line">{line}</p>
        </>
      )}
      <div className="stats">
        <div className="stat stat-xp">
          <span className="stat-label">XP earned</span>
          <span className="stat-value">
            <CountUp to={xp} prefix="+" />
          </span>
        </div>
        <div className="stat stat-acc">
          <span className="stat-label">{accuracy === 100 ? 'Flawless' : 'First try'}</span>
          <span className="stat-value">
            <CountUp to={accuracy} suffix="%" />
          </span>
        </div>
        <div className="stat stat-streak">
          <span className="stat-label">Streak</span>
          <span className="stat-value">
            <Flame lit size={26} /> {streak}
          </span>
        </div>
      </div>
      {nextTitle !== null ? (
        <>
          <button type="button" className="primary-button wide" onClick={onNext} autoFocus>
            Next lesson: {nextTitle}
          </button>
          <button type="button" className="link-button" onClick={onContinue}>
            Back to the path
          </button>
        </>
      ) : (
        <button type="button" className="primary-button wide" onClick={onContinue} autoFocus>
          Continue
        </button>
      )}
    </main>
  );
}
