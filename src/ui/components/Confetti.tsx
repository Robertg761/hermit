import { useState } from 'react';

const COLOURS = ['#ff6b57', '#f7c58b', '#4cc9d6', '#b49cff', '#ffd166', '#ff5d73'];

/** A one-shot burst of CSS confetti. */
export function Confetti({ pieces = 70 }: { pieces?: number }) {
  const [bits] = useState(() =>
    Array.from({ length: pieces }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      duration: 1.8 + Math.random() * 1.4,
      rotate: Math.random() * 720 - 360,
      drift: Math.random() * 160 - 80,
      colour: COLOURS[i % COLOURS.length] ?? '#ff6b57',
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 10,
    })),
  );
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i}
          style={
            {
              left: `${b.left}%`,
              width: b.w,
              height: b.h,
              background: b.colour,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.duration}s`,
              '--rot': `${b.rotate}deg`,
              '--drift': `${b.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
