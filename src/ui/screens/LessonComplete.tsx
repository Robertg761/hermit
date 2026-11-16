import { useState } from 'react';
import { pickLine } from '../mascot/lines';
import { Shellby } from '../mascot/Shellby';

type Props = {
  readonly xp: number;
  readonly clean: number;
  readonly total: number;
  readonly hasNext: boolean;
  readonly onNext: () => void;
  readonly onHome: () => void;
};

export function LessonComplete({ xp, clean, total, hasNext, onNext, onHome }: Props) {
  const [line] = useState(() => pickLine('lessonComplete'));
  return (
    <main className="complete">
      <Shellby mood="happy" size={220} />
      <h1>Lesson complete</h1>
      <p className="complete-line">{line}</p>
      <div className="stats">
        <div className="stat">
          <span className="stat-value">+{xp}</span>
          <span className="stat-label">XP</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {clean}/{total}
          </span>
          <span className="stat-label">first try</span>
        </div>
      </div>
      <div className="complete-actions">
        {hasNext ? (
          <button type="button" className="primary-button" onClick={onNext} autoFocus>
            Next lesson
          </button>
        ) : (
          <p className="fineprint">More lessons are on the way.</p>
        )}
        <button type="button" className="secondary-button" onClick={onHome} autoFocus={!hasNext}>
          Back to start
        </button>
      </div>
    </main>
  );
}
