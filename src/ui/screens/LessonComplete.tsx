import { useEffect, useState } from 'react';
import { Confetti } from '../components/Confetti';
import { CountUp } from '../components/CountUp';
import { Flame } from '../components/StatsBar';
import { pickLine } from '../mascot/lines';
import { Shellby } from '../mascot/Shellby';
import { sounds } from '../sound';

type Props = {
  readonly xp: number;
  readonly clean: number;
  readonly total: number;
  readonly streak: number;
  readonly lessonsToday: number;
  readonly onContinue: () => void;
};

export function LessonComplete({ xp, clean, total, streak, lessonsToday, onContinue }: Props) {
  const [line] = useState(() => (lessonsToday >= 3 ? pickLine('hatTrick') : pickLine('lessonComplete')));
  useEffect(() => sounds.complete(), []);
  const accuracy = total === 0 ? 100 : Math.round((clean / total) * 100);
  return (
    <main className="complete">
      <Confetti />
      <div className="complete-hero">
        <Shellby mood="happy" size={200} />
      </div>
      <h1>Lesson complete!</h1>
      <p className="complete-line">{line}</p>
      <div className="stats">
        <div className="stat stat-xp">
          <span className="stat-label">Total XP</span>
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
      <button type="button" className="primary-button wide" onClick={onContinue} autoFocus>
        Continue
      </button>
    </main>
  );
}
