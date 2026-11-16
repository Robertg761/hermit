import { useEffect, useState } from 'react';
import { Flame } from '../components/StatsBar';
import { Shellby } from '../mascot/Shellby';
import { sounds } from '../sound';

type Props = {
  readonly streak: number;
  readonly week: readonly { readonly day: string; readonly done: boolean }[];
  readonly onContinue: () => void;
};

const LINES: Record<string, string> = {
  first: "Day one. Every hermit starts somewhere. Usually in someone else's shell.",
  two: 'Two days! That is a pattern. I am cautiously impressed.',
  more: 'Look at that streak. Do not break it. I will know.',
};

export function StreakScreen({ streak, week, onContinue }: Props) {
  useEffect(() => sounds.streak(), []);
  const [line] = useState(() => (streak <= 1 ? LINES['first'] : streak === 2 ? LINES['two'] : LINES['more']));
  const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return (
    <main className="streak-screen">
      <div className="streak-flame">
        <Flame lit size={150} />
      </div>
      <p className="streak-number">{streak}</p>
      <p className="streak-label">day streak!</p>
      <ol className="week">
        {week.map((d) => {
          const [y, m, dd] = d.day.split('-').map(Number);
          const dow = new Date(y ?? 2026, (m ?? 1) - 1, dd ?? 1).getDay();
          return (
            <li key={d.day} className={d.done ? 'is-done' : ''}>
              <span className="week-day">{letters[dow]}</span>
              <span className="week-dot">{d.done ? '✓' : ''}</span>
            </li>
          );
        })}
      </ol>
      <div className="streak-say">
        <Shellby mood="smug" size={90} />
        <p className="speech speech-left">{line}</p>
      </div>
      <button type="button" className="primary-button wide" onClick={onContinue} autoFocus>
        Continue
      </button>
    </main>
  );
}
